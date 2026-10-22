"""Enrich cleaned HDB resale transactions with derived fields and geocode.

Reads data/cleaned_resale_flat_prices.csv and data/units.csv (the master
list of every HDB block, built by build_units_master.py), derives
transaction_year, transaction_month, flat_age_years, and price_per_sqft, and
joins in each transaction's postal code / lat / long via unit_id.

Writes data/enriched_resale_flat_prices.csv.
"""

import csv
import pathlib

DATA_DIR = pathlib.Path(__file__).parent / "data"
CLEANED_FILE = DATA_DIR / "cleaned_resale_flat_prices.csv"
UNITS_FILE = DATA_DIR / "units.csv"
ENRICHED_FILE = DATA_DIR / "enriched_resale_flat_prices.csv"

SQM_TO_SQFT = 10.7639

OUTPUT_COLUMNS = [
    "month",
    "transaction_year",
    "transaction_month",
    "town",
    "flat_type",
    "block",
    "street_name",
    "unit_id",
    "storey_range",
    "floor_area_sqm",
    "flat_model",
    "lease_commence_date",
    "flat_age_years",
    "remaining_lease_months",
    "resale_price",
    "price_per_sqft",
    "postal_code",
    "latitude",
    "longitude",
]


def load_units() -> dict:
    with UNITS_FILE.open(newline="", encoding="utf-8") as f:
        return {row["unit_id"]: row for row in csv.DictReader(f)}


def main() -> None:
    units = load_units()
    unmatched = 0

    with CLEANED_FILE.open(newline="", encoding="utf-8") as in_file, ENRICHED_FILE.open(
        "w", newline="", encoding="utf-8"
    ) as out_file:
        reader = csv.DictReader(in_file)
        writer = csv.DictWriter(out_file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()

        row_count = 0
        for row in reader:
            year, month_num = row["month"].split("-")
            uid = f"{row['block']}|{row['street_name']}"
            unit = units.get(uid)
            if unit is None:
                unmatched += 1
            floor_area_sqft = float(row["floor_area_sqm"]) * SQM_TO_SQFT

            writer.writerow(
                {
                    "month": row["month"],
                    "transaction_year": year,
                    "transaction_month": month_num,
                    "town": row["town"],
                    "flat_type": row["flat_type"],
                    "block": row["block"],
                    "street_name": row["street_name"],
                    "unit_id": uid,
                    "storey_range": row["storey_range"],
                    "floor_area_sqm": row["floor_area_sqm"],
                    "flat_model": row["flat_model"],
                    "lease_commence_date": row["lease_commence_date"],
                    "flat_age_years": int(year) - int(row["lease_commence_date"]),
                    "remaining_lease_months": row["remaining_lease_months"],
                    "resale_price": row["resale_price"],
                    "price_per_sqft": f"{float(row['resale_price']) / floor_area_sqft:.2f}",
                    "postal_code": unit.get("postal_code", "") if unit else "",
                    "latitude": unit.get("latitude", "") if unit else "",
                    "longitude": unit.get("longitude", "") if unit else "",
                }
            )
            row_count += 1

    print(f"Wrote {row_count} rows to {ENRICHED_FILE}")
    print(f"Transactions with no matching unit in units.csv: {unmatched}")


if __name__ == "__main__":
    main()
