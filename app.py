"""Local web app for exploring HDB resale data.

Run: python app.py
Then open http://127.0.0.1:5000 in a browser.
"""

import csv
import difflib
import io
import json
import os
import pathlib
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from flask import Flask, Response, abort, g, jsonify, request, send_from_directory

from build_livability import PERSONAS, PILLARS
from build_webapp_db import GEOCODE_CACHE_FILE, Median, sync_geocode
from geo import PointIndex
from transport_model import walk_min

ROOT = pathlib.Path(__file__).parent
DB_FILE = ROOT / "data" / "hdb.db"
STATIC_DIR = ROOT / "static"
ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search"

PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 500
CSV_EXPORT_MAX_ROWS = 200_000

SORTABLE_COLUMNS = {
    "month",
    "town",
    "flat_type",
    "block",
    "street_name",
    "storey_low",
    "floor_area_sqm",
    "flat_model",
    "lease_commence_date",
    "remaining_lease_months",
    "resale_price",
    "price_psf",
}

TX_COLUMNS = (
    "month, town, flat_type, block, street_name, unit_id, storey_range, "
    "floor_area_sqm, flat_model, lease_commence_date, remaining_lease_months, "
    "resale_price, price_psf"
)

# OneMap returns full road names; HDB datasets use these abbreviations.
ROAD_ABBREVIATIONS = {
    "AVENUE": "AVE",
    "STREET": "ST",
    "ROAD": "RD",
    "DRIVE": "DR",
    "CRESCENT": "CRES",
    "CENTRAL": "CTRL",
    "NORTH": "NTH",
    "SOUTH": "STH",
    "BUKIT": "BT",
    "JALAN": "JLN",
    "LORONG": "LOR",
    "PLACE": "PL",
    "CLOSE": "CL",
    "TERRACE": "TER",
    "HEIGHTS": "HTS",
    "GARDENS": "GDNS",
    "GARDEN": "GDN",
    "PARK": "PK",
    "UPPER": "UPP",
    "KAMPONG": "KG",
    "TANJONG": "TG",
    "COMMONWEALTH": "C'WEALTH",
    "MARKET": "MKT",
    "SAINT": "ST.",
    "SQUARE": "SQ",
    "CENTRE": "CTR",
    "BOULEVARD": "BLVD",
    "EXPRESSWAY": "EXPWY",
}

app = Flask(__name__, static_folder=None)

_cache: dict = {}
_geocode_sync = {"size": -1, "checked": 0.0}
_geocode_lock = threading.Lock()
GEOCODE_SIZE_KEY = "__geocode_cache_size"


def load_precomputed() -> None:
    """Seed the cache with responses saved by precompute.py at build time."""
    if not DB_FILE.exists():
        return
    conn = sqlite3.connect(DB_FILE)
    try:
        rows = conn.execute("SELECT key, body FROM precomputed").fetchall()
    except sqlite3.OperationalError:
        return
    finally:
        conn.close()
    for key, body in rows:
        _cache[key] = json.loads(body)
    # The saved map/meta match the geocode cache as of the build; only re-sync if it changes.
    _geocode_sync["size"] = _cache.pop(GEOCODE_SIZE_KEY, -1)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DB_FILE)
        g.db.row_factory = sqlite3.Row
        g.db.create_aggregate("median", 1, Median)
    return g.db


