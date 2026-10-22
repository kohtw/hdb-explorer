"""Score every geocoded HDB residential block on livability pillars (1-10).

Reads data/hdb.db (blocks, geocodes, resales) and the amenity layers saved by
download_amenities.py, and writes a `livability` table to data/hdb.db.

Each pillar's raw measures (straight-line distance to the nearest amenity,
counts within a radius, $psf, lease left) are converted to percentile ranks
across all scored blocks, then mapped to 1-10. Scores are therefore relative
to other HDB blocks, not absolute standards. Run after build_webapp_db.py.
"""

import bisect
import csv
import json
import math
import os
import pathlib
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

from build_webapp_db import Median

ROOT = pathlib.Path(__file__).parent
DB_FILE = ROOT / "data" / "hdb.db"
AMENITY_DIR = ROOT / "data" / "amenities"
SCHOOL_GEOCODE_CACHE = ROOT / "data" / "school_geocode_cache.csv"
ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search"

CBD = (1.2840, 103.8514)  # Raffles Place MRT
LEASE_YEARS = 99
PRIMARY_LEVELS = {"PRIMARY", "MIXED LEVEL (P1-S4)"}
OPEN_HAWKER_STATUSES = {"Existing", "Existing (new)", "Existing (replacement)", "Interim Centre"}

