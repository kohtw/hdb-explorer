"""Combine the HDB resale flat price CSVs into one standardised table.

Reads every CSV in data/ (produced by download_hdb_resale_data.py), aligns
their columns, derives a consistent remaining_lease_months figure for all
rows (older files don't report remaining lease), and writes the result to
data/combined_resale_flat_prices.csv.
"""

import csv
import pathlib
import re

DATA_DIR = pathlib.Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "combined_resale_flat_prices.csv"
LEASE_YEARS = 99

COLUMNS = [
    "month",
    "town",
    "flat_type",
    "block",
    "street_name",
    "storey_range",
    "floor_area_sqm",
    "flat_model",
    "lease_commence_date",
    "remaining_lease_months",
    "resale_price",
]

REMAINING_LEASE_PATTERN = re.compile(r"(\d+)\s*years?(?:\s*(\d+)\s*months?)?")


def parse_remaining_lease_months(value: str) -> int:
    if value.strip().isdigit():
        return int(value) * 12

    match = REMAINING_LEASE_PATTERN.search(value)
    years = int(match.group(1))
    months = int(match.group(2)) if match.group(2) else 0
    return years * 12 + months


def derive_remaining_lease_months(month: str, lease_commence_date: str) -> int:
    transaction_year = int(month.split("-")[0])
    remaining_years = LEASE_YEARS - (transaction_year - int(lease_commence_date))
    return remaining_years * 12


def standardise_flat_type(flat_type: str) -> str:
    return flat_type.replace("MULTI GENERATION", "MULTI-GENERATION")


def standardise_row(row: dict) -> dict:
    if "remaining_lease" in row:
        remaining_lease_months = parse_remaining_lease_months(row["remaining_lease"])
    else:
        remaining_lease_months = derive_remaining_lease_months(
            row["month"], row["lease_commence_date"]
        )

    return {
        "month": row["month"],
        "town": row["town"],
        "flat_type": standardise_flat_type(row["flat_type"]),
        "block": row["block"],
        "street_name": row["street_name"],
        "storey_range": row["storey_range"],
        "floor_area_sqm": row["floor_area_sqm"],
        "flat_model": row["flat_model"],
        "lease_commence_date": row["lease_commence_date"],
        "remaining_lease_months": remaining_lease_months,
        "resale_price": row["resale_price"],
    }


def main() -> None:
    source_files = sorted(DATA_DIR.glob("Resale*.csv"))

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8") as out_file:
        writer = csv.DictWriter(out_file, fieldnames=COLUMNS)
        writer.writeheader()

        row_count = 0
        for source_file in source_files:
            with source_file.open(newline="", encoding="utf-8") as in_file:
                reader = csv.DictReader(in_file)
                for row in reader:
                    writer.writerow(standardise_row(row))
                    row_count += 1
            print(f"Processed {source_file.name}")

        print(f"Wrote {row_count} rows to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