@app.teardown_appcontext
def close_db(_exception=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def maybe_sync_geocode() -> None:
    """Pull new rows from the geocode cache file (it grows while geocoding runs)."""
    now = time.time()
    if now - _geocode_sync["checked"] < 30 or not GEOCODE_CACHE_FILE.exists():
        return
    with _geocode_lock:
        _geocode_sync["checked"] = now
        size = GEOCODE_CACHE_FILE.stat().st_size
        if size == _geocode_sync["size"]:
            return
        conn = sqlite3.connect(DB_FILE)
        try:
            sync_geocode(conn)
        finally:
            conn.close()
        _geocode_sync["size"] = size
        _cache.pop("map", None)
        _cache.pop("meta", None)


def cached(key: str, compute):
    if key not in _cache:
        _cache[key] = compute()
    return _cache[key]


def rows_to_dicts(rows) -> list[dict]:
    return [dict(row) for row in rows]


def latest_month(db) -> str:
    return cached("latest_month", lambda: db.execute("SELECT MAX(month) FROM transactions").fetchone()[0])


def shift_month(month: str, delta_months: int) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    total = year * 12 + (mon - 1) + delta_months
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def build_filters(args) -> tuple[str, list]:
    clauses, params = [], []

    for field in ("town", "flat_type", "flat_model"):
        values = [v for v in args.getlist(field) if v]
        if len(values) == 1:
            clauses.append(f"{field} = ?")
            params.append(values[0])
        elif values:
            clauses.append(f"{field} IN ({', '.join('?' * len(values))})")
            params.extend(values)

    ranges = {
        "month_from": ("month >= ?", str),
        "month_to": ("month <= ?", str),
        "price_min": ("resale_price >= ?", float),
        "price_max": ("resale_price <= ?", float),
        "area_min": ("floor_area_sqm >= ?", float),
        "area_max": ("floor_area_sqm <= ?", float),
        "storey_min": ("storey_low >= ?", int),
        "storey_max": ("storey_high <= ?", int),
        "lease_min_years": ("remaining_lease_months >= ? * 12", float),
        "lease_max_years": ("remaining_lease_months <= ? * 12", float),
    }
    for key, (clause, cast) in ranges.items():
        value = args.get(key)
        if value:
            try:
                params.append(cast(value))
            except ValueError:
                abort(400, f"invalid {key}")
            clauses.append(clause)

    q = (args.get("q") or "").strip().upper()
    if q:
        clauses.append("(street_name LIKE ? OR block = ? OR (block || ' ' || street_name) LIKE ?)")
        params.extend([f"%{q}%", q, f"%{q}%"])

    return (f"WHERE {' AND '.join(clauses)}" if clauses else ""), params


# ---------- static ----------


@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory(STATIC_DIR, filename)


# ---------- meta / overview ----------


@app.route("/api/meta")
def api_meta():
    maybe_sync_geocode()
    db = get_db()

    def compute():
        examples = []
        for label, sql in (
            ("Tallest", "SELECT unit_id FROM property_info WHERE residential = 'Y' ORDER BY max_floor_lvl DESC LIMIT 1"),
            ("Most resold", "SELECT unit_id FROM transactions GROUP BY unit_id ORDER BY COUNT(*) DESC LIMIT 1"),
            ("Newest", "SELECT unit_id FROM property_info WHERE residential = 'Y' ORDER BY year_completed DESC, max_floor_lvl DESC LIMIT 1"),
            ("Oldest", "SELECT unit_id FROM property_info WHERE residential = 'Y' AND year_completed > 0 ORDER BY year_completed ASC LIMIT 1"),
        ):
            row = db.execute(sql).fetchone()
            if row:
                examples.append({"label": label, "unit_id": row[0]})

        return {
            "examples": examples,
            "towns": [r[0] for r in db.execute("SELECT DISTINCT town FROM transactions ORDER BY town")],
            "flat_types": [r[0] for r in db.execute("SELECT DISTINCT flat_type FROM transactions ORDER BY flat_type")],
            "flat_models": [r[0] for r in db.execute("SELECT DISTINCT flat_model FROM transactions ORDER BY flat_model")],
            "month_min": db.execute("SELECT MIN(month) FROM transactions").fetchone()[0],
            "month_max": latest_month(db),
            "transaction_count": db.execute("SELECT COUNT(*) FROM transactions").fetchone()[0],
            "block_count": db.execute("SELECT COUNT(*) FROM property_info").fetchone()[0],
            "geocoded_count": db.execute(
                "SELECT COUNT(*) FROM geocode WHERE geocode_status = 'ok'"
            ).fetchone()[0],
        }

    return jsonify(cached("meta", compute))


@app.route("/api/overview")
def api_overview():
    db = get_db()

    def compute():
        latest = latest_month(db)
        last12_from = shift_month(latest, -11)
        prev12_from, prev12_to = shift_month(latest, -23), shift_month(latest, -12)

        def window_stats(month_from, month_to):
            return dict(
                db.execute(
                    """
                    SELECT COUNT(*) AS count, median(resale_price) AS median_price,
                           median(price_psf) AS median_psf,
                           SUM(resale_price >= 1000000) AS million_count
                    FROM transactions WHERE month BETWEEN ? AND ?
                    """,
                    (month_from, month_to),
                ).fetchone()
            )

        current = window_stats(last12_from, latest)
        previous = window_stats(prev12_from, prev12_to)

        record = dict(
            db.execute(
                f"SELECT {TX_COLUMNS} FROM transactions ORDER BY resale_price DESC LIMIT 1"
            ).fetchone()
        )

        monthly = rows_to_dicts(
            db.execute(
                """
                SELECT month, COUNT(*) AS count, median(resale_price) AS median_price,
                       median(price_psf) AS median_psf
                FROM transactions WHERE month >= ?
                GROUP BY month ORDER BY month
                """,
                (shift_month(latest, -59),),
            )
        )

        yearly_by_type = rows_to_dicts(
            db.execute(
                """
                SELECT year, flat_type, median(resale_price) AS median_price, COUNT(*) AS count
                FROM transactions GROUP BY year, flat_type ORDER BY year
                """
            )
        )

        yearly_volume = rows_to_dicts(
            db.execute(
                """
                SELECT year, COUNT(*) AS count, SUM(resale_price >= 1000000) AS million_count
                FROM transactions GROUP BY year ORDER BY year
                """
            )
        )

        hottest = rows_to_dicts(
            db.execute(
                f"""
                SELECT {TX_COLUMNS} FROM transactions WHERE month >= ?
                ORDER BY resale_price DESC LIMIT 10
                """,
                (last12_from,),
            )
        )

        return {
            "latest_month": latest,
            "window": {"from": last12_from, "to": latest},
            "current": current,
            "previous": previous,
            "record": record,
            "monthly": monthly,
            "yearly_by_type": yearly_by_type,
            "yearly_volume": yearly_volume,
            "top_recent": hottest,
        }

    return jsonify(cached("overview", compute))


# ---------- explore ----------


@app.route("/api/transactions")
def api_transactions():
    db = get_db()
    where, params = build_filters(request.args)

    sort = request.args.get("sort", "month")
    if sort not in SORTABLE_COLUMNS:
        sort = "month"
    direction = "ASC" if request.args.get("dir") == "asc" else "DESC"
    order = f"ORDER BY {sort} {direction}, month DESC"

    if request.args.get("format") == "csv":
        sql = f"SELECT {TX_COLUMNS} FROM transactions {where} {order} LIMIT ?"
        sql_params = [*params, CSV_EXPORT_MAX_ROWS]

        # The request's db connection is closed before streaming finishes, so use our own.
        def generate():
            conn = sqlite3.connect(DB_FILE)
            try:
                buffer = io.StringIO()
                writer = csv.writer(buffer)
                writer.writerow([c.strip() for c in TX_COLUMNS.split(",")])
                for row in conn.execute(sql, sql_params):
                    writer.writerow(row)
                    if buffer.tell() > 65536:
                        yield buffer.getvalue()
                        buffer.seek(0)
                        buffer.truncate()
                yield buffer.getvalue()
            finally:
                conn.close()

        return Response(
            generate(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=hdb_resale_export.csv"},
        )

    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = min(max(int(request.args.get("page_size", PAGE_SIZE_DEFAULT)), 1), PAGE_SIZE_MAX)
    except ValueError:
        abort(400, "invalid page")

    total = db.execute(f"SELECT COUNT(*) FROM transactions {where}", params).fetchone()[0]
    rows = db.execute(
        f"SELECT {TX_COLUMNS} FROM transactions {where} {order} LIMIT ? OFFSET ?",
        [*params, page_size, (page - 1) * page_size],
    )
    return jsonify({"total": total, "page": page, "page_size": page_size, "rows": rows_to_dicts(rows)})


@app.route("/api/summary")
def api_summary():
    db = get_db()
    where, params = build_filters(request.args)
    key = "summary:" + request.query_string.decode()

    def compute():
        stats = dict(
            db.execute(
                f"""
                SELECT COUNT(*) AS count, median(resale_price) AS median_price,
                       median(price_psf) AS median_psf, MIN(resale_price) AS min_price,
                       MAX(resale_price) AS max_price, AVG(floor_area_sqm) AS avg_area
                FROM transactions {where}
                """,
                params,
            ).fetchone()
        )
        by_year = rows_to_dicts(
            db.execute(
                f"""
                SELECT year, COUNT(*) AS count, median(resale_price) AS median_price,
                       median(price_psf) AS median_psf
                FROM transactions {where} GROUP BY year ORDER BY year
                """,
                params,
            )
        )
        histogram = rows_to_dicts(
            db.execute(
                f"""
                SELECT CAST(resale_price / 50000 AS INTEGER) * 50000 AS bucket, COUNT(*) AS count
                FROM transactions {where} GROUP BY bucket ORDER BY bucket
                """,
                params,
            )
        )
        return {"stats": stats, "by_year": by_year, "histogram": histogram}

    return jsonify(cached(key, compute))


# ---------- towns ----------


@app.route("/api/towns")
def api_towns():
    db = get_db()
    flat_type = request.args.get("flat_type") or ""

    def compute():
        latest = latest_month(db)
        cur_from = shift_month(latest, -11)
        prev_from, prev_to = shift_month(latest, -23), shift_month(latest, -12)
        type_clause = "AND flat_type = ?" if flat_type else ""
        type_params = [flat_type] if flat_type else []

        def per_town(month_from, month_to):
            return {
                r["town"]: dict(r)
                for r in db.execute(
                    f"""
                    SELECT town, COUNT(*) AS count, median(resale_price) AS median_price,
                           median(price_psf) AS median_psf, MAX(resale_price) AS max_price,
                           AVG(remaining_lease_months) / 12.0 AS avg_lease_years
                    FROM transactions WHERE month BETWEEN ? AND ? {type_clause}
                    GROUP BY town
                    """,
                    [month_from, month_to, *type_params],
                )
            }

        current = per_town(cur_from, latest)
        previous = per_town(prev_from, prev_to)
        blocks = {
            r["town"]: dict(r)
            for r in db.execute(
                """
                SELECT town, COUNT(*) AS blocks, SUM(total_dwelling_units) AS dwelling_units,
                       AVG(year_completed) AS avg_year_completed, MAX(max_floor_lvl) AS tallest
                FROM property_info WHERE residential = 'Y' GROUP BY town
                """
            )
        }

        towns = []
        for town in sorted(set(current) | set(blocks)):
            row = {"town": town, **blocks.get(town, {}), **current.get(town, {"count": 0})}
            prev = previous.get(town)
            if prev and prev["median_price"] and row.get("median_price"):
                row["yoy_change"] = row["median_price"] / prev["median_price"] - 1
            towns.append(row)
        return {"window": {"from": cur_from, "to": latest}, "towns": towns}

    return jsonify(cached(f"towns:{flat_type}", compute))


@app.route("/api/compare")
def api_compare():
    db = get_db()
    towns = [t for t in request.args.getlist("town") if t][:8]
    flat_type = request.args.get("flat_type") or ""
    metric = "price_psf" if request.args.get("metric") == "psf" else "resale_price"
    column = "median_psf" if metric == "price_psf" else "median_price"
    if not towns:
        return jsonify({"series": []})

    rows = db.execute(
        f"""
        SELECT town, year, {column} AS value, count FROM compare_stats
        WHERE flat_type = ? AND town IN ({', '.join('?' * len(towns))}) ORDER BY year
        """,
        [flat_type, *towns],
    )
    series = {}
    for r in rows:
        series.setdefault(r["town"], []).append({"year": r["year"], "value": r["value"], "count": r["count"]})
    return jsonify({"metric": metric, "series": [{"town": t, "points": series.get(t, [])} for t in towns]})


# ---------- insights ----------


@app.route("/api/insights")
def api_insights():
    db = get_db()
    flat_type = request.args.get("flat_type") or "4 ROOM"

    def compute():
        latest = latest_month(db)
        since = shift_month(latest, -35)

        storey_premium = rows_to_dicts(
            db.execute(
                """
                SELECT storey_range, storey_low, median(price_psf) AS median_psf,
                       median(resale_price) AS median_price, COUNT(*) AS count
                FROM transactions
                WHERE month >= ? AND flat_type = ? AND storey_high - storey_low = 2
                GROUP BY storey_range HAVING count >= 20 ORDER BY storey_low
                """,
                (since, flat_type),
            )
        )
        by_model = rows_to_dicts(
            db.execute(
                """
                SELECT flat_model, median(price_psf) AS median_psf, median(resale_price) AS median_price,
                       COUNT(*) AS count
                FROM transactions WHERE month >= ? AND flat_type = ?
                GROUP BY flat_model HAVING count >= 20 ORDER BY median_psf DESC
                """,
                (since, flat_type),
            )
        )
        priciest_blocks = rows_to_dicts(
            db.execute(
                """
                SELECT unit_id, block, street_name, town, median(resale_price) AS median_price,
                       median(price_psf) AS median_psf, COUNT(*) AS count
                FROM transactions WHERE month >= ? AND flat_type = ?
                GROUP BY unit_id HAVING count >= 5 ORDER BY median_psf DESC LIMIT 15
                """,
                (since, flat_type),
            )
        )
        best_value = rows_to_dicts(
            db.execute(
                """
                SELECT unit_id, block, street_name, town, median(resale_price) AS median_price,
                       median(price_psf) AS median_psf, AVG(remaining_lease_months) / 12.0 AS lease_years,
                       COUNT(*) AS count
                FROM transactions WHERE month >= ? AND flat_type = ? AND remaining_lease_months >= 70 * 12
                GROUP BY unit_id HAVING count >= 5 ORDER BY median_psf ASC LIMIT 15
                """,
                (since, flat_type),
            )
        )
        return {
            "flat_type": flat_type,
            "window": {"from": since, "to": latest},
            "storey_premium": storey_premium,
            "by_model": by_model,
            "priciest_blocks": priciest_blocks,
            "best_value": best_value,
        }

    return jsonify(cached(f"insights:{flat_type}", compute))


# ---------- map ----------


@app.route("/api/map")
def api_map():
    maybe_sync_geocode()
    db = get_db()

    def compute():
        since = shift_month(latest_month(db), -35)
        has_curve = table_exists(db, "lease_curve")
        adjusted = "median(t.price_psf * c.factor)" if has_curve else "NULL"
        curve_join = "LEFT JOIN lease_curve c ON c.lease_years = t.remaining_lease_months / 12" if has_curve else ""
        rows = db.execute(
            f"""
            SELECT g.unit_id, g.postal_code, ROUND(g.latitude, 5), ROUND(g.longitude, 5),
                   p.town, p.max_floor_lvl, p.year_completed,
                   ROUND(s.median_psf), ROUND(s.adjusted_psf), ROUND(s.lease_years), s.median_price, s.count
            FROM geocode g
            LEFT JOIN property_info p ON p.unit_id = g.unit_id
            LEFT JOIN (
                SELECT t.unit_id, median(t.price_psf) AS median_psf, {adjusted} AS adjusted_psf,
                       median(t.remaining_lease_months) / 12.0 AS lease_years,
                       median(t.resale_price) AS median_price, COUNT(*) AS count
                FROM transactions t {curve_join}
                WHERE t.month >= ? GROUP BY t.unit_id
            ) s ON s.unit_id = g.unit_id
            WHERE g.geocode_status = 'ok' AND g.latitude IS NOT NULL
            """,
            (since,),
        )
        curve = (
            rows_to_dicts(db.execute("SELECT lease_years, factor, n FROM lease_curve WHERE n > 0 ORDER BY lease_years"))
            if has_curve
            else []
        )
        return {
            "since": since,
            "reference_years": 95,
            "lease_curve": curve,
            "columns": [
                "unit_id", "postal_code", "latitude", "longitude", "town", "max_floor_lvl", "year_completed",
                "median_psf", "adjusted_psf", "lease_years", "median_price", "count",
            ],
            "points": [list(r) for r in rows],
        }

    return jsonify(cached("map", compute))


def table_exists(db, name: str) -> bool:
    return db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


# ---------- building ----------


@app.route("/api/search")
def api_search():
    db = get_db()
    q = (request.args.get("q") or "").strip().upper()
    if len(q) < 2:
        return jsonify({"results": []})

    if q.isdigit() and len(q) <= 6:
        rows = db.execute(
            """
            SELECT g.unit_id, g.postal_code, p.town FROM geocode g
            LEFT JOIN property_info p ON p.unit_id = g.unit_id
            WHERE g.postal_code LIKE ? LIMIT 10
            """,
            (f"{q}%",),
        )
        return jsonify({"results": rows_to_dicts(rows)})

    tokens = q.split()
    block_token = tokens[0] if tokens and re.match(r"^\d+[A-Z]?$", tokens[0]) else None
    street_q = " ".join(tokens[1:] if block_token else tokens)
    clauses, params = [], []
    if block_token:
        clauses.append("block = ?")
        params.append(block_token)
    if street_q:
        clauses.append("street_name LIKE ?")
        params.append(f"%{street_q}%")

    rows = db.execute(
        f"""
        SELECT unit_id, town, postal_code FROM (
            SELECT p.unit_id, p.block, p.street_name, p.town, g.postal_code
            FROM property_info p LEFT JOIN geocode g ON g.unit_id = p.unit_id
            UNION ALL
            SELECT e.unit_id, e.block, e.street_name, e.town, g.postal_code
            FROM extra_blocks e LEFT JOIN geocode g ON g.unit_id = e.unit_id
        )
        WHERE {' AND '.join(clauses)}
        ORDER BY street_name, CAST(block AS INTEGER), block LIMIT 15
        """,
        params,
    )
    return jsonify({"results": rows_to_dicts(rows)})


def abbreviate_road(road: str) -> str:
    return " ".join(ROAD_ABBREVIATIONS.get(word, word) for word in road.upper().split())


def onemap_lookup(postal: str) -> tuple[list[dict], bool]:
    """Return (results, unavailable). unavailable means OneMap couldn't answer (e.g. rate limit)."""
    query = urllib.parse.urlencode(
        {"searchVal": postal, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": "1"}
    )
    headers = {"User-Agent": "Mozilla/5.0 (compatible; hdb-explorer/1.0)"}
    token = os.environ.get("ONEMAP_API_TOKEN")
    if token:
        headers["Authorization"] = token
    req = urllib.request.Request(f"{ONEMAP_SEARCH_URL}?{query}", headers=headers)
    # The background geocoder shares OneMap's rate limit, so 429s are expected; retry briefly.
    for delay in (0, 1, 2):
        time.sleep(delay)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.load(response).get("results") or [], False
        except urllib.error.HTTPError as error:
            if error.code != 429:
                return [], True
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return [], True
    return [], True


def postal_candidates(db, postal: str) -> list[str]:
    """Guess blocks from the postal code alone: last 3 digits are the block number,
    and the first 2 digits (postal sector) map to towns we've already geocoded."""
    block_num = int(postal[3:])
    sector_towns = [
        r["town"]
        for r in db.execute(
            """
            SELECT p.town, COUNT(*) AS n FROM geocode g JOIN property_info p ON p.unit_id = g.unit_id
            WHERE substr(g.postal_code, 1, 2) = ? GROUP BY p.town ORDER BY n DESC
            """,
            (postal[:2],),
        )
    ]
    rows = db.execute(
        """
        SELECT unit_id, town FROM property_info
        WHERE CAST(block AS INTEGER) % 1000 = ?
        UNION ALL
        SELECT unit_id, town FROM extra_blocks WHERE CAST(block AS INTEGER) % 1000 = ?
        """,
        (block_num, block_num),
    ).fetchall()
    return sorted(r["unit_id"] for r in rows if r["town"] in sector_towns)[:12]


def resolve_postal(db, postal: str) -> tuple[str | None, bool]:
    """Return (unit_id, onemap_unavailable)."""
    row = db.execute(
        "SELECT unit_id FROM geocode WHERE postal_code = ? AND geocode_status = 'ok' LIMIT 1", (postal,)
    ).fetchone()
    if row:
        return row["unit_id"], False

    results, unavailable = onemap_lookup(postal)
    for result in results:
        if result.get("POSTAL") != postal or not result.get("BLK_NO"):
            continue
        block = result["BLK_NO"].strip().upper()
        street = abbreviate_road(result.get("ROAD_NAME", ""))
        candidates = [
            r["street_name"]
            for r in db.execute(
                """
                SELECT street_name FROM property_info WHERE block = ?
                UNION SELECT street_name FROM extra_blocks WHERE block = ?
                """,
                (block, block),
            )
        ]
        if not candidates:
            continue
        best = street if street in candidates else None
        if best is None:
            scored = [(difflib.SequenceMatcher(None, street, c).ratio(), c) for c in candidates]
            score, best = max(scored)
            if score < 0.6:
                continue

        unit_id = f"{block}|{best}"
        db.execute(
            "INSERT OR REPLACE INTO geocode VALUES (?, ?, ?, ?, 'ok')",
            (unit_id, postal, float(result["LATITUDE"]), float(result["LONGITUDE"])),
        )
        db.commit()
        return unit_id, False
    return None, unavailable


UNIT_MIX_COLUMNS = [
    ("1room_sold", "1 ROOM", "1-rm"),
    ("2room_sold", "2 ROOM", "2-rm"),
    ("3room_sold", "3 ROOM", "3-rm"),
    ("4room_sold", "4 ROOM", "4-rm"),
    ("5room_sold", "5 ROOM", "5-rm"),
    ("exec_sold", "EXECUTIVE", "Exec"),
    ("multigen_sold", "MULTI-GENERATION", "3Gen"),
    ("studio_apartment_sold", "STUDIO", "Studio"),
]
RENTAL_COLUMNS = ["1room_rental", "2room_rental", "3room_rental", "other_room_rental"]


def unit_layout(info, type_mix: list[dict]) -> tuple[list[dict], str | None]:
    """Unit types in the block and how many of each, for splitting floors.

    HDB doesn't publish which unit is on which floor, so the frontend assumes
    every floor repeats the block's overall mix. Uses the HDB register counts;
    for blocks not in the register, falls back to the mix of past resales.
    """
    if info is not None:
        layout = [
            {"flat_type": flat_type, "label": label, "units": info[col], "rental": False}
            for col, flat_type, label in UNIT_MIX_COLUMNS
            if info[col]
        ]
        rentals = sum(info[col] or 0 for col in RENTAL_COLUMNS)
        if rentals:
            layout.append({"flat_type": "RENTAL", "label": "Rental", "units": rentals, "rental": True})
        if layout:
            return layout, "register"

    labels = {flat_type: label for _, flat_type, label in UNIT_MIX_COLUMNS}
    layout = [
        {"flat_type": t["flat_type"], "label": labels.get(t["flat_type"], t["flat_type"]), "units": t["count"], "rental": False}
        for t in type_mix
    ]
    return layout, ("resales" if layout else None)


def merge_bands(bands: list[dict]) -> tuple[list[dict], int]:
    """Keep the busiest non-overlapping storey bands (older data used 5-floor bands)."""
    accepted = []
    for band in sorted(bands, key=lambda b: -b["count"]):
        if band["storey_low"] is None or band["storey_high"] is None:
            continue
        overlaps = any(
            band["storey_low"] <= a["storey_high"] and a["storey_low"] <= band["storey_high"] for a in accepted
        )
        if not overlaps:
            accepted.append(band)
    hidden = sum(b["count"] for b in bands) - sum(a["count"] for a in accepted)
    return sorted(accepted, key=lambda b: b["storey_low"]), hidden


@app.route("/api/block")
def api_block():
    db = get_db()
    unit_id = request.args.get("unit_id")
    postal = (request.args.get("postal") or "").strip()

    if not unit_id and postal:
        if not re.fullmatch(r"\d{6}", postal):
            abort(400, "Postal code must be 6 digits")
        unit_id, unavailable = resolve_postal(db, postal)
        if unit_id is None:
            candidates = postal_candidates(db, postal)
            if unavailable:
                message = f"OneMap is rate-limiting lookups right now, so {postal} couldn't be confirmed."
            else:
                message = f"No HDB block found for postal code {postal}."
            if candidates:
                message += " Is it one of these?"
            return jsonify({"error": message, "candidates": candidates}), 503 if unavailable else 404
    if not unit_id:
        abort(400, "postal or unit_id required")

    info = db.execute("SELECT * FROM property_info WHERE unit_id = ?", (unit_id,)).fetchone()
    geo = db.execute("SELECT * FROM geocode WHERE unit_id = ?", (unit_id,)).fetchone()
    tx_exists = db.execute("SELECT 1 FROM transactions WHERE unit_id = ? LIMIT 1", (unit_id,)).fetchone()
    if info is None and tx_exists is None:
        return jsonify({"error": "Block not found"}), 404

    period = request.args.get("period", "5")
    flat_type = request.args.get("flat_type") or ""
    latest = latest_month(db)
    clauses, params = ["unit_id = ?"], [unit_id]
    if period != "all":
        try:
            years = int(period)
        except ValueError:
            abort(400, "invalid period")
        clauses.append("month >= ?")
        params.append(shift_month(latest, -(years * 12 - 1)))
    if flat_type:
        clauses.append("flat_type = ?")
        params.append(flat_type)
    where = " AND ".join(clauses)

    raw_bands = rows_to_dicts(
        db.execute(
            f"""
            SELECT storey_range, storey_low, storey_high, COUNT(*) AS count,
                   median(resale_price) AS median_price, median(price_psf) AS median_psf,
                   MIN(resale_price) AS min_price, MAX(resale_price) AS max_price,
                   MAX(month) AS latest_month
            FROM transactions WHERE {where} GROUP BY storey_range
            """,
            params,
        )
    )
    bands, hidden_count = merge_bands(raw_bands)
    band_types: dict[str, list[dict]] = {}
    for row in db.execute(
        f"""
        SELECT storey_range, flat_type, COUNT(*) AS count, median(resale_price) AS median_price,
               median(price_psf) AS median_psf
        FROM transactions WHERE {where} GROUP BY storey_range, flat_type
        """,
        params,
    ):
        band_types.setdefault(row["storey_range"], []).append(dict(row))
    for band in bands:
        band["types"] = band_types.get(band["storey_range"], [])
        latest_tx = db.execute(
            f"""
            SELECT month, resale_price, flat_type FROM transactions
            WHERE {where} AND storey_range = ? ORDER BY month DESC, resale_price DESC LIMIT 1
            """,
            [*params, band["storey_range"]],
        ).fetchone()
        band["latest"] = dict(latest_tx) if latest_tx else None

    summary = dict(
        db.execute(
            f"""
            SELECT COUNT(*) AS count, median(resale_price) AS median_price,
                   median(price_psf) AS median_psf, MAX(resale_price) AS max_price,
                   MIN(lease_commence_date) AS lease_commence_date
            FROM transactions WHERE {where}
            """,
            params,
        ).fetchone()
    )

    recent = rows_to_dicts(
        db.execute(
            f"SELECT {TX_COLUMNS} FROM transactions WHERE {where} ORDER BY month DESC LIMIT 100",
            params,
        )
    )
    yearly = rows_to_dicts(
        db.execute(
            """
            SELECT year, median(resale_price) AS median_price, median(price_psf) AS median_psf,
                   COUNT(*) AS count
            FROM transactions WHERE unit_id = ? GROUP BY year ORDER BY year
            """,
            (unit_id,),
        )
    )
    type_mix = rows_to_dicts(
        db.execute(
            """
            SELECT flat_type, COUNT(*) AS count, median(resale_price) AS median_price
            FROM transactions WHERE unit_id = ? GROUP BY flat_type ORDER BY flat_type
            """,
            (unit_id,),
        )
    )

    layout, layout_source = unit_layout(info, type_mix)

    block, street = unit_id.split("|", 1)
    town = info["town"] if info else db.execute(
        "SELECT town FROM transactions WHERE unit_id = ? LIMIT 1", (unit_id,)
    ).fetchone()["town"]

    town_where = where.replace("unit_id = ?", "town = ?", 1)
    town_psf = db.execute(
        f"SELECT median(price_psf) FROM transactions WHERE {town_where}", [town, *params[1:]]
    ).fetchone()[0]

    lease_commence = db.execute(
        "SELECT MIN(lease_commence_date) FROM transactions WHERE unit_id = ?", (unit_id,)
    ).fetchone()[0]

    nearby = []
    if geo and geo["latitude"] is not None:
        nearby = rows_to_dicts(
            db.execute(
                """
                SELECT g.unit_id, g.postal_code,
                       ((g.latitude - ?) * (g.latitude - ?) + (g.longitude - ?) * (g.longitude - ?)) AS d2
                FROM geocode g WHERE g.unit_id != ? AND g.geocode_status = 'ok' AND g.latitude IS NOT NULL
                ORDER BY d2 LIMIT 6
                """,
                (geo["latitude"], geo["latitude"], geo["longitude"], geo["longitude"], unit_id),
            )
        )
        for n in nearby:
            n["distance_m"] = round((n.pop("d2") ** 0.5) * 111_000)

    return jsonify(
        {
            "unit_id": unit_id,
            "block": block,
            "street_name": street,
            "town": town,
            "listed": info is not None,
            "info": dict(info) if info else None,
            "geocode": dict(geo) if geo else None,
            "lease_commence_date": lease_commence,
            "latest_month": latest,
            "period": period,
            "flat_type": flat_type,
            "summary": summary,
            "town_median_psf": town_psf,
            "bands": bands,
            "hidden_band_count": hidden_count,
            "recent": recent,
            "yearly": yearly,
            "type_mix": type_mix,
            "layout": layout,
            "layout_source": layout_source,
            "nearby": nearby,
            "livability": block_livability(db, unit_id),
            "prediction": block_prediction(db, unit_id),
            "amenities": nearby_amenities(db, geo["latitude"], geo["longitude"]) if geo and geo["latitude"] is not None else {},
        }
    )


# ---------- livability ----------

PILLAR_KEYS = [p["key"] for p in PILLARS]
PERSONA_BY_KEY = {p["key"]: p for p in PERSONAS}
LIV_BLOCK_COLUMNS = (
    "unit_id, block, street_name, town, median_psf, lease_left_years, rail_min, cbd_min, "
    + ", ".join(f"score_{k}" for k in PILLAR_KEYS)
)


def overall_expr(persona_key: str) -> str:
    """SQL for a persona's weighted mean pillar score (keys/weights come from constants, not input)."""
    weights = PERSONA_BY_KEY.get(persona_key, PERSONAS[0])["weights"]
    terms = " + ".join(f"{w} * score_{k}" for k, w in weights.items() if w)
    return f"ROUND(({terms}) / {sum(weights.values())}, 1)"


def livability_available(db) -> bool:
    return db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'livability'").fetchone() is not None


@app.route("/api/livability/meta")
def api_livability_meta():
    db = get_db()

    def compute():
        scored = db.execute("SELECT COUNT(*) FROM livability").fetchone()[0] if livability_available(db) else 0
        residential = db.execute("SELECT COUNT(*) FROM property_info WHERE residential = 'Y'").fetchone()[0]
        return {"pillars": PILLARS, "personas": PERSONAS, "scored_blocks": scored, "residential_blocks": residential}

    return jsonify(cached("liv_meta", compute))


@app.route("/api/livability/towns")
def api_livability_towns():
    db = get_db()
    persona = request.args.get("persona") if request.args.get("persona") in PERSONA_BY_KEY else "balanced"
    if not livability_available(db):
        return jsonify({"towns": []})

    def compute():
        pillar_medians = ", ".join(f"median(score_{k}) AS score_{k}" for k in PILLAR_KEYS)
        rows = db.execute(
            f"""
            SELECT town, COUNT(*) AS blocks, median({overall_expr(persona)}) AS overall, {pillar_medians},
                   median(cbd_min) AS cbd_min, median(rail_min) AS rail_min
            FROM livability GROUP BY town ORDER BY overall DESC
            """
        )
        return {"persona": persona, "towns": rows_to_dicts(rows)}

    return jsonify(cached(f"liv_towns:{persona}", compute))


@app.route("/api/livability/blocks")
def api_livability_blocks():
    db = get_db()
    persona = request.args.get("persona") if request.args.get("persona") in PERSONA_BY_KEY else "balanced"
    if not livability_available(db):
        return jsonify({"total": 0, "rows": []})
    sort = request.args.get("sort", "overall")
    order_col = f"score_{sort}" if sort in PILLAR_KEYS else "overall"
    direction = "ASC" if request.args.get("dir") == "asc" else "DESC"
    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 200)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        abort(400, "invalid limit/offset")

    clauses, params = [], []
    town = request.args.get("town")
    if town:
        clauses.append("town = ?")
        params.append(town)
    min_lease = request.args.get("min_lease")
    if min_lease:
        try:
            params.append(float(min_lease))
        except ValueError:
            abort(400, "invalid min_lease")
        clauses.append("lease_left_years >= ?")
    max_psf = request.args.get("max_psf")
    if max_psf:
        try:
            params.append(float(max_psf))
        except ValueError:
            abort(400, "invalid max_psf")
        clauses.append("median_psf <= ?")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    total = db.execute(f"SELECT COUNT(*) FROM livability {where}", params).fetchone()[0]
    rows = db.execute(
        f"""
        SELECT {LIV_BLOCK_COLUMNS}, {overall_expr(persona)} AS overall
        FROM livability {where}
        ORDER BY {order_col} {direction}, overall DESC, unit_id
        LIMIT ? OFFSET ?
        """,
        [*params, limit, offset],
    )
    return jsonify({"persona": persona, "total": total, "offset": offset, "rows": rows_to_dicts(rows)})


# ---------- amenities ----------

# Per kind: how far to look from a block, and how many of the nearest to list.
NEARBY_AMENITIES = {
    "hawker": (1500, 4),
    "food_court": (1000, 4),
    "supermarket": (1500, 4),
    "mall": (3000, 3),
    "primary_school": (2000, 8),
    "park": (1500, 3),
    "polyclinic": (6000, 1),
    "hospital": (12000, 1),
}
_amenity_index: dict[str, PointIndex] = {}


def amenity_rows(db) -> list[dict]:
    if not table_exists(db, "amenities"):
        return []
    rows = rows_to_dicts(db.execute("SELECT id, kind, name, latitude, longitude, detail FROM amenities ORDER BY id"))
    for r in rows:
        r["detail"] = json.loads(r["detail"]) if r["detail"] else None
    return rows


@app.route("/api/amenities")
def api_amenities():
    db = get_db()

    def compute():
        kinds: dict[str, list] = {}
        for r in amenity_rows(db):
            kinds.setdefault(r["kind"], []).append([r["id"], r["latitude"], r["longitude"], r["name"], r["detail"]])
        return {"kinds": kinds}

    return jsonify(cached("amenities", compute))


def nearby_amenities(db, lat: float, lon: float) -> dict[str, list[dict]]:
    if not _amenity_index:
        by_kind: dict[str, list] = {}
        for r in amenity_rows(db):
            by_kind.setdefault(r["kind"], []).append((r["latitude"], r["longitude"], r))
        _amenity_index.update({kind: PointIndex(points) for kind, points in by_kind.items()})
    out = {}
    for kind, (radius, limit) in NEARBY_AMENITIES.items():
        index = _amenity_index.get(kind)
        if index is None:
            continue
        found = sorted(index.within(lat, lon, radius), key=lambda x: x[0])[:limit]
        out[kind] = [
            {"id": r["id"], "name": r["name"], "distance_m": round(d), "walk_min": round(walk_min(d)), "detail": r["detail"]}
            for d, r in found
        ]
    return out


def block_livability(db, unit_id: str) -> dict | None:
    if not livability_available(db):
        return None
    row = db.execute("SELECT * FROM livability WHERE unit_id = ?", (unit_id,)).fetchone()
    if row is None:
        return None
    overall = {
        p["key"]: db.execute(f"SELECT {overall_expr(p['key'])} FROM livability WHERE unit_id = ?", (unit_id,)).fetchone()[0]
        for p in PERSONAS
    }
    town_scores = dict(
        db.execute(
            f"SELECT {', '.join(f'median(score_{k}) AS {k}' for k in PILLAR_KEYS)} FROM livability WHERE town = ?",
            (row["town"],),
        ).fetchone()
    )
    better_than = db.execute(
        f"SELECT AVG({overall_expr('balanced')} < ?) FROM livability", (overall["balanced"],)
    ).fetchone()[0]
    return {**dict(row), "overall": overall, "town_scores": town_scores, "better_than": better_than}


# ---------- price model ----------


def model_meta(db) -> dict:
    if not table_exists(db, "model_meta"):
        return {}
    return {key: json.loads(value) for key, value in db.execute("SELECT key, value FROM model_meta")}


@app.route("/api/model")
def api_model():
    db = get_db()
    return jsonify(cached("model", lambda: model_meta(db)))


def block_prediction(db, unit_id: str) -> dict | None:
    """Model value per flat type and storey band, next to the block's actual sales in the last 12 months."""
    if not table_exists(db, "predictions"):
        return None
    rows = rows_to_dicts(
        db.execute(
            """
            SELECT flat_type, flat_model, floor_area_sqm, storey_low, storey_high, pred_price, pred_low, pred_high, pred_psf
            FROM predictions WHERE unit_id = ? ORDER BY flat_type, storey_low
            """,
            (unit_id,),
        )
    )
    if not rows:
        return None
    summary = cached("model", lambda: model_meta(db)).get("summary", {})
    since = shift_month(latest_month(db), -11)
    # Compare each recent sale with the model's price for that same flat (size, floor, month), not a typical flat.
    recent = {}
    if table_exists(db, "sale_predictions"):
        recent = {
            r["flat_type"]: dict(r)
            for r in db.execute(
                """
                SELECT flat_type, COUNT(*) AS count, median(resale_price) AS median_price,
                       median(resale_price / pred_price) - 1 AS vs_model, MAX(month) AS latest_month
                FROM sale_predictions WHERE unit_id = ? AND month >= ? GROUP BY flat_type
                """,
                (unit_id, since),
            )
        }
    return {
        "month": summary.get("predicted_month"),
        "mape": summary.get("model", {}).get("mape"),
        "rows": rows,
        "recent": recent,
        "recent_since": since,
    }


@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": error.description}), 400


def warm_cache() -> None:
    """Precompute the slow unfiltered aggregates so first page loads are quick."""
    with app.test_client() as client:
        for path in ("/api/meta", "/api/overview", "/api/summary", "/api/towns", "/api/insights", "/api/map"):
            client.get(path)


load_precomputed()

if os.environ.get("WARM_CACHE") == "1":
    threading.Thread(target=warm_cache, daemon=True).start()

if __name__ == "__main__":
    # With the debug reloader, only warm inside the child process that serves requests.
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        threading.Thread(target=warm_cache, daemon=True).start()
    app.run(debug=True, port=5000)
