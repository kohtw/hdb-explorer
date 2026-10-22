"""Score every geocoded HDB residential block on livability pillars (1-10).

Reads data/hdb.db (blocks, geocodes, resales) and the layers saved by
download_amenities.py, and writes a `livability` table to data/hdb.db.

Each pillar blends several raw measures. Every measure is converted to a
percentile rank across all scored blocks, the ranks are combined with fixed
weights, and the result is mapped to 1-10. Scores are therefore relative to
other HDB blocks, not absolute standards. Run after build_webapp_db.py.
"""

import bisect
import csv
import json
import os
import pathlib
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request

from build_webapp_db import Median
from geo import PointIndex, distance_m
from transport_model import CBD_POINT, TransportModel

ROOT = pathlib.Path(__file__).parent
DB_FILE = ROOT / "data" / "hdb.db"
AMENITY_DIR = ROOT / "data" / "amenities"
SCHOOL_GEOCODE_CACHE = ROOT / "data" / "school_geocode_cache.csv"
HOSPITAL_GEOCODE_CACHE = ROOT / "data" / "hospital_geocode_cache.csv"
ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search"

LEASE_YEARS = 99
PRIMARY_LEVELS = {"PRIMARY", "MIXED LEVEL (P1-S4)"}
OPEN_HAWKER_STATUSES = {"Existing", "Existing (new)", "Existing (replacement)", "Interim Centre"}
MISSING_MINUTES = 99
NEUTRAL_SCORE = 5.0

# No open dataset lists hospitals, so they're curated here and geocoded once by name.
HOSPITALS = {
    "acute": [
        "Singapore General Hospital", "Changi General Hospital", "KK Women's and Children's Hospital",
        "National University Hospital", "Ng Teng Fong General Hospital", "Khoo Teck Puat Hospital",
        "Tan Tock Seng Hospital", "Sengkang General Hospital", "Alexandra Hospital", "Woodlands Hospital",
        "Mount Elizabeth Hospital", "Mount Elizabeth Novena Hospital", "Gleneagles Hospital",
        "Parkway East Hospital", "Mount Alvernia Hospital", "Raffles Hospital", "Farrer Park Hospital",
        "Thomson Medical Centre",
    ],
    "community": [
        "Ang Mo Kio - Thye Hua Kwan Hospital", "St. Luke's Hospital",
        "Ren Ci Community Hospital", "Yishun Community Hospital", "Outram Community Hospital",
        "Sengkang Community Hospital", "Jurong Community Hospital", "St. Andrew's Community Hospital",
    ],
}

PILLARS = [
    {
        "key": "transport", "label": "Transport",
        "desc": "Minutes to the nearest MRT/LRT walking or by bus, rail lines within 15 min, time to an interchange, "
                "lines at your station, bus services within 400 m",
    },
    {"key": "cbd", "label": "CBD commute", "desc": "Modelled public transport time to Raffles Place, door to door"},
    {"key": "food", "label": "Hawker food", "desc": "Nearest hawker centre, and hawker centres within 1 km"},
    {
        "key": "health", "label": "Healthcare",
        "desc": "Nearest GP and GPs within 1 km, dentists within 1 km, nearest polyclinic, acute hospital "
                "and community hospital",
    },
    {"key": "green", "label": "Green space", "desc": "Nearest park, and parks within 1 km"},
    {"key": "schools", "label": "Schools", "desc": "Primary schools within 1 km and 2 km (MOE registration distances)"},
    {
        "key": "value", "label": "Value",
        "desc": "Block's median $psf over the last 3 years (cheaper scores higher); 5.0 if it had no resales",
    },
    {
        "key": "lease", "label": "Lease",
        "desc": "Years left: 99 minus years since the lease began (from resale records, else year completed)",
    },
]

PERSONAS = [
    {"key": "balanced", "label": "Balanced", "weights": {p["key"]: 1 for p in PILLARS}},
    {
        "key": "family",
        "label": "Young family",
        "weights": {"transport": 1.5, "cbd": 1, "food": 1, "health": 2, "green": 2, "schools": 3, "value": 1.5, "lease": 1.5},
    },
    {
        "key": "commuter",
        "label": "Commuter",
        "weights": {"transport": 3, "cbd": 3, "food": 1.5, "health": 0.5, "green": 0.5, "schools": 0, "value": 1, "lease": 0.5},
    },
    {
        "key": "retiree",
        "label": "Retiree",
        "weights": {"transport": 1.5, "cbd": 0.5, "food": 2.5, "health": 3, "green": 2, "schools": 0, "value": 1, "lease": 0.5},
    },
    {
        "key": "budget",
        "label": "Budget",
        "weights": {"transport": 1.5, "cbd": 0.5, "food": 1, "health": 0.5, "green": 0.5, "schools": 0.5, "value": 3, "lease": 1.5},
    },
]


