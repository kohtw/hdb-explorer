"""Build the master table of every HDB unit/block in Singapore.

Reads data/hdb_property_information.csv (every HDB block, regardless of
resale history), standardises it, maps HDB's town abbreviation codes to full
town names, and geocodes every address via OneMap (postal code, lat/long),
caching progress in data/address_geocode_cache.csv so the run is resumable.

Writes data/units.csv: one row per physical HDB block.
"""

import csv
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

DATA_DIR = pathlib.Path(__file__).parent / "data"
PROPERTY_INFO_FILE = DATA_DIR / "hdb_property_information.csv"
GEOCODE_CACHE_FILE = DATA_DIR / "address_geocode_cache.csv"
UNITS_FILE = DATA_DIR / "units.csv"

ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search"
REQUEST_DELAY_SECONDS = 0.3

GEOCODE_CACHE_COLUMNS = [
    "unit_id",
    "block",
    "street_name",
    "postal_code",
    "latitude",
    "longitude",
    "geocode_status",
]

# HDB's bldg_contract_town codes, mapped to the town names used by the
# resale flat price dataset so the two can be joined on `town`.
TOWN_CODE_TO_NAME = {
    "AMK": "ANG MO KIO",
    "BB": "BUKIT BATOK",
    "BD": "BEDOK",
    "BH": "BISHAN",
    "BM": "BUKIT MERAH",
    "BP": "BUKIT PANJANG",
    "BT": "BUKIT TIMAH",
    "CCK": "CHOA CHU KANG",
    "CL": "CLEMENTI",
    "CT": "CENTRAL AREA",
    "GL": "GEYLANG",
    "HG": "HOUGANG",
    "JE": "JURONG EAST",
    "JW": "JURONG WEST",
    "KWN": "KALLANG/WHAMPOA",
    "MP": "MARINE PARADE",
    "PG": "PUNGGOL",
    "PRC": "PASIR RIS",
    "QT": "QUEENSTOWN",
    "SB": "SEMBAWANG",
    "SGN": "SERANGOON",
    "SK": "SENGKANG",
    "TAP": "TAMPINES",
    "TG": "TENGAH",
    "TP": "TOA PAYOH",
    "WL": "WOODLANDS",
    "YS": "YISHUN",
}

UNITS_COLUMNS = [
    "unit_id",
    "block",
    "street_name",
    "town",
    "max_floor_lvl",
    "year_completed",
    "residential",
    "commercial",
    "market_hawker",
    "miscellaneous",
    "multistorey_carpark",
    "precinct_pavilion",
    "total_dwelling_units",
    "1room_sold",
    "2room_sold",
    "3room_sold",
    "4room_sold",
    "5room_sold",
    "exec_sold",
    "multigen_sold",
    "studio_apartment_sold",
    "1room_rental",
    "2room_rental",
    "3room_rental",
    "other_room_rental",
    "postal_code",
    "latitude",
    "longitude",
    "geocode_status",
]


def unit_id_for(block: str, street_name: str) -> str:
    return f"{block}|{street_name}"


def load_geocode_cache() -> dict:
    cache = {}
    if GEOCODE_CACHE_FILE.exists():
        with GEOCODE_CACHE_FILE.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                cache[row["unit_id"]] = row
    return cache


def geocode_address(block: str, street_name: str) -> dict:
    query = urllib.parse.urlencode(
        {
            "searchVal": f"{block} {street_name}",
            "returnGeom": "Y",
            "getAddrDetails": "Y",
            "pageNum": "1",
        }
    )
    headers = {}
    token = os.environ.get("ONEMAP_API_TOKEN")
    if token:
        headers["Authorization"] = token

    request = urllib.request.Request(f"{ONEMAP_SEARCH_URL}?{query}", headers=headers)

    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.load(response)
            break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
            time.sleep(2**attempt)
    else:
        return {"postal_code": "", "latitude": "", "longitude": "", "geocode_status": "request_failed"}

    results = payload.get("results") or []
    if not results:
        return {"postal_code": "", "latitude": "", "longitude": "", "geocode_status": "not_found"}

    match = results[0]
    return {
        "postal_code": match.get("POSTAL", ""),
        "latitude": match.get("LATITUDE", ""),
        "longitude": match.get("LONGITUDE", ""),
        "geocode_status": "ok",
    }


def load_property_info() -> list[dict]:
    with PROPERTY_INFO_FILE.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def update_geocode_cache(blocks: list[dict]) -> dict:
    cache = load_geocode_cache()
    missing = [
        row
        for row in blocks
        if unit_id_for(row["blk_no"], row["street"]) not in cache
    ]

    print(f"{len(blocks)} HDB blocks, {len(missing)} need geocoding")

    with GEOCODE_CACHE_FILE.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=GEOCODE_CACHE_COLUMNS)
        if f.tell() == 0:
            writer.writeheader()

        for index, row in enumerate(missing):
            block, street_name = row["blk_no"], row["street"]
            result = geocode_address(block, street_name)
            uid = unit_id_for(block, street_name)
            cache_row = {"unit_id": uid, "block": block, "street_name": street_name, **result}
            writer.writerow(cache_row)
            f.flush()
            cache[uid] = cache_row

            if (index + 1) % 100 == 0:
                print(f"  geocoded {index + 1}/{len(missing)}")
            time.sleep(REQUEST_DELAY_SECONDS)

    return cache


def write_units_file(blocks: list[dict], cache: dict) -> None:
    with UNITS_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=UNITS_COLUMNS)
        writer.writeheader()

        for row in blocks:
            block, street_name = row["blk_no"], row["street"]
            uid = unit_id_for(block, street_name)
            geocode = cache.get(uid, {})
            town_code = row["bldg_contract_town"].strip().upper()

            writer.writerow(
                {
                    "unit_id": uid,
                    "block": block,
                    "street_name": street_name,
                    "town": TOWN_CODE_TO_NAME.get(town_code, town_code),
                    "max_floor_lvl": row["max_floor_lvl"],
                    "year_completed": row["year_completed"],
                    "residential": row["residential"],
                    "commercial": row["commercial"],
                    "market_hawker": row["market_hawker"],
                    "miscellaneous": row["miscellaneous"],
                    "multistorey_carpark": row["multistorey_carpark"],
                    "precinct_pavilion": row["precinct_pavilion"],
                    "total_dwelling_units": row["total_dwelling_units"],
                    "1room_sold": row["1room_sold"],
                    "2room_sold": row["2room_sold"],
                    "3room_sold": row["3room_sold"],
                    "4room_sold": row["4room_sold"],
                    "5room_sold": row["5room_sold"],
                    "exec_sold": row["exec_sold"],
                    "multigen_sold": row["multigen_sold"],
                    "studio_apartment_sold": row["studio_apartment_sold"],
                    "1room_rental": row["1room_rental"],
                    "2room_rental": row["2room_rental"],
                    "3room_rental": row["3room_rental"],
                    "other_room_rental": row["other_room_rental"],
                    "postal_code": geocode.get("postal_code", ""),
                    "latitude": geocode.get("latitude", ""),
                    "longitude": geocode.get("longitude", ""),
                    "geocode_status": geocode.get("geocode_status", "missing"),
                }
            )

    print(f"Wrote {len(blocks)} units to {UNITS_FILE}")


def main() -> None:
    blocks = load_property_info()
    cache = update_geocode_cache(blocks)
    write_units_file(blocks, cache)


if __name__ == "__main__":
    main()
