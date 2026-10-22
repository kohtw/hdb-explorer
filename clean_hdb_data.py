"""Clean the combined HDB resale flat price table.

Reads data/combined_resale_flat_prices.csv, fixes known data-quality issues
(inconsistent flat_model casing, stray whitespace, duplicate rows, invalid
values), and writes:
  - data/cleaned_resale_flat_prices.csv  (valid rows, standardised + typed)
  - data/rejected_rows.csv               (rows dropped, with a reason)
"""

import csv
import pathlib

DATA_DIR = pathlib.Path(__file__).parent / "data"
INPUT_FILE = DATA_DIR / "combined_resale_flat_prices.csv"
OUTPUT_FILE = DATA_DIR / "cleaned_resale_flat_prices.csv"
REJECTS_FILE = DATA_DIR / "rejected_rows.csv"

MIN_YEAR, MAX_YEAR = 1960, 2026

# Older source files render flat_model in ALL CAPS or with inconsistent
# spacing/casing; map every observed variant to the canonical spelling used
# by the current (Jan 2017 onwards) dataset.
FLAT_MODEL_CANONICAL = {
    "2-ROOM": "2-room",
    "3GEN": "3Gen",
    "ADJOINED FLAT": "Adjoined Flat",
    "APARTMENT": "Apartment",
    "DBSS": "DBSS",
    "IMPROVED": "Improved",
    "IMPROVED-MAISONETTE": "Improved-Maisonette",
    "MAISONETTE": "Maisonette",
    "MODEL A": "Model A",
    "MODEL A-MAISONETTE": "Model A-Maisonette",
    "MODEL A2": "Model A2",
    "MULTI GENERATION": "Multi Generation",
    "NEW GENERATION": "New Generation",
    "PREMIUM APARTMENT": "Premium Apartment",
    "PREMIUM APARTMENT LOFT": "Premium Apartment Loft",
    "PREMIUM MAISONETTE": "Premium Maisonette",
    "SIMPLIFIED": "Simplified",
    "STANDARD": "Standard",
    "TERRACE": "Terrace",
    "TYPE S1": "Type S1",
    "TYPE S2": "Type S2",
}

OUTPUT_COLUMNS = [
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


def normalise_flat_model(value: str) -> str:
    key = value.strip().upper()
    return FLAT_MODEL_CANONICAL.get(key, value.strip())


def validate(row: dict) -> str | None:
    """Return a rejection reason, or None if the row is valid."""
    try:
        year = int(row["month"].split("-")[0])
        month_num = int(row["month"].split("-")[1])
    except (ValueError, IndexError):
        return "malformed month"
    if not (MIN_YEAR <= year <= MAX_YEAR) or not (1 <= month_num <= 12):
        return "month out of range"

    try:
        floor_area = float(row["floor_area_sqm"])
        resale_price = float(row["resale_price"])
        lease_commence = int(row["lease_commence_date"])
        remaining_lease_months = int(row["remaining_lease_months"])
    except ValueError:
        return "non-numeric field"

    if floor_area <= 0:
        return "non-positive floor_area_sqm"
    if resale_price <= 0:
        return "non-positive resale_price"
    if not (MIN_YEAR <= lease_commence <= MAX_YEAR):
        return "lease_commence_date out of range"
    if remaining_lease_months <= 0:
        return "non-positive remaining_lease_months"

    for field in ("town", "flat_type", "block", "street_name", "storey_range", "flat_model"):
        if not row[field].strip():
            return f"missing {field}"

    return None


def standardise_row(row: dict) -> dict:
    return {
        "month": row["month"].strip(),
        "town": row["town"].strip().upper(),
        "flat_type": row["flat_type"].strip().upper(),
        "block": row["block"].strip().upper(),
        "street_name": row["street_name"].strip().upper(),
        "storey_range": row["storey_range"].strip().upper(),
        "floor_area_sqm": f"{float(row['floor_area_sqm']):.2f}",
        "flat_model": normalise_flat_model(row["flat_model"]),
        "lease_commence_date": str(int(row["lease_commence_date"])),
        "remaining_lease_months": str(int(row["remaining_lease_months"])),
        "resale_price": f"{float(row['resale_price']):.2f}",
    }


def main() -> None:
    seen_rows = set()
    valid_count = 0
    duplicate_count = 0
    rejected_count = 0

    with INPUT_FILE.open(newline="", encoding="utf-8") as in_file, OUTPUT_FILE.open(
        "w", newline="", encoding="utf-8"
    ) as out_file, REJECTS_FILE.open("w", newline="", encoding="utf-8") as rejects_file:

        reader = csv.DictReader(in_file)
        writer = csv.DictWriter(out_file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        rejects_writer = csv.writer(rejects_file)
        rejects_writer.writerow(["reason", *reader.fieldnames])

        for row in reader:
            reason = validate(row)
            if reason is not None:
                rejects_writer.writerow([reason, *row.values()])
                rejected_count += 1
                continue

            clean_row = standardise_row(row)
            dedup_key = tuple(clean_row.values())
            if dedup_key in seen_rows:
                duplicate_count += 1
                continue
            seen_rows.add(dedup_key)

            writer.writerow(clean_row)
            valid_count += 1

    print(f"Valid rows written: {valid_count}")
    print(f"Duplicate rows dropped: {duplicate_count}")
    print(f"Invalid rows rejected: {rejected_count} (see {REJECTS_FILE.name})")


if __name__ == "__main__":
    main()
