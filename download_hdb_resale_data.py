"""Download all HDB resale flat price datasets from data.gov.sg.

Fetches the current list of child datasets in the "Resale Flat Prices"
collection (collection id 189), then downloads each one's CSV file.
"""

import json
import pathlib
import time
import urllib.error
import urllib.request

COLLECTION_ID = "189"
COLLECTION_METADATA_URL = (
    f"https://api-production.data.gov.sg/v2/public/api/collections/{COLLECTION_ID}/metadata"
)
POLL_DOWNLOAD_URL = "https://api-open.data.gov.sg/v1/public/api/datasets/{dataset_id}/poll-download"
OUTPUT_DIR = pathlib.Path(__file__).parent / "data"


USER_AGENT = "Mozilla/5.0 (compatible; hdb-resale-downloader/1.0)"


def fetch_json(url: str, retries: int = 5) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 429 and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise


def get_dataset_ids() -> list[str]:
    metadata = fetch_json(COLLECTION_METADATA_URL)
    return metadata["data"]["collectionMetadata"]["childDatasets"]


def get_download_url(dataset_id: str) -> str:
    result = fetch_json(POLL_DOWNLOAD_URL.format(dataset_id=dataset_id))
    if result["code"] != 0:
        raise RuntimeError(f"poll-download failed for {dataset_id}: {result['errorMsg']}")
    return result["data"]["url"]


def download_file(url: str, destination: pathlib.Path) -> None:
    with urllib.request.urlopen(url) as response, destination.open("wb") as out_file:
        out_file.write(response.read())


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)

    dataset_ids = get_dataset_ids()
    print(f"Found {len(dataset_ids)} dataset(s) in collection {COLLECTION_ID}")

    for index, dataset_id in enumerate(dataset_ids):
        if index > 0:
            time.sleep(3)
        print(f"Downloading {dataset_id}...")
        download_url = get_download_url(dataset_id)
        filename = download_url.split("filename%3D%22")[-1].split("%22")[0]
        if not filename or filename == download_url:
            filename = f"{dataset_id}.csv"
        destination = OUTPUT_DIR / filename
        download_file(download_url, destination)
        print(f"  Saved to {destination}")


if __name__ == "__main__":
    main()
