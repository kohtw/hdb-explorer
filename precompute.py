"""Precompute the web app's fixed, unfiltered responses into data/hdb.db.

Render's free instance has a fraction of a CPU and loses its in-memory cache
whenever it sleeps, so pages like Insights took minutes on first visit. This
runs every fixed view once at build time and saves the JSON in a
`precomputed` table, which app.py loads on startup.

Run after build_webapp_db.py.
"""

import json
import sqlite3
import time
import urllib.parse

import app as webapp
from build_webapp_db import GEOCODE_CACHE_FILE


def main() -> None:
    conn = sqlite3.connect(webapp.DB_FILE)
    conn.execute("DROP TABLE IF EXISTS precomputed")
    flat_types = [r[0] for r in conn.execute("SELECT DISTINCT flat_type FROM transactions ORDER BY flat_type")]
    conn.close()
    webapp._cache.clear()

    paths = ["/api/meta", "/api/overview", "/api/summary", "/api/map", "/api/towns", "/api/livability/meta"]
    paths += [f"/api/livability/towns?persona={p['key']}" for p in webapp.PERSONAS]
    for flat_type in flat_types:
        q = urllib.parse.quote(flat_type)
        paths += [f"/api/towns?flat_type={q}", f"/api/insights?flat_type={q}"]

    client = webapp.app.test_client()
    for path in paths:
        start = time.time()
        response = client.get(path)
        if response.status_code != 200:
            raise RuntimeError(f"{path} returned {response.status_code}")
        print(f"  {path} ({time.time() - start:.1f}s)")

    rows = [(key, json.dumps(value)) for key, value in webapp._cache.items()]
    if GEOCODE_CACHE_FILE.exists():
        rows.append((webapp.GEOCODE_SIZE_KEY, json.dumps(GEOCODE_CACHE_FILE.stat().st_size)))

    conn = sqlite3.connect(webapp.DB_FILE)
    conn.execute("CREATE TABLE precomputed (key TEXT PRIMARY KEY, body TEXT)")
    conn.executemany("INSERT INTO precomputed VALUES (?, ?)", rows)
    conn.commit()
    conn.close()
    print(f"Saved {len(rows)} precomputed responses")


if __name__ == "__main__":
    main()
