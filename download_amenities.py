"""Download the amenity and transport datasets used for livability scores.

Saves to data/amenities/. Most come from data.gov.sg. Bus stops and routes
come from busrouter.sg, which republishes LTA DataMall's bus data as open
JSON (DataMall itself needs an API key). Supermarkets, malls and food courts
come from OpenStreetMap via the Overpass API, since data.gov.sg no longer
publishes them. The MOE schools list only has postal codes and is geocoded by
build_livability.py.
"""

import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

DATASETS = {
    "mrt_exits.geojson": "d_b39d3a0871985372d7e1637193335da5",  # LTA MRT/LRT station exits
    "hawker_centres.geojson": "d_4a086da0a5553be1d89383cd90d07ecd",  # NEA
    "chas_clinics.geojson": "d_548c33ea2d99e29ec63a7cc9edcccedc",  # MOH CHAS clinics
    "parks.geojson": "d_0542d48f0991541706b58059381a6eca",  # NParks parks (points)
    "schools.csv": "d_688b934f82c1059ed0a6993d2a829089",  # MOE general information of schools
    "polyclinics.geojson": "d_3ca2a28059588f297908b32da4ac3cbe",  # HPB polyclinic locations
    "station_codes.csv": "d_d312a5b127e1ae74299b8ae664cedd4e",  # LTA station codes and lines
}
EXTERNAL = {
    "bus_stops.json": "https://data.busrouter.sg/v1/stops.min.json",
    "bus_services.json": "https://data.busrouter.sg/v1/services.min.json",
}
POLL_DOWNLOAD_URL = "https://api-open.data.gov.sg/v1/public/api/datasets/{dataset_id}/poll-download"
OUTPUT_DIR = pathlib.Path(__file__).parent / "data" / "amenities"
USER_AGENT = "Mozilla/5.0 (compatible; hdb-resale-downloader/1.0)"

# Public Overpass servers are often at capacity, so try each in turn with backoff.
# overpass-api.de rejects browser-like User-Agents (HTTP 406), so it gets a plain one.
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OVERPASS_USER_AGENT = "hdb-explorer/1.0 (Singapore HDB resale explorer)"
OSM_KINDS = {"supermarket": '["shop"="supermarket"]', "mall": '["shop"="mall"]', "food_court": '["amenity"="food_court"]'}
OSM_QUERY = (
    '[out:json][timeout:120];area["ISO3166-1"="SG"][admin_level=2]->.sg;('
    + "".join(f"nwr{tag}(area.sg);" for tag in OSM_KINDS.values())
    + ");out center tags;"
)


def fetch_osm_places() -> list[dict]:
    """Supermarkets, malls and food courts in Singapore as {kind, name, brand, lat, lon}."""
    body = urllib.parse.urlencode({"data": OSM_QUERY}).encode()
    for attempt in range(8):
        url = OVERPASS_URLS[attempt % len(OVERPASS_URLS)]
        try:
            request = urllib.request.Request(url, data=body, headers={"User-Agent": OVERPASS_USER_AGENT})
            with urllib.request.urlopen(request, timeout=180) as response:
                elements = json.load(response)["elements"]
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"  Overpass {url} failed ({error}); retrying")
            time.sleep(min(60, 5 * 2**attempt))
    else:
        raise RuntimeError("All Overpass servers failed")

    places = []
    for e in elements:
        tags = e.get("tags", {})
        point = e if "lat" in e else e.get("center")
        name = tags.get("name") or tags.get("brand")
        if not point or not name:
            continue
        kind = "supermarket" if tags.get("shop") == "supermarket" else "mall" if tags.get("shop") == "mall" else "food_court"
        places.append(
            {"kind": kind, "name": name.strip(), "brand": tags.get("brand", ""), "lat": point["lat"], "lon": point["lon"]}
        )
    return places


def fetch(url: str, retries: int = 6) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < retries - 1:
                time.sleep(2**attempt)
                continue
            raise


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, (filename, dataset_id) in enumerate(DATASETS.items()):
        if index:
            time.sleep(3)
        poll = json.loads(fetch(POLL_DOWNLOAD_URL.format(dataset_id=dataset_id)))
        if poll["code"] != 0:
            raise RuntimeError(f"poll-download failed for {dataset_id}: {poll['errorMsg']}")
        body = fetch(poll["data"]["url"])
        (OUTPUT_DIR / filename).write_bytes(body)
        print(f"Saved {filename} ({len(body):,} bytes)")
    for filename, url in EXTERNAL.items():
        body = fetch(url)
        (OUTPUT_DIR / filename).write_bytes(body)
        print(f"Saved {filename} ({len(body):,} bytes)")
    # A snapshot is committed to git, so a busy Overpass server doesn't fail the build.
    osm_file = OUTPUT_DIR / "osm_places.json"
    try:
        places = fetch_osm_places()
    except RuntimeError:
        if not osm_file.exists():
            raise
        print("Overpass unavailable; keeping the existing osm_places.json")
        return
    osm_file.write_text(json.dumps(places, indent=0), encoding="utf-8")
    counts = {k: sum(p["kind"] == k for p in places) for k in OSM_KINDS}
    print(f"Saved osm_places.json ({', '.join(f'{n} {k}' for k, n in counts.items())})")


if __name__ == "__main__":
    main()
