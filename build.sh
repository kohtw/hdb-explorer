#!/usr/bin/env bash
# Render build step: install deps and rebuild data/hdb.db from data.gov.sg.
# The database is too large for git, so it's regenerated on every deploy;
# data/address_geocode_cache.csv is committed so geocodes don't need refetching.
set -euo pipefail

pip install -r requirements.txt

python download_hdb_resale_data.py
python combine_hdb_resale_data.py
python clean_hdb_data.py
python download_hdb_property_info.py
python build_webapp_db.py
python precompute.py

# Only hdb.db, the property list and the geocode cache are needed at runtime.
rm -f data/Resale*.csv data/combined_resale_flat_prices.csv data/cleaned_resale_flat_prices.csv data/rejected_rows.csv