PILLARS = [
    {"key": "transport", "label": "Transport", "desc": "Walk to the nearest MRT/LRT exit, and stations within 1 km"},
    {"key": "cbd", "label": "CBD access", "desc": "Straight-line distance to Raffles Place"},
    {"key": "food", "label": "Hawker food", "desc": "Nearest hawker centre, and hawker centres within 1 km"},
    {"key": "health", "label": "Healthcare", "desc": "Nearest CHAS clinic, and CHAS clinics within 1 km"},
    {"key": "green", "label": "Green space", "desc": "Nearest park, and parks within 1 km"},
    {"key": "schools", "label": "Schools", "desc": "Primary schools within 1 km and 2 km (MOE registration distances)"},
    {"key": "value", "label": "Value", "desc": "Block's median $psf over the last 3 years (cheaper scores higher)"},
    {"key": "lease", "label": "Lease", "desc": "Years left on the 99-year lease"},
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

M_PER_DEG_LAT = 110_574
M_PER_DEG_LON = 111_320 * math.cos(math.radians(1.35))


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Equirectangular approximation; error is negligible across Singapore.
    return math.hypot((lat2 - lat1) * M_PER_DEG_LAT, (lon2 - lon1) * M_PER_DEG_LON)


class PointIndex:
    """Grid index of (lat, lon, name) points for radius counts and nearest lookups."""

    CELL_DEG = 0.01
    CELL_M = CELL_DEG * min(M_PER_DEG_LAT, M_PER_DEG_LON)

    def __init__(self, points: list[tuple[float, float, str]]):
        self.points = points
        self.cells = defaultdict(list)
        for p in points:
            self.cells[self._cell(p[0], p[1])].append(p)

    def _cell(self, lat: float, lon: float) -> tuple[int, int]:
        return int(lat // self.CELL_DEG), int(lon // self.CELL_DEG)

    def _ring(self, cy: int, cx: int, k: int):
        for y in range(cy - k, cy + k + 1):
            for x in range(cx - k, cx + k + 1):
                if max(abs(y - cy), abs(x - cx)) == k:
                    yield from self.cells.get((y, x), ())

    def within(self, lat: float, lon: float, radius_m: float) -> list[tuple[float, str]]:
        cy, cx = self._cell(lat, lon)
        k_max = math.ceil(radius_m / self.CELL_M)
        found = []
        for k in range(k_max + 1):
            for p in self._ring(cy, cx, k):
                d = distance_m(lat, lon, p[0], p[1])
                if d <= radius_m:
                    found.append((d, p[2]))
        return found

    def nearest(self, lat: float, lon: float) -> tuple[float, str]:
        cy, cx = self._cell(lat, lon)
        best = (math.inf, "")
        for k in range(60):
            for p in self._ring(cy, cx, k):
                d = distance_m(lat, lon, p[0], p[1])
                if d < best[0]:
                    best = (d, p[2])
            # Every point within k cells' distance has now been checked.
            if best[0] <= k * self.CELL_M:
                return best
        return best


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


def chas_name(props: dict) -> str:
    match = re.search(r"<th>HCI_NAME</th>\s*<td>(.*?)</td>", props.get("Description", ""))
    return match.group(1).strip() if match else "CHAS clinic"


def onemap_search(search: str, postal: str | None = None) -> tuple[float, float] | None:
    """First OneMap match for a search string, preferring one whose postal code matches."""
    query = urllib.parse.urlencode({"searchVal": search, "returnGeom": "Y", "getAddrDetails": "Y", "pageNum": "1"})
    headers = {"User-Agent": "Mozilla/5.0 (compatible; hdb-explorer/1.0)"}
    if os.environ.get("ONEMAP_API_TOKEN"):
        headers["Authorization"] = os.environ["ONEMAP_API_TOKEN"]
    request = urllib.request.Request(f"{ONEMAP_SEARCH_URL}?{query}", headers=headers)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                results = json.load(response).get("results") or []
            break
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2**attempt)
    else:
        return None
    for r in results:
        if postal and r.get("POSTAL") == postal:
            return float(r["LATITUDE"]), float(r["LONGITUDE"])
    return (float(results[0]["LATITUDE"]), float(results[0]["LONGITUDE"])) if results else None


def geocode_school(name: str, postal: str) -> tuple[float, float] | None:
    # Some schools' postal codes aren't indexed by OneMap; their names usually are.
    return onemap_search(postal, postal) or onemap_search(name, postal)


def load_primary_schools() -> list[tuple[float, float, str]]:
    """Primary schools with coordinates, geocoding new postal codes via OneMap (cached)."""
    with (AMENITY_DIR / "schools.csv").open(encoding="utf-8-sig", newline="") as f:
        schools = [r for r in csv.DictReader(f) if r["mainlevel_code"].strip() in PRIMARY_LEVELS]

    cache = {}
    if SCHOOL_GEOCODE_CACHE.exists():
        with SCHOOL_GEOCODE_CACHE.open(encoding="utf-8", newline="") as f:
            cache = {r["postal_code"]: r for r in csv.DictReader(f)}

    missing = [s for s in schools if not cache.get(s["postal_code"].strip().zfill(6), {}).get("latitude")]
    if missing:
        print(f"Geocoding {len(missing)} schools via OneMap")
        new_file = not SCHOOL_GEOCODE_CACHE.exists()
        with SCHOOL_GEOCODE_CACHE.open("a", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["postal_code", "school_name", "latitude", "longitude"])
            if new_file:
                writer.writeheader()
            for s in missing:
                postal = s["postal_code"].strip().zfill(6)
                coords = geocode_school(s["school_name"].strip(), postal)
                row = {
                    "postal_code": postal,
                    "school_name": s["school_name"].strip(),
                    "latitude": coords[0] if coords else "",
                    "longitude": coords[1] if coords else "",
                }
                writer.writerow(row)
                f.flush()
                cache[postal] = row
                time.sleep(0.3)

    points = []
    for s in schools:
        row = cache.get(s["postal_code"].strip().zfill(6))
        if row and row["latitude"]:
            points.append((float(row["latitude"]), float(row["longitude"]), s["school_name"].strip()))
    print(f"{len(points)} of {len(schools)} primary schools located")
    return points


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
        for r in conn.execute(
            "SELECT unit_id, median(price_psf) AS psf FROM transactions WHERE month > ? GROUP BY unit_id", (since,)
        )
    }
    town_psf = {
        r["town"]: r["psf"]
        for r in conn.execute("SELECT town, median(price_psf) AS psf FROM transactions WHERE month > ? GROUP BY town", (since,))
    }
    lease_start = {
        r["unit_id"]: r["start"]
        for r in conn.execute("SELECT unit_id, MIN(lease_commence_date) AS start FROM transactions GROUP BY unit_id")
    }

    mrt = PointIndex(load_geojson_points("mrt_exits.geojson", lambda p: p["STATION_NA"].strip()))
    hawkers = PointIndex(
        load_geojson_points(
            "hawker_centres.geojson", lambda p: p["NAME"].strip(), lambda p: p.get("STATUS") in OPEN_HAWKER_STATUSES
        )
    )
    clinics = PointIndex(load_geojson_points("chas_clinics.geojson", chas_name))
    parks = PointIndex(load_geojson_points("parks.geojson", lambda p: p["NAME"].strip()))
    schools = PointIndex(load_primary_schools())

    rows = []
    for b in blocks:
        lat, lon = b["latitude"], b["longitude"]
        mrt_d, mrt_name = mrt.nearest(lat, lon)
        hawker_d, hawker_name = hawkers.nearest(lat, lon)
        clinic_d, clinic_name = clinics.nearest(lat, lon)
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
                "nearest_mrt_m": round(mrt_d),
                "nearest_mrt": mrt_name,
                "stations_1km": len({name for _, name in mrt.within(lat, lon, 1000)}),
                "cbd_km": round(distance_m(lat, lon, *CBD) / 1000, 2),
                "nearest_hawker_m": round(hawker_d),
                "nearest_hawker": hawker_name,
                "hawkers_1km": len(hawkers.within(lat, lon, 1000)),
                "nearest_clinic_m": round(clinic_d),
                "nearest_clinic": clinic_name,
                "clinics_1km": len(clinics.within(lat, lon, 1000)),
                "nearest_park_m": round(park_d),
                "nearest_park": park_name,
                "parks_1km": len(parks.within(lat, lon, 1000)),
                "nearest_primary_m": round(school_d),
                "nearest_primary": school_name,
                "primary_1km": len(schools.within(lat, lon, 1000)),
                "primary_2km": len(schools.within(lat, lon, 2000)),
                "median_psf": round(psf or town_psf.get(b["town"]) or 0, 2),
                "psf_source": "block" if psf else "town",
                "lease_left_years": LEASE_YEARS - (current_year - start) if start else None,
            }
        )

    def col(key):
        return [r[key] for r in rows]

    def avg(*lists):
        return [sum(vals) / len(vals) for vals in zip(*lists)]

    lease_values = [v if v is not None else 0 for v in col("lease_left_years")]
    pillar_pcts = {
        "transport": avg(percentile_ranks(col("nearest_mrt_m"), False), percentile_ranks(col("stations_1km"), True)),
        "cbd": percentile_ranks(col("cbd_km"), False),
        "food": avg(percentile_ranks(col("nearest_hawker_m"), False), percentile_ranks(col("hawkers_1km"), True)),
        "health": avg(percentile_ranks(col("nearest_clinic_m"), False), percentile_ranks(col("clinics_1km"), True)),
        "green": avg(percentile_ranks(col("nearest_park_m"), False), percentile_ranks(col("parks_1km"), True)),
        "schools": avg(
            percentile_ranks(col("primary_1km"), True),
            percentile_ranks(col("primary_2km"), True),
            percentile_ranks(col("nearest_primary_m"), False),
        ),
        "value": percentile_ranks(col("median_psf"), False),
        "lease": percentile_ranks(lease_values, True),
    }
    for i, row in enumerate(rows):
        for key, pcts in pillar_pcts.items():
            row[f"score_{key}"] = round(1 + 9 * pcts[i], 1)

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