# ---------- data loading ----------


def load_geojson_points(filename: str, name_of, keep=lambda props: True) -> list[tuple[float, float, str]]:
    features = json.loads((AMENITY_DIR / filename).read_text(encoding="utf-8"))["features"]
    points = []
    for f in features:
        props = f["properties"]
        if f["geometry"]["type"] != "Point" or not keep(props):
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        points.append((float(lat), float(lon), name_of(props)))
    return points


def chas_field(props: dict, field: str) -> str:
    match = re.search(rf"<th>{field}</th>\s*<td>(.*?)</td>", props.get("Description", ""))
    return match.group(1).strip() if match else ""


def onemap_search(search: str) -> list[dict]:
    query = urllib.parse.urlencode({"searchVal": search, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": "1"})
    headers = {"User-Agent": "Mozilla/5.0 (compatible; hdb-explorer/1.0)"}
    if os.environ.get("ONEMAP_API_TOKEN"):
        headers["Authorization"] = os.environ["ONEMAP_API_TOKEN"]
    request = urllib.request.Request(f"{ONEMAP_SEARCH_URL}?{query}", headers=headers)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response).get("results") or []
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2**attempt)
    return []


def name_tokens(text: str) -> set[str]:
    return set(re.sub(r"[^A-Z0-9 ]", "", text.upper().replace("-", " ")).split())


def pick_result(results: list[dict], postal: str | None = None, required: set[str] | None = None) -> dict | None:
    for r in results:
        if postal and r.get("POSTAL") == postal:
            return r
    if required:
        for r in results:
            if required <= name_tokens(f"{r.get('SEARCHVAL', '')} {r.get('BUILDING', '')}"):
                return r
        return None
    return results[0] if results else None


