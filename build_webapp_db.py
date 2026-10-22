"""Load the pipeline's CSV output into a typed SQLite database for the web app.

Tables:
  transactions   resale transactions (enriched CSV if present, else cleaned)
  property_info  every HDB block (data/hdb_property_information.csv)
  geocode        postal code / lat / long per block (data/address_geocode_cache.csv)

Writes data/hdb.db. The web app also re-syncs the geocode table from the
cache file while it runs, so geocoding progress shows up without a rebuild.
"""

import csv
import pathlib
import sqlite3

from build_units_master import TOWN_CODE_TO_NAME

DATA_DIR = pathlib.Path(__file__).parent / "data"
ENRICHED_FILE = DATA_DIR / "enriched_resale_flat_prices.csv"
CLEANED_FILE = DATA_DIR / "cleaned_resale_flat_prices.csv"
PROPERTY_INFO_FILE = DATA_DIR / "hdb_property_information.csv"
GEOCODE_CACHE_FILE = DATA_DIR / "address_geocode_cache.csv"
DB_FILE = DATA_DIR / "hdb.db"

SQM_TO_SQFT = 10.7639

PROPERTY_INT_COLUMNS = [
    "max_floor_lvl",
    "year_completed",
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
]
PROPERTY_FLAG_COLUMNS = [
    "residential",
    "commercial",
    "market_hawker",
    "miscellaneous",
    "multistorey_carpark",
    "precinct_pavilion",
]


def to_int(value: str) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def to_float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def load_transactions(conn: sqlite3.Connection) -> None:
    source_file = ENRICHED_FILE if ENRICHED_FILE.exists() else CLEANED_FILE
    print(f"Loading transactions from {source_file.name}")

    conn.execute(
        """
        CREATE TABLE transactions (
            month TEXT,
            year INTEGER,
            town TEXT,
            flat_type TEXT,
            block TEXT,
            street_name TEXT,
            unit_id TEXT,
            storey_range TEXT,
            storey_low INTEGER,
            storey_high INTEGER,
            floor_area_sqm REAL,
            flat_model TEXT,
            lease_commence_date INTEGER,
            remaining_lease_months INTEGER,
            resale_price REAL,
            price_psf REAL
        )
        """
    )

    def rows():
        with source_file.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                low, _, high = row["storey_range"].partition(" TO ")
                area = float(row["floor_area_sqm"])
                price = float(row["resale_price"])
                yield (
                    row["month"],
                    int(row["month"][:4]),
                    row["town"],
                    row["flat_type"],
                    row["block"],
                    row["street_name"],
                    f"{row['block']}|{row['street_name']}",
                    row["storey_range"],
                    to_int(low),
                    to_int(high),
                    area,
                    row["flat_model"],
                    int(row["lease_commence_date"]),
                    int(row["remaining_lease_months"]),
                    price,
                    round(price / (area * SQM_TO_SQFT), 2),
                )

    conn.executemany(f"INSERT INTO transactions VALUES ({', '.join('?' * 16)})", rows())

    for columns in ("unit_id", "town", "flat_type", "month", "year", "resale_price", "price_psf"):
        name = columns.replace(", ", "_")
        conn.execute(f"CREATE INDEX idx_tx_{name} ON transactions({columns})")
    conn.execute("CREATE INDEX idx_tx_town_month ON transactions(town, month)")

    count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    print(f"Loaded {count} transactions")


def load_property_info(conn: sqlite3.Connection) -> None:
    columns = PROPERTY_INT_COLUMNS + PROPERTY_FLAG_COLUMNS
    conn.execute(
        f"""
        CREATE TABLE property_info (
            unit_id TEXT PRIMARY KEY,
            block TEXT,
            street_name TEXT,
            town TEXT,
            {', '.join(f'"{c}" INTEGER' for c in PROPERTY_INT_COLUMNS)},
            {', '.join(f'"{c}" TEXT' for c in PROPERTY_FLAG_COLUMNS)}
        )
        """
    )

    with PROPERTY_INFO_FILE.open(newline="", encoding="utf-8") as f:
        rows = []
        for row in csv.DictReader(f):
            block = row["blk_no"].strip().upper()
            street = row["street"].strip().upper()
            town_code = row["bldg_contract_town"].strip().upper()
            rows.append(
                (
                    f"{block}|{street}",
                    block,
                    street,
                    TOWN_CODE_TO_NAME.get(town_code, town_code),
                    *(to_int(row[c]) for c in PROPERTY_INT_COLUMNS),
                    *(row[c].strip().upper() for c in PROPERTY_FLAG_COLUMNS),
                )
            )

    quoted = ", ".join(f'"{c}"' for c in columns)
    conn.executemany(
        f"INSERT OR REPLACE INTO property_info (unit_id, block, street_name, town, {quoted}) "
        f"VALUES ({', '.join('?' * (4 + len(columns)))})",
        rows,
    )
    conn.execute("CREATE INDEX idx_pi_block ON property_info(block)")
    conn.execute("CREATE INDEX idx_pi_town ON property_info(town)")
    print(f"Loaded {len(rows)} blocks into property_info")


def load_extra_blocks(conn: sqlite3.Connection) -> None:
    """Blocks that appear in resale history but not in property_info (mostly demolished)."""
    conn.execute(
        """
        CREATE TABLE extra_blocks AS
        SELECT unit_id, MIN(block) AS block, MIN(street_name) AS street_name, MIN(town) AS town
        FROM transactions
        WHERE unit_id NOT IN (SELECT unit_id FROM property_info)
        GROUP BY unit_id
        """
    )
    conn.execute("CREATE INDEX idx_extra_block ON extra_blocks(block)")
    count = conn.execute("SELECT COUNT(*) FROM extra_blocks").fetchone()[0]
    print(f"Found {count} blocks with resale history that aren't in property_info")


def create_geocode_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS geocode (
            unit_id TEXT PRIMARY KEY,
            postal_code TEXT,
            latitude REAL,
            longitude REAL,
            geocode_status TEXT
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_geo_postal ON geocode(postal_code)")


def sync_geocode(conn: sqlite3.Connection) -> int:
    """Upsert the geocode cache file into the geocode table; returns rows read."""
    create_geocode_table(conn)
    if not GEOCODE_CACHE_FILE.exists():
        return 0

    rows = []
    with GEOCODE_CACHE_FILE.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # The cache may be mid-append by the geocoder; skip any partial line.
            if not row.get("unit_id") or row.get("geocode_status") is None:
                continue
            rows.append(
                (
                    row["unit_id"],
                    row["postal_code"] or None,
                    to_float(row["latitude"]),
                    to_float(row["longitude"]),
                    row["geocode_status"],
                )
            )

    conn.executemany("INSERT OR REPLACE INTO geocode VALUES (?, ?, ?, ?, ?)", rows)
    conn.commit()
    return len(rows)


def main() -> None:
    DB_FILE.unlink(missing_ok=True)
    conn = sqlite3.connect(DB_FILE)
    load_transactions(conn)
    load_property_info(conn)
    load_extra_blocks(conn)
    print(f"Loaded {sync_geocode(conn)} geocoded blocks")
    conn.commit()
    conn.execute("ANALYZE")
    # WAL lets the app's background geocode sync write without blocking page reads.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.close()
    print(f"Wrote {DB_FILE}")


if __name__ == "__main__":
    main()
