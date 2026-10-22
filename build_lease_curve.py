"""Estimate how resale $psf falls as remaining lease runs down.

Fits log($psf) on the last 3 years of resales as a sum of effects for town,
flat type, storey band, month and whole years of lease left (backfitting,
i.e. alternating group means). The lease effect is then smoothed and forced
to be non-decreasing in lease (pool-adjacent-violators), so more lease never
means a lower price.

Writes a `lease_curve` table to data/hdb.db: for each years-left value, the
factor that rescales a sale's $psf to what it would fetch with
REFERENCE_YEARS left. Run after build_webapp_db.py.
"""

import math
import pathlib
import sqlite3
from collections import defaultdict

DB_FILE = pathlib.Path(__file__).parent / "data" / "hdb.db"
REFERENCE_YEARS = 95  # roughly a flat just past its 5-year minimum occupation period
WINDOW_MONTHS = 36
ITERATIONS = 30
SMOOTH_YEARS = 2
MAX_LEASE = 99


def shift_month(month: str, delta: int) -> str:
    total = int(month[:4]) * 12 + int(month[5:7]) - 1 + delta
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def pool_adjacent_violators(values: list[float], weights: list[float]) -> list[float]:
    """Weighted isotonic (non-decreasing) regression."""
    blocks = []  # [mean, weight, count]
    for v, w in zip(values, weights):
        blocks.append([v, w, 1])
        while len(blocks) > 1 and blocks[-2][0] > blocks[-1][0]:
            v2, w2, c2 = blocks.pop()
            v1, w1, c1 = blocks.pop()
            blocks.append([(v1 * w1 + v2 * w2) / (w1 + w2), w1 + w2, c1 + c2])
    out = []
    for v, _, c in blocks:
        out.extend([v] * c)
    return out


def main() -> None:
    conn = sqlite3.connect(DB_FILE)
    latest = conn.execute("SELECT MAX(month) FROM transactions").fetchone()[0]
    since = shift_month(latest, -(WINDOW_MONTHS - 1))
    rows = conn.execute(
        """
        SELECT town, flat_type, storey_low / 3 AS storey_band, month, remaining_lease_months / 12 AS lease_years, price_psf
        FROM transactions WHERE month >= ? AND price_psf > 0
        """,
        (since,),
    ).fetchall()

    y = [math.log(r[5]) for r in rows]
    factor_keys = {
        "town": [r[0] for r in rows],
        "flat_type": [r[1] for r in rows],
        "storey": [r[2] for r in rows],
        "month": [r[3] for r in rows],
        "lease": [r[4] for r in rows],
    }
    mu = sum(y) / len(y)
    effects = {name: defaultdict(float) for name in factor_keys}

    for _ in range(ITERATIONS):
        for name, keys in factor_keys.items():
            sums, counts = defaultdict(float), defaultdict(int)
            for i, key in enumerate(keys):
                partial = y[i] - mu - sum(e[factor_keys[n][i]] for n, e in effects.items() if n != name)
                sums[key] += partial
                counts[key] += 1
            new = {k: sums[k] / counts[k] for k in sums}
            centre = sum(new[k] * counts[k] for k in new) / len(y)
            effects[name] = defaultdict(float, {k: v - centre for k, v in new.items()})
            mu += centre

    lease_counts = defaultdict(int)
    for key in factor_keys["lease"]:
        lease_counts[key] += 1
    years = sorted(lease_counts)
    raw = [effects["lease"][yr] for yr in years]
    weights = [lease_counts[yr] for yr in years]

    smoothed = []
    for i in range(len(years)):
        lo, hi = max(0, i - SMOOTH_YEARS), min(len(years), i + SMOOTH_YEARS + 1)
        w = sum(weights[lo:hi])
        smoothed.append(sum(raw[j] * weights[j] for j in range(lo, hi)) / w)
    monotone = pool_adjacent_violators(smoothed, weights)
    effect_by_year = dict(zip(years, monotone))

    def effect(yr: int) -> float:
        # Outside the observed range, hold the nearest observed effect.
        if yr in effect_by_year:
            return effect_by_year[yr]
        nearest = min(years, key=lambda known: abs(known - yr))
        return effect_by_year[nearest]

    reference = effect(REFERENCE_YEARS)
    conn.execute("DROP TABLE IF EXISTS lease_curve")
    conn.execute("CREATE TABLE lease_curve (lease_years INTEGER PRIMARY KEY, effect REAL, factor REAL, n INTEGER)")
    conn.executemany(
        "INSERT INTO lease_curve VALUES (?, ?, ?, ?)",
        [(yr, effect(yr), math.exp(reference - effect(yr)), lease_counts.get(yr, 0)) for yr in range(0, MAX_LEASE + 1)],
    )
    conn.commit()
    conn.close()

    print(f"Fitted on {len(rows):,} resales since {since}; lease observed {years[0]}-{years[-1]} years")
    for yr in (50, 60, 70, 80, 90, REFERENCE_YEARS):
        print(f"  {yr} years left: sells at {math.exp(effect(yr) - reference):.0%} of a {REFERENCE_YEARS}-year flat")


if __name__ == "__main__":
    main()