def cached_geocodes(cache_file: pathlib.Path, items: list[dict], key: str, locate) -> dict[str, dict]:
    """Geocode items not yet in the CSV cache (or cached without coordinates), appending as we go."""
    cache = {}
    fields = list(items[0].keys()) + ["latitude", "longitude", "matched"]
    if cache_file.exists():
        with cache_file.open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            cache = {r[key]: r for r in reader}
            fields = reader.fieldnames or fields
    missing = [item for item in items if not cache.get(item[key], {}).get("latitude")]
    if missing:
        print(f"Geocoding {len(missing)} entries for {cache_file.name} via OneMap")
        new_file = not cache_file.exists()
        with cache_file.open("a", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            if new_file:
                writer.writeheader()
            for item in missing:
                result = locate(item)
                row = {
                    **item,
                    "latitude": result["LATITUDE"] if result else "",
                    "longitude": result["LONGITUDE"] if result else "",
                    "matched": result.get("ADDRESS", "") if result else "",
                }
                writer.writerow(row)
                f.flush()
                cache[item[key]] = row
                time.sleep(0.3)
    return cache


def load_primary_schools() -> list[tuple[float, float, str]]:
    with (AMENITY_DIR / "schools.csv").open(encoding="utf-8-sig", newline="") as f:
        schools = [
            {"postal_code": r["postal_code"].strip().zfill(6), "school_name": r["school_name"].strip()}
            for r in csv.DictReader(f)
            if r["mainlevel_code"].strip() in PRIMARY_LEVELS
        ]

    def locate(school):
        # Some schools' postal codes aren't indexed by OneMap; their names usually are.
        return pick_result(onemap_search(school["postal_code"]), postal=school["postal_code"]) or pick_result(
            onemap_search(school["school_name"]), postal=school["postal_code"]
        )

    cache = cached_geocodes(SCHOOL_GEOCODE_CACHE, schools, "postal_code", locate)
    points = [
        (float(c["latitude"]), float(c["longitude"]), s["school_name"])
        for s in schools
        if (c := cache.get(s["postal_code"])) and c.get("latitude")
    ]
    print(f"{len(points)} of {len(schools)} primary schools located")
    return points


def load_hospitals() -> dict[str, list[tuple[float, float, str]]]:
    items = [{"name": name, "kind": kind} for kind, names in HOSPITALS.items() for name in names]

    generic = {"HOSPITAL", "GENERAL", "COMMUNITY", "CENTRE", "ST", "AND"}

    def locate(item):
        # Require every distinctive word so OneMap's fuzzy search can't return a neighbouring building.
        return pick_result(onemap_search(item["name"]), required=name_tokens(item["name"]) - generic)

    cache = cached_geocodes(HOSPITAL_GEOCODE_CACHE, items, "name", locate)
    located = {kind: [] for kind in HOSPITALS}
    for item in items:
        c = cache.get(item["name"])
        if c and c.get("latitude"):
            located[item["kind"]].append((float(c["latitude"]), float(c["longitude"]), item["name"]))
        else:
            print(f"  could not locate {item['name']}")
    print(", ".join(f"{len(v)} {k} hospitals" for k, v in located.items()) + " located")
    return located


# ---------- scoring ----------


def percentile_ranks(values: list[float], higher_is_better: bool) -> list[float]:
    """Mid-rank percentile in [0, 1] for each value (ties share a rank)."""
    ordered = sorted(values)
    n = len(ordered)
    if n < 2:
        return [0.5] * n
    ranks = []
    for v in values:
        mid = (bisect.bisect_left(ordered, v) + bisect.bisect_right(ordered, v) - 1) / 2
        pct = mid / (n - 1)
        ranks.append(pct if higher_is_better else 1 - pct)
    return ranks


def blend(parts: list[tuple[float, list[float]]]) -> list[float]:
    total = sum(w for w, _ in parts)
    return [sum(w * ranks[i] for w, ranks in parts) / total for i in range(len(parts[0][1]))]


def main() -> None:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.create_aggregate("median", 1, Median)

    latest = conn.execute("SELECT MAX(month) FROM transactions").fetchone()[0]
    current_year = int(latest[:4])
    since = f"{current_year - 3}{latest[4:]}"

    blocks = conn.execute(
        """
        SELECT p.unit_id, p.block, p.street_name, p.town, p.year_completed, g.latitude, g.longitude
        FROM property_info p JOIN geocode g ON g.unit_id = p.unit_id
        WHERE p.residential = 'Y' AND g.geocode_status = 'ok' AND g.latitude IS NOT NULL
        """
    ).fetchall()
    block_psf = {
        r["unit_id"]: r["psf"]
        for r in conn.execute("SELECT unit_id, median(price_psf) AS psf FROM transactions WHERE month > ? GROUP BY unit_id", (since,))
    }
    lease_start = {
        r["unit_id"]: r["start"]
        for r in conn.execute("SELECT unit_id, MIN(lease_commence_date) AS start FROM transactions GROUP BY unit_id")
    }

    transport = TransportModel(
        AMENITY_DIR / "mrt_exits.geojson",
        AMENITY_DIR / "station_codes.csv",
        AMENITY_DIR / "bus_stops.json",
        AMENITY_DIR / "bus_services.json",
    )
    if transport.unmatched_exit_stations:
        print("Stations without line codes (ignored for lines/CBD):", transport.unmatched_exit_stations)
    exits = PointIndex(load_geojson_points("mrt_exits.geojson", lambda p: p["STATION_NA"].strip()))
    hawkers = PointIndex(
        load_geojson_points("hawker_centres.geojson", lambda p: p["NAME"].strip(), lambda p: p.get("STATUS") in OPEN_HAWKER_STATUSES)
    )
    gps = PointIndex(
        load_geojson_points("chas_clinics.geojson", lambda p: chas_field(p, "HCI_NAME"), lambda p: chas_field(p, "LICENCE_TYPE") == "MC")
    )
    dentists = PointIndex(
        load_geojson_points("chas_clinics.geojson", lambda p: chas_field(p, "HCI_NAME"), lambda p: chas_field(p, "LICENCE_TYPE") == "MD")
    )
    polyclinics = PointIndex(load_geojson_points("polyclinics.geojson", lambda p: p["NAME"].strip()))
    hospitals = load_hospitals()
    acute = PointIndex(hospitals["acute"])
    community = PointIndex(hospitals["community"])
    parks = PointIndex(load_geojson_points("parks.geojson", lambda p: p["NAME"].strip()))
    schools = PointIndex(load_primary_schools())

    rows = []
    for b in blocks:
        lat, lon = b["latitude"], b["longitude"]
        mrt_d, _ = exits.nearest(lat, lon)
        hawker_d, hawker_name = hawkers.nearest(lat, lon)
        gp_d, gp_name = gps.nearest(lat, lon)
        poly_d, poly_name = polyclinics.nearest(lat, lon)
        acute_d, acute_name = acute.nearest(lat, lon)
        comm_d, comm_name = community.nearest(lat, lon)
        park_d, park_name = parks.nearest(lat, lon)
        school_d, school_name = schools.nearest(lat, lon)
        psf = block_psf.get(b["unit_id"])
        start = lease_start.get(b["unit_id"]) or b["year_completed"]
        rows.append(
            {
                "unit_id": b["unit_id"],
                "block": b["block"],
                "street_name": b["street_name"],
                "town": b["town"],
                "latitude": lat,
                "longitude": lon,
                "nearest_exit_m": round(mrt_d),
                **transport.access(lat, lon),
                "cbd_km": round(distance_m(lat, lon, *CBD_POINT) / 1000, 2),
                "nearest_hawker_m": round(hawker_d),
                "nearest_hawker": hawker_name,
                "hawkers_1km": len(hawkers.within(lat, lon, 1000)),
                "nearest_gp_m": round(gp_d),
                "nearest_gp": gp_name,
                "gps_1km": len(gps.within(lat, lon, 1000)),
                "dentists_1km": len(dentists.within(lat, lon, 1000)),
                "nearest_polyclinic_m": round(poly_d),
                "nearest_polyclinic": poly_name,
                "nearest_hospital_m": round(acute_d),
                "nearest_hospital": acute_name,
                "nearest_community_hospital_m": round(comm_d),
                "nearest_community_hospital": comm_name,
                "nearest_park_m": round(park_d),
                "nearest_park": park_name,
                "parks_1km": len(parks.within(lat, lon, 1000)),
                "nearest_primary_m": round(school_d),
                "nearest_primary": school_name,
                "primary_1km": len(schools.within(lat, lon, 1000)),
                "primary_2km": len(schools.within(lat, lon, 2000)),
                "median_psf": round(psf, 2) if psf else None,
                "lease_left_years": LEASE_YEARS - (current_year - start) if start else None,
            }
        )

    def col(key, missing=None):
        return [r[key] if r[key] is not None else missing for r in rows]

    def rank(key, higher_is_better, missing=None):
        return percentile_ranks(col(key, missing), higher_is_better)

    def rank_known(key, higher_is_better):
        """Percentile ranks among rows that have a value; None where the value is missing."""
        known = [i for i, r in enumerate(rows) if r[key] is not None]
        ranks = percentile_ranks([rows[i][key] for i in known], higher_is_better)
        out = [None] * len(rows)
        for i, pct in zip(known, ranks):
            out[i] = pct
        return out

    station_mrt_lines = [transport.mrt_line_count(r["rail_station"]) for r in rows]
    pillar_pcts = {
        "transport": blend([
            (0.35, rank("rail_min", False)),
            (0.20, rank("lines_15min", True)),
            (0.15, rank("interchange_min", False, MISSING_MINUTES)),
            (0.15, rank("bus_services_400m", True)),
            (0.15, percentile_ranks(station_mrt_lines, True)),
        ]),
        "cbd": rank("cbd_min", False),
        "food": blend([(0.5, rank("nearest_hawker_m", False)), (0.5, rank("hawkers_1km", True))]),
        "health": blend([
            (0.20, rank("nearest_gp_m", False)),
            (0.15, rank("gps_1km", True)),
            (0.05, rank("dentists_1km", True)),
            (0.25, rank("nearest_polyclinic_m", False)),
            (0.25, rank("nearest_hospital_m", False)),
            (0.10, rank("nearest_community_hospital_m", False)),
        ]),
        "green": blend([(0.5, rank("nearest_park_m", False)), (0.5, rank("parks_1km", True))]),
        "schools": blend([
            (1, rank("primary_1km", True)),
            (1, rank("primary_2km", True)),
            (1, rank("nearest_primary_m", False)),
        ]),
        "value": rank_known("median_psf", False),
        "lease": rank("lease_left_years", True, 0),
    }
    for i, row in enumerate(rows):
        for key, pcts in pillar_pcts.items():
            # No resales in 3 years means no price to judge: Value is neutral.
            row[f"score_{key}"] = NEUTRAL_SCORE if pcts[i] is None else round(1 + 9 * pcts[i], 1)

    columns = list(rows[0].keys())
    conn.execute("DROP TABLE IF EXISTS livability")
    conn.execute(f"CREATE TABLE livability ({', '.join(columns)}, PRIMARY KEY (unit_id))")
    conn.executemany(
        f"INSERT INTO livability ({', '.join(columns)}) VALUES ({', '.join('?' * len(columns))})",
        [tuple(r[c] for c in columns) for r in rows],
    )
    conn.execute("CREATE INDEX idx_liv_town ON livability(town)")
    conn.commit()
    conn.close()
    print(f"Scored {len(rows)} blocks on {len(PILLARS)} pillars")


if __name__ == "__main__":
    main()
