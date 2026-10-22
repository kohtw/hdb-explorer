"""Download the HDB Property Information dataset from data.gov.sg.

This dataset lists every HDB block/address in Singapore (not just ones that
have had a resale transaction), with unit-type breakdowns per block. It is
the master list of every HDB building.
"""

import json
import pathlib
import time
import urllib.error
import urllib.request

DATASET_ID = "d_17f5382f26140b1fdae0ba2ef6239d2f"
POLL_DOWNLOAD_URL = f"https://api-open.data.gov.sg/v1/public/api/datasets/{DATASET_ID}/poll-download"
OUTPUT_FILE = pathlib.Path(__file__).parent / "data" / "hdb_property_information.csv"
USER_AGENT = "Mozilla/5.0 (compatible; hdb-resale-downloader/1.0)"


def fetch_json(url: str, retries: int = 5) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < retries - 1:
                time.sleep(2**attempt)
                continue
            raise


def main() -> None:
    OUTPUT_FILE.parent.mkdir(exist_ok=True)

    result = fetch_json(POLL_DOWNLOAD_URL)
    if result["code"] != 0:
        raise RuntimeError(f"poll-download failed: {result['errorMsg']}")

    download_url = result["data"]["url"]
    request = urllib.request.Request(download_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request) as response, OUTPUT_FILE.open("wb") as out_file:
        out_file.write(response.read())

    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
