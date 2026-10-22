"""Download the amenity and transport datasets used for livability scores.

Saves to data/amenities/. Most come from data.gov.sg. Bus stops and routes
come from busrouter.sg, which republishes LTA DataMall's bus data as open
JSON (DataMall itself needs an API key). The MOE schools list only has postal
codes and is geocoded by build_livability.py.
"""

import json
import pathlib
import time
import urllib.error
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


if __name__ == "__main__":
    main()
