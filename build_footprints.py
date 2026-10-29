"""Load HDB building outlines into data/hdb.db for the web app's map.

Reads data/amenities/hdb_buildings.geojson (HDB Existing Building footprints,
saved by download_amenities.py), matches each outline to a block by postal
code, simplifies it, and writes a `footprints` table:

  footprints  unit_id, bounding box, rings as JSON [[[lat, lon], ...], ...]

Blocks without an outline keep their dot on the map. Run after
download_amenities.py.
"""

import json
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).parent
DB_FILE = ROOT / "data" / "hdb.db"
FOOTPRINT_FILE = ROOT / "data" / "amenities" / "hdb_buildings.geojson"
SIMPLIFY_DEG = 8e-6  # about 0.9 m; drops points that don't change the outline's shape
DECIMALS = 6


def simplify(points: list[list[float]], tolerance: float) -> list[list[float]]:
    """Douglas-Peucker on a list of [x, y] points (iterative, keeps both ends)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = points[a], points[b]
        dx, dy = bx - ax, by - ay
        length = (dx * dx + dy * dy) ** 0.5
        best, best_i = 0.0, None
        for i in range(a + 1, b):
            px, py = points[i]
            if length:
                d = abs(dy * (px - ax) - dx * (py - ay)) / length
            else:
                d = ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            if d > best:
                best, best_i = d, i
        if best_i is not None and best > tolerance:
            keep[best_i] = True
            stack += [(a, best_i), (best_i, b)]
    return [p for p, k in zip(points, keep) if k]


def outer_rings(geometry: dict) -> list[list[list[float]]]:
    """Each polygon's outer ring; inner rings (courtyards) are dropped for a cleaner outline."""
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"][0]]
    return [polygon[0] for polygon in geometry["coordinates"]]


def main() -> None:
    conn = sqlite3.connect(DB_FILE)
    by_postal = {
        postal: unit_id
        for unit_id, postal in conn.execute("SELECT unit_id, postal_code FROM geocode WHERE geocode_status = 'ok'")
        if postal
    }
    features = json.loads(FOOTPRINT_FILE.read_text(encoding="utf-8"))["features"]

    rows, vertices_in, vertices_out = [], 0, 0
    for f in features:
        unit_id = by_postal.get(str(f["properties"].get("POSTAL_COD") or "").zfill(6))
        if not unit_id or not f.get("geometry"):
            continue
        rings = []
        for ring in outer_rings(f["geometry"]):
            vertices_in += len(ring)
            small = simplify([p[:2] for p in ring], SIMPLIFY_DEG)
            vertices_out += len(small)
            rings.append([[round(lat, DECIMALS), round(lon, DECIMALS)] for lon, lat in small])
        lats = [p[0] for r in rings for p in r]
        lons = [p[1] for r in rings for p in r]
        rows.append((unit_id, min(lats), max(lats), min(lons), max(lons), json.dumps(rings, separators=(",", ":"))))

    conn.execute("DROP TABLE IF EXISTS footprints")
    conn.execute(
        """
        CREATE TABLE footprints (
            unit_id TEXT PRIMARY KEY, min_lat REAL, max_lat REAL, min_lon REAL, max_lon REAL, rings TEXT
        )
        """
    )
    conn.executemany("INSERT OR REPLACE INTO footprints VALUES (?, ?, ?, ?, ?, ?)", rows)
    conn.execute("CREATE INDEX idx_footprint_box ON footprints(min_lat, min_lon)")
    conn.commit()
    conn.close()
    print(f"Outlines for {len(rows)} of {len(by_postal)} geocoded blocks; "
          f"{vertices_in:,} vertices simplified to {vertices_out:,}")


if __name__ == "__main__":
    main()
