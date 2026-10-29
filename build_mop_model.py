"""Predict what flats still in their Minimum Occupation Period (MOP) will resell for once it ends.

A block's "MOP debut" is the month of its first resale (M0); its MOP prices are
every resale in M0..M0+11. The prediction splits in two:

  today's money  log psf minus a market index at the sale month, i.e. how far
                 above or below the market the block trades. Learned by
                 gradient-boosted trees from the flat (type, model, size,
                 storey, lease left), the block (height, units, location,
                 town) and what nearby resales fetched before the cutoff.
  trend          where the market index goes between the cutoff and M0,
                 extrapolated from the index up to the cutoff only.

nominal price = today's-money premium x forecast index at the MOP month.

Leakage controls (asserted, not just intended):
  - every feature is computed "as of" a cutoff C: only resales in months <= C
    are visible, and the block's own sales never are (it has none before M0)
  - the market index is chained month to month, so its value at month m uses
    only months <= m; rebuilt on truncated data and compared to prove it
  - no 2026-snapshot columns (MRT, amenities, livability scores, median_psf)
  - backtest is walk-forward by year: rows whose cutoff falls in year Y are
    scored by a model trained only on sales before January of year Y
  - features rebuilt from a copy of the data with everything after C deleted
    must match exactly
  - a shuffled-label model must lose to the real one by a wide margin

Backtest horizons: the cutoff sits 1, 12, 24, 36, 48 or 60 months before M0.

Writes to data/hdb.db:
  mop_predictions  in-MOP and just-MOP'd blocks x flat type x 3-storey band
  mop_check        each sale of a just-MOP'd block vs its pre-MOP prediction
  mop_meta         JSON: backtest metrics by horizon and year, trend errors,
                   leakage checks

Run after build_price_model.py.
"""

import json
import math
import pathlib
import sqlite3
import time
from collections import defaultdict

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sklearn.ensemble import HistGradientBoostingRegressor

DB_FILE = pathlib.Path(__file__).parent / "data" / "hdb.db"
RANDOM_STATE = 0
HORIZONS = [1, 12, 24, 36, 48, 60]
LABEL_MONTHS = 12
NEIGHBOUR_MONTHS = 24
YOUNG_YEARS = 10
FIRST_EVENT_MONTH = "2005-01"
FIRST_TEST_YEAR = 2010
REPORT_FROM_YEAR = 2015
CALIBRATE_UNTIL_YEAR = 2020
IN_MOP_COMPLETED_FROM = 2019
SQFT_PER_SQM = 10.7639
M_PER_DEG_LAT = 110_574
M_PER_DEG_LON = 111_320 * math.cos(math.radians(1.35))
TYPES = ["1 ROOM", "2 ROOM", "3 ROOM", "4 ROOM", "5 ROOM", "EXECUTIVE", "MULTI-GENERATION"]
UNIT_TYPE_COLUMNS = {
    "1 ROOM": "1room_sold", "2 ROOM": "2room_sold", "3 ROOM": "3room_sold", "4 ROOM": "4room_sold",
    "5 ROOM": "5room_sold", "EXECUTIVE": "exec_sold", "MULTI-GENERATION": "multigen_sold",
}
# Neighbour features: relative psf (log psf minus market index) of resales before the cutoff.
NEIGHBOUR_FEATURES = [
    "n_500", "rel_500", "n_1k", "rel_1k", "rel_1k_type", "n_1k_type", "rel_2k_young", "n_2k_young",
    "rel_1k_young", "rel_2k_young_type", "n_2k_young_type", "lease_left_1k", "nearest_sale_m", "rel_town_type",
]
CATEGORICAL = ["town", "flat_type", "flat_model"]
NUMERIC = [
    "floor_area_sqm", "storey_mid", "lease_left_years", "max_floor_lvl", "total_dwelling_units",
    "latitude", "longitude", "horizon",
] + NEIGHBOUR_FEATURES
FEATURES = CATEGORICAL + NUMERIC
# Columns that describe the city as it is in 2026 and must never reach the model.
SNAPSHOT_COLUMNS = {
    "rail_min", "cbd_min", "cbd_km", "lines_15min", "interchange_min", "bus_services_400m", "nearest_hawker_m",
    "hawkers_1km", "nearest_gp_m", "gps_1km", "nearest_polyclinic_m", "nearest_hospital_m", "nearest_park_m",
    "parks_1km", "primary_1km", "primary_2km", "median_psf", "lease_left_years_snapshot", "month_index",
}


def month_index(month: str) -> int:
    return int(month[:4]) * 12 + int(month[5:7]) - 1


def month_str(index: int) -> str:
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def make_model() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        learning_rate=0.08,
        max_iter=350,
        max_leaf_nodes=48,
        min_samples_leaf=40,
        l2_regularization=0.2,
        categorical_features=[FEATURES.index(c) for c in CATEGORICAL],
        random_state=RANDOM_STATE,
    )


# ---------------------------------------------------------------- market index

def chained_index(tx: pd.DataFrame, n_months: int) -> np.ndarray:
    """Monthly log-psf index, 0 at the first month.

    Each month's change is the weighted median, across strata of like flats
    (town x flat type x 5-year lease cohort), of the change in the stratum's
    median log psf since the previous month. Month m depends on months m-1 and
    m only, so the series is never revised by later data.
    """
    g = tx.groupby(["mi", "town", "flat_type", "cohort"])["log_psf"].agg(["median", "size"]).reset_index()
    prev = g.copy()
    prev["mi"] += 1
    pair = g.merge(prev, on=["mi", "town", "flat_type", "cohort"], suffixes=("", "_prev"))
    pair["diff"] = pair["median"] - pair["median_prev"]
    pair["w"] = np.minimum(pair["size"], pair["size_prev"])
    start = int(tx["mi"].min())
    idx = np.zeros(n_months)
    step = {}
    for mi, grp in pair.groupby("mi"):
        order = np.argsort(grp["diff"].to_numpy())
        d, w = grp["diff"].to_numpy()[order], grp["w"].to_numpy()[order]
        cw = np.cumsum(w)
        step[int(mi)] = float(d[np.searchsorted(cw, cw[-1] / 2)])
    for m in range(start + 1, start + n_months):
        idx[m - start] = idx[m - start - 1] + step.get(m, 0.0)
    return idx


def trend_forecast(idx: np.ndarray, cutoff: int, target: int, method: str) -> float:
    """Forecast index at `target` using idx[..cutoff] only (positions relative to idx start)."""
    anchor = float(np.mean(idx[cutoff - 2 : cutoff + 1]))  # centred on cutoff - 1
    steps = target - (cutoff - 1)
    if method == "none" or steps <= 0:
        return anchor
    g = (anchor - float(np.mean(idx[cutoff - 38 : cutoff - 35]))) / 36  # trailing 36-month growth per month
    if method == "linear":
        return anchor + g * steps
    phi = 0.97  # damped: growth fades by 3% a month
    return anchor + g * phi * (1 - phi**steps) / (1 - phi)


TREND_METHODS = ["none", "linear", "damped"]
TREND_SCORE_FROM = "2000-01"


class TrendSelector:
    """Chooses a trend method at a cutoff from how each method did on forecasts already resolved by then.

    A forecast made at origin c for horizon h is resolved at month c + h, so at cutoff C only origins
    c <= C - h count. Ties and no history fall back to "none".
    """

    def __init__(self, idx: np.ndarray, idx_start: int, latest: int):
        self.idx, self.idx_start = idx, idx_start
        self.first_origin = max(month_index(TREND_SCORE_FROM), idx_start + 38)
        self.cum = {}
        for h in range(1, max(HORIZONS) + 1):
            origins = np.arange(self.first_origin, latest - h + 1)
            for m in TREND_METHODS:
                err = np.array([abs(self.error(c, h, m)) for c in origins])
                self.cum[(h, m)] = np.concatenate([[0.0], np.cumsum(err)])

    def error(self, c: int, h: int, method: str) -> float:
        return trend_forecast(self.idx, c - self.idx_start, c + h - self.idx_start, method) - self.idx[c + h - self.idx_start]

    def latest_target_used(self, cutoff: int, h: int) -> int:
        n = self.resolved(cutoff, h)
        return self.first_origin + n - 1 + h if n else -10**9

    def resolved(self, cutoff: int, h: int) -> int:
        return int(min(max(cutoff - h - self.first_origin + 1, 0), len(self.cum[(h, "none")]) - 1))

    def choose(self, cutoff: int, h: int) -> str:
        h = int(min(max(h, 1), max(HORIZONS)))
        n = self.resolved(cutoff, h)
        if n == 0:
            return "none"
        scores = {m: self.cum[(h, m)][n] / n for m in TREND_METHODS}
        return min(TREND_METHODS, key=lambda m: (scores[m], m != "none"))


def range_bounds(residuals) -> tuple[float, float]:
    """80% range of log errors, widened if needed so it always contains the point estimate."""
    lo, hi = np.quantile(residuals, [0.1, 0.9])
    return float(min(lo, 0.0)), float(max(hi, 0.0))


# ---------------------------------------------------------------- data

def load(conn: sqlite3.Connection):
    tx = pd.read_sql(
        """
        SELECT t.month, t.unit_id, t.town, t.flat_type, t.flat_model, t.floor_area_sqm, t.storey_low,
               t.storey_high, t.lease_commence_date AS lc, t.resale_price
        FROM transactions t
        """,
        conn,
    )
    tx["mi"] = tx["month"].map(month_index)
    tx["log_psf"] = np.log(tx["resale_price"] / (tx["floor_area_sqm"] * SQFT_PER_SQM))
    tx["cohort"] = tx["lc"] // 5
    blocks = pd.read_sql(
        f"""
        SELECT l.unit_id, l.town, l.latitude, l.longitude, p.max_floor_lvl, p.total_dwelling_units, p.year_completed,
               {', '.join(f'p."{c}"' for c in UNIT_TYPE_COLUMNS.values())}
        FROM livability l JOIN property_info p ON p.unit_id = l.unit_id
        WHERE l.latitude IS NOT NULL
        """,
        conn,
    ).set_index("unit_id")
    return tx, blocks


class Neighbours:
    """As-of-cutoff features from resales near a block. Sees only months <= cutoff."""

    def __init__(self, tx: pd.DataFrame, blocks: pd.DataFrame, idx: np.ndarray, idx_start: int):
        t = tx.join(blocks[["latitude", "longitude"]], on="unit_id", how="inner").sort_values("mi")
        self.mi = t["mi"].to_numpy()
        self.x = t["longitude"].to_numpy() * M_PER_DEG_LON
        self.y = t["latitude"].to_numpy() * M_PER_DEG_LAT
        self.rel = t["log_psf"].to_numpy() - idx[self.mi - idx_start]
        self.type = t["flat_type"].to_numpy()
        self.town = t["town"].to_numpy()
        self.unit = t["unit_id"].to_numpy()
        self.age = (self.mi / 12) - t["lc"].to_numpy()
        self.lease_left = 99 - self.age

    def window(self, cutoff: int, months: int) -> slice:
        lo = np.searchsorted(self.mi, cutoff - months + 1, "left")
        hi = np.searchsorted(self.mi, cutoff, "right")
        return slice(lo, hi)

    def features(self, queries: list[tuple], audit: dict | None = None) -> dict:
        """queries: (key, unit_id, town, lat, lon, cutoff). Returns {key: {feature or (feature, type): value}}."""
        by_cutoff = defaultdict(list)
        for q in queries:
            by_cutoff[q[5]].append(q)
        out = {}
        for cutoff, qs in by_cutoff.items():
            w = self.window(cutoff, NEIGHBOUR_MONTHS)
            if w.stop - w.start == 0:
                for q in qs:
                    out[q[0]] = {}
                continue
            mi, rel, typ, town = self.mi[w], self.rel[w], self.type[w], self.town[w]
            unit, age, lease_left = self.unit[w], self.age[w], self.lease_left[w]
            if audit is not None:
                audit["max_seen_minus_cutoff"] = max(audit.get("max_seen_minus_cutoff", -10**9), int(mi.max()) - cutoff)
            recent = mi > cutoff - 12
            town_type = pd.Series(rel[recent]).groupby([town[recent], typ[recent]]).median().to_dict()
            tree = cKDTree(np.column_stack([self.x[w], self.y[w]]))
            pts = np.array([[q[4] * M_PER_DEG_LON, q[3] * M_PER_DEG_LAT] for q in qs])
            balls = tree.query_ball_point(pts, r=2000)
            nearest, _ = tree.query(pts, k=1)
            for q, ball, near in zip(qs, balls, nearest):
                key, unit_id, q_town = q[0], q[1], q[2]
                ball = np.asarray(ball, dtype=int)
                if audit is not None and ball.size:
                    audit["own_block_rows"] = audit.get("own_block_rows", 0) + int(np.sum(unit[ball] == unit_id))
                ball = ball[unit[ball] != unit_id]
                d = np.hypot(self.x[w][ball] - q[4] * M_PER_DEG_LON, self.y[w][ball] - q[3] * M_PER_DEG_LAT)
                r, t, a = rel[ball], typ[ball], age[ball]
                f = {"nearest_sale_m": float(near)}
                in500, in1k, young = d <= 500, d <= 1000, a <= YOUNG_YEARS
                f["n_500"], f["rel_500"] = int(in500.sum()), med(r[in500])
                f["n_1k"], f["rel_1k"] = int(in1k.sum()), med(r[in1k])
                f["n_2k_young"], f["rel_2k_young"] = int(young.sum()), med(r[young])
                f["rel_1k_young"] = med(r[young & in1k])
                f["lease_left_1k"] = med(lease_left[ball][in1k])
                for ft in TYPES:
                    is_t = t == ft
                    f[("rel_1k_type", ft)] = med(r[in1k & is_t])
                    f[("n_1k_type", ft)] = int((in1k & is_t).sum())
                    f[("rel_2k_young_type", ft)] = med(r[young & is_t])
                    f[("n_2k_young_type", ft)] = int((young & is_t).sum())
                    f[("rel_town_type", ft)] = town_type.get((q_town, ft), np.nan)
                out[key] = f
        return out


def med(a: np.ndarray) -> float:
    return float(np.median(a)) if a.size else np.nan


def row_features(f: dict, flat_type: str) -> dict:
    """Block-level features plus the ones for this flat type."""
    return {name: f.get((name, flat_type), f.get(name, np.nan)) for name in NEIGHBOUR_FEATURES}


def feature_frame(feats: dict, key_names: list[str]) -> pd.DataFrame:
    """One row per cutoff key x flat type, key tuple split into columns."""
    recs = []
    for key, f in feats.items():
        for ft in TYPES:
            recs.append({**dict(zip(key_names, key)), "flat_type": ft, **row_features(f, ft)})
    return pd.DataFrame(recs)


def same(a, b) -> bool:
    if isinstance(a, float) or isinstance(b, float):
        a, b = float(a), float(b)
        return (math.isnan(a) and math.isnan(b)) or abs(a - b) < 1e-9
    return a == b


class Encoder:
    def __init__(self, frames: list[pd.DataFrame]):
        self.codes = {c: {v: i for i, v in enumerate(sorted(set().union(*(set(f[c]) for f in frames))))} for c in CATEGORICAL}

    def matrix(self, df: pd.DataFrame) -> np.ndarray:
        out = np.empty((len(df), len(FEATURES)))
        for j, c in enumerate(FEATURES):
            if c in self.codes:
                out[:, j] = df[c].map(self.codes[c]).fillna(len(self.codes[c])).to_numpy()
            else:
                out[:, j] = pd.to_numeric(df[c], errors="coerce").to_numpy(dtype=float)
        return out


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    ape = np.abs(predicted - actual) / actual
    return {
        "n": int(len(actual)),
        "mape": float(np.mean(ape)),
        "median_ape": float(np.median(ape)),
        "within_5pct": float(np.mean(ape <= 0.05)),
        "within_10pct": float(np.mean(ape <= 0.10)),
        "bias": float(np.median(predicted / actual - 1)),
    }


# ---------------------------------------------------------------- main

def main() -> None:
    started = time.time()
    conn = sqlite3.connect(DB_FILE)
    tx, blocks = load(conn)
    latest = int(tx["mi"].max())
    idx_start = int(tx["mi"].min())
    n_months = latest - idx_start + 1
    idx = chained_index(tx, n_months)
    at = lambda mi: idx[np.asarray(mi) - idx_start]  # noqa: E731
    print(f"{len(tx):,} resales {month_str(idx_start)}..{month_str(latest)}; index {math.exp(idx[-1]):.2f}x since start")

    checks = {}
    # Leakage check: the index up to C must not change when everything after C is deleted.
    max_diff = 0.0
    for c in [month_index("2008-06"), month_index("2014-12"), month_index("2019-03"), month_index("2022-09"), latest - 6]:
        trunc = chained_index(tx[tx["mi"] <= c], c - idx_start + 1)
        max_diff = max(max_diff, float(np.max(np.abs(trunc - idx[: c - idx_start + 1]))))
    assert max_diff < 1e-12, f"index revises with future data ({max_diff})"
    checks["index_uses_past_only"] = {"ok": True, "max_abs_diff": max_diff}

    # ----- MOP debut events -----
    first = tx.groupby("unit_id").agg(m0=("mi", "min"), lc=("lc", "min"))
    first["gap_years"] = first["m0"] / 12 - first["lc"]
    events = first[
        (first["lc"] >= 1995) & (first["m0"] >= month_index(FIRST_EVENT_MONTH))
        & first["gap_years"].between(2, 8) & first.index.isin(blocks.index)
    ].copy()
    print(f"{len(events):,} MOP debuts since {FIRST_EVENT_MONTH}")

    sales = tx[tx["unit_id"].isin(events.index)].join(events[["m0"]], on="unit_id")
    sales = sales[sales["mi"] < sales["m0"] + LABEL_MONTHS].copy()
    sales["rel"] = sales["log_psf"] - at(sales["mi"])

    nb = Neighbours(tx, blocks, idx, idx_start)
    queries = []
    for unit_id, e in events.iterrows():
        b = blocks.loc[unit_id]
        for h in HORIZONS:
            c = int(e["m0"]) - h
            if c - NEIGHBOUR_MONTHS + 1 >= idx_start:
                queries.append(((unit_id, h), unit_id, b["town"], b["latitude"], b["longitude"], c))
    audit = {}
    feats = nb.features(queries, audit)
    assert audit["max_seen_minus_cutoff"] <= 0, "a feature saw a sale after its cutoff"
    assert audit["own_block_rows"] == 0, "a block saw its own sales before its MOP debut"
    checks["features_before_cutoff"] = {"ok": True, "latest_seen_vs_cutoff_months": audit["max_seen_minus_cutoff"]}
    checks["own_block_excluded"] = {"ok": True, "own_rows_seen": audit["own_block_rows"]}
    print(f"Built neighbour features for {len(feats):,} block x horizon cutoffs ({time.time() - started:.0f}s)")

    # Leakage check: rebuild a sample from data with everything after each cutoff deleted.
    rng = np.random.default_rng(RANDOM_STATE)
    sample = [queries[i] for i in rng.choice(len(queries), size=60, replace=False)]
    mismatches = 0
    for q in sample:
        cut = q[5]
        tx_cut = tx[tx["mi"] <= cut]
        nb_cut = Neighbours(tx_cut, blocks, chained_index(tx_cut, cut - idx_start + 1), idx_start)
        f_cut = nb_cut.features([q])[q[0]]
        assert f_cut.keys() == feats[q[0]].keys()
        mismatches += sum(not same(v, f_cut[k]) for k, v in feats[q[0]].items())
    assert mismatches == 0, f"{mismatches} features changed when future data was deleted"
    checks["truncation_rebuild"] = {"ok": True, "cutoffs_checked": len(sample)}

    base = sales.join(blocks[["max_floor_lvl", "total_dwelling_units", "latitude", "longitude"]], on="unit_id")
    base = base.assign(
        storey_mid=(base["storey_low"] + base["storey_high"]) / 2,
        lease_left_years=99 - (base["mi"] / 12 - base["lc"]),
        price=base["resale_price"],
    ).drop(columns=["resale_price", "log_psf", "cohort", "month"])
    data = pd.concat([base.assign(horizon=h, cutoff=base["m0"] - h) for h in HORIZONS], ignore_index=True)
    data = data.merge(feature_frame(feats, ["unit_id", "horizon"]), on=["unit_id", "horizon", "flat_type"], how="inner")
    assert not (set(FEATURES) & SNAPSHOT_COLUMNS), "a 2026-snapshot column is in the feature list"
    checks["no_snapshot_features"] = {"ok": True, "features": FEATURES}
    print(f"{len(data):,} training rows ({data['unit_id'].nunique():,} blocks x horizons)")

    # ----- walk-forward backtest -----
    encoder = Encoder([data])
    X, y = encoder.matrix(data), data["rel"].to_numpy()
    cut_year = data["cutoff"].to_numpy() // 12
    pred = np.full(len(data), np.nan)
    for year in range(FIRST_TEST_YEAR, latest // 12 + 1):
        train = data["mi"].to_numpy() < year * 12
        test = cut_year == year
        if not test.any():
            continue
        assert data["mi"].to_numpy()[train].max() < data["cutoff"].to_numpy()[test].min() + 1, "train sale after test cutoff"
        pred[test] = make_model().fit(X[train], y[train]).predict(X[test])
        print(f"  fold {year}: train {train.sum():,} rows, test {test.sum():,} ({time.time() - started:.0f}s)")
    checks["walk_forward"] = {"ok": True, "rule": "rows with cutoff in year Y scored by a model trained on sales before Jan Y"}

    data["pred_rel"] = pred
    scored = data[(data["cutoff"] // 12 >= REPORT_FROM_YEAR) & data["pred_rel"].notna()].copy()
    sqft = scored["floor_area_sqm"].to_numpy() * SQFT_PER_SQM
    idx_sale = at(scored["mi"])
    scored["today_pred"] = np.exp(scored["pred_rel"].to_numpy() + idx_sale) * sqft
    # Naive comparison: same-type resales within 1km (else town) at their relative price.
    naive_rel = scored["rel_1k_type"].fillna(scored["rel_town_type"]).fillna(scored["rel_1k"])
    scored["naive_today"] = np.exp(naive_rel.to_numpy() + idx_sale) * sqft

    # Trend method picked walk-forward: at each cutoff, the one with the lowest index error so far at that horizon.
    selector = TrendSelector(idx, idx_start, latest)
    max_peek = 0
    for c in range(selector.first_origin, latest + 1, 7):
        for h in HORIZONS:
            max_peek = max(max_peek, selector.latest_target_used(c, h) - c)
    assert max_peek <= 0, "trend selection used an index month after its cutoff"
    checks["trend_selection_past_only"] = {"ok": True, "rule": "method with lowest index error over forecasts already resolved by the cutoff"}
    methods = [selector.choose(c, h) for c, h in zip(scored["cutoff"], scored["horizon"])]
    scored["trend_method"] = methods
    fc = np.array([trend_forecast(idx, c - idx_start, m - idx_start, meth)
                   for c, m, meth in zip(scored["cutoff"], scored["mi"], methods)])
    scored["nominal_pred"] = np.exp(scored["pred_rel"].to_numpy() + fc) * sqft
    fc = np.array([trend_forecast(idx, c - idx_start, m - idx_start, "none") for c, m in zip(scored["cutoff"], scored["mi"])])
    scored["nominal_nochange"] = np.exp(scored["pred_rel"].to_numpy() + fc) * sqft

    trend_table = []
    for h in HORIZONS:
        origins = [c for c in range(month_index(f"{REPORT_FROM_YEAR}-01"), latest - h + 1)]
        if not origins:
            continue
        entry = {"horizon": h, "n_origins": len(origins)}
        for m in TREND_METHODS:
            entry[m] = float(np.mean([abs(selector.error(c, h, m)) for c in origins]))
        entry["walk_forward"] = float(np.mean([abs(selector.error(c, h, selector.choose(c, h))) for c in origins]))
        entry["live_method"] = selector.choose(latest, h)
        trend_table.append(entry)
        print(f"  trend h={h:>2}m index error: " + ", ".join(f"{m} {entry[m]:.3f}" for m in TREND_METHODS)
              + f", walk-forward pick {entry['walk_forward']:.3f}; live uses {entry['live_method']}")

    by_horizon = []
    for h in HORIZONS:
        s = scored[scored["horizon"] == h]
        if s.empty:
            continue
        by_horizon.append({
            "horizon": h,
            "today": metrics(s["price"].to_numpy(), s["today_pred"].to_numpy()),
            "nominal": metrics(s["price"].to_numpy(), s["nominal_pred"].to_numpy()),
            "nominal_nochange": metrics(s["price"].to_numpy(), s["nominal_nochange"].to_numpy()),
            "naive_today": metrics(s["price"].to_numpy(), s["naive_today"].to_numpy()),
        })
    h1 = scored[scored["horizon"] == 1]
    by_year = [
        {"year": int(yr), **{k: v for k, v in metrics(g["price"].to_numpy(), g["today_pred"].to_numpy()).items()}}
        for yr, g in h1.groupby(h1["m0"] // 12)
    ]
    for b in by_horizon:
        print(f"  h={b['horizon']:>2}m  today MAPE {b['today']['mape']:.1%} (naive {b['naive_today']['mape']:.1%})  "
              f"nominal {b['nominal']['mape']:.1%} (no-change trend {b['nominal_nochange']['mape']:.1%})")

    # Leakage check: a model trained on shuffled labels must be far worse.
    test_year = min(latest // 12 - 1, 2024)
    train, test = data["mi"].to_numpy() < test_year * 12, (cut_year == test_year) & (data["horizon"].to_numpy() == 1)
    shuffled = make_model().fit(X[train], rng.permutation(y[train])).predict(X[test])
    real_err = float(np.mean(np.abs(pred[test] - y[test])))
    shuf_err = float(np.mean(np.abs(shuffled - y[test])))
    assert shuf_err > 1.5 * real_err, "shuffled-label model is nearly as good as the real one"
    checks["shuffled_labels"] = {"ok": True, "year": test_year, "real_mae_log": real_err, "shuffled_mae_log": shuf_err}

    # ----- calibrated 80% ranges from out-of-fold errors, by horizon -----
    scored["res_today"] = np.log(scored["price"] / scored["today_pred"])
    scored["res_nominal"] = np.log(scored["price"] / scored["nominal_pred"])
    ranges, coverage = {}, []
    for h in HORIZONS:
        s = scored[scored["horizon"] == h]
        if s.empty:
            continue
        calib, check = s[s["m0"] // 12 <= CALIBRATE_UNTIL_YEAR], s[s["m0"] // 12 > CALIBRATE_UNTIL_YEAR]
        entry = {"horizon": h}
        for kind in ("today", "nominal"):
            col = f"res_{kind}"
            if len(calib) and len(check):
                lo, hi = range_bounds(calib[col])
                entry[kind] = float(np.mean((check[col] >= lo) & (check[col] <= hi)))
            ranges[(h, kind)] = range_bounds(s[col])
        coverage.append(entry)
    checks["range_coverage_out_of_sample"] = {"calibrated_until": CALIBRATE_UNTIL_YEAR, "by_horizon": coverage}

    # ----- live predictions -----
    print(f"Fitting final models ({time.time() - started:.0f}s)")
    final = make_model().fit(X, y)
    just_from = latest - LABEL_MONTHS + 1
    check_train = data["mi"].to_numpy() <= just_from - 2  # every just-MOP'd cutoff is >= just_from - 1
    check_model = make_model().fit(X[check_train], y[check_train])

    # When will a block with no resale debut? Learned from recent cohorts: months from Jan of completion year.
    recent = first.join(blocks["year_completed"], how="inner")
    recent = recent[(recent["lc"] >= 2012) & recent["year_completed"].notna()]
    debut_offset = int(np.median(recent["m0"] - recent["year_completed"] * 12))
    lc_offset = float(np.median(recent["lc"] - recent["year_completed"]))

    has_sales = set(tx["unit_id"])
    sold_types = {u: [t for t, c in UNIT_TYPE_COLUMNS.items() if (b[c] or 0) > 0] for u, b in blocks.iterrows()}
    targets = []
    for unit_id, b in blocks.iterrows():
        if not sold_types[unit_id]:
            continue
        if unit_id not in has_sales:
            if pd.isna(b["year_completed"]) or b["year_completed"] < IN_MOP_COMPLETED_FROM:
                continue
            m0 = max(int(b["year_completed"]) * 12 + debut_offset, latest + 1)
            targets.append({"unit_id": unit_id, "m0": m0, "estimated": 1, "lc": b["year_completed"] + lc_offset,
                            "cutoff": latest, "model": "final"})
        elif first.loc[unit_id, "m0"] >= just_from and first.loc[unit_id, "lc"] >= IN_MOP_COMPLETED_FROM - 5:
            m0 = int(first.loc[unit_id, "m0"])
            targets.append({"unit_id": unit_id, "m0": m0, "estimated": 0, "lc": first.loc[unit_id, "lc"],
                            "cutoff": m0 - 1, "model": "check"})
    tq = [((t["unit_id"], t["cutoff"]), t["unit_id"], blocks.loc[t["unit_id"], "town"],
           blocks.loc[t["unit_id"], "latitude"], blocks.loc[t["unit_id"], "longitude"], t["cutoff"]) for t in targets]
    live_feats = nb.features(tq)

    # Typical size and model for each flat type in young blocks (lease from 2010), by town then nationally.
    young_tx = tx[tx["lc"] >= 2010]
    area_town = young_tx.groupby(["town", "flat_type"])["floor_area_sqm"].median().to_dict()
    area_all = young_tx.groupby("flat_type")["floor_area_sqm"].median().to_dict()
    model_town = young_tx.groupby(["town", "flat_type"])["flat_model"].agg(lambda s: s.mode().iloc[0]).to_dict()
    model_all = young_tx.groupby("flat_type")["flat_model"].agg(lambda s: s.mode().iloc[0]).to_dict()
    own = tx[tx["unit_id"].isin([t["unit_id"] for t in targets if not t["estimated"]])]
    area_own = own.groupby(["unit_id", "flat_type"])["floor_area_sqm"].median().to_dict()
    model_own = own.groupby(["unit_id", "flat_type"])["flat_model"].agg(lambda s: s.mode().iloc[0]).to_dict()

    live = []
    for t in targets:
        b = blocks.loc[t["unit_id"]]
        f = live_feats[(t["unit_id"], t["cutoff"])]
        horizon = int(min(max(t["m0"] - t["cutoff"], 1), max(HORIZONS)))
        floors = int(b["max_floor_lvl"] or 12)
        for ft in sold_types[t["unit_id"]]:
            area = area_own.get((t["unit_id"], ft)) or area_town.get((b["town"], ft)) or area_all.get(ft)
            fm = model_own.get((t["unit_id"], ft)) or model_town.get((b["town"], ft)) or model_all.get(ft)
            if area is None:
                continue
            for low in range(1, floors + 1, 3):
                high = min(low + 2, floors)
                live.append({
                    **t, "town": b["town"], "flat_type": ft, "flat_model": fm, "floor_area_sqm": float(area),
                    "storey_low": low, "storey_high": high, "storey_mid": (low + high) / 2,
                    "lease_left_years": 99 - (t["m0"] / 12 - t["lc"]), "max_floor_lvl": b["max_floor_lvl"],
                    "total_dwelling_units": b["total_dwelling_units"], "latitude": b["latitude"],
                    "longitude": b["longitude"], "horizon": horizon, **row_features(f, ft),
                })
    live = pd.DataFrame(live)
    L = encoder.matrix(live)
    is_check = (live["model"] == "check").to_numpy()
    rel = np.where(is_check, check_model.predict(L), final.predict(L))
    sqft = live["floor_area_sqm"].to_numpy() * SQFT_PER_SQM
    idx_now = float(np.mean(idx[-3:]))
    live["trend_method"] = [selector.choose(c, h) for c, h in zip(live["cutoff"], live["horizon"])]
    fc = np.array([trend_forecast(idx, c - idx_start, m - idx_start, meth)
                   for c, m, meth in zip(live["cutoff"], live["m0"], live["trend_method"])])
    live["today"] = np.exp(rel + idx_now) * sqft
    live["nominal"] = np.exp(rel + fc) * sqft
    for kind in ("today", "nominal"):
        lo_hi = np.array([ranges.get((h, kind), ranges[(1, kind)]) for h in nearest_horizon(live["horizon"])])
        live[f"{kind}_low"] = live[kind] * np.exp(lo_hi[:, 0])
        live[f"{kind}_high"] = live[kind] * np.exp(lo_hi[:, 1])

    conn.execute("DROP TABLE IF EXISTS mop_predictions")
    conn.execute(
        """
        CREATE TABLE mop_predictions (
            unit_id TEXT, flat_type TEXT, flat_model TEXT, floor_area_sqm REAL, storey_low INTEGER, storey_high INTEGER,
            mop_month TEXT, mop_estimated INTEGER, asof_month TEXT, horizon_months INTEGER,
            today_price REAL, today_low REAL, today_high REAL, nominal_price REAL, nominal_low REAL, nominal_high REAL
        )
        """
    )
    conn.executemany(
        "INSERT INTO mop_predictions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (r.unit_id, r.flat_type, r.flat_model, r.floor_area_sqm, r.storey_low, r.storey_high, month_str(r.m0),
             r.estimated, month_str(r.cutoff), r.horizon, *(round(float(v), -2) for v in (
                 r.today, r.today_low, r.today_high, r.nominal, r.nominal_low, r.nominal_high)))
            for r in live.itertuples(index=False)
        ],
    )
    conn.execute("CREATE INDEX idx_mop_unit ON mop_predictions(unit_id)")

    # Each sale of a just-MOP'd block vs what the pre-MOP model said for that exact flat.
    jt = {t["unit_id"]: t for t in targets if not t["estimated"]}
    js = tx[tx["unit_id"].isin(jt)].join(blocks[["max_floor_lvl", "total_dwelling_units", "latitude", "longitude"]], on="unit_id")
    check_rows = []
    for r in js.itertuples(index=False):
        t = jt[r.unit_id]
        check_rows.append({
            "unit_id": r.unit_id, "month": r.month, "mi": r.mi, "cutoff": t["cutoff"], "town": r.town,
            "flat_type": r.flat_type, "flat_model": r.flat_model, "floor_area_sqm": r.floor_area_sqm,
            "storey_low": r.storey_low, "storey_high": r.storey_high, "storey_mid": (r.storey_low + r.storey_high) / 2,
            "lease_left_years": 99 - (r.mi / 12 - r.lc), "max_floor_lvl": r.max_floor_lvl,
            "total_dwelling_units": r.total_dwelling_units, "latitude": r.latitude, "longitude": r.longitude,
            "horizon": 1, "price": r.resale_price, **row_features(live_feats[(r.unit_id, t["cutoff"])], r.flat_type),
        })
    conn.execute("DROP TABLE IF EXISTS mop_check")
    conn.execute(
        """
        CREATE TABLE mop_check (
            unit_id TEXT, month TEXT, flat_type TEXT, storey_low INTEGER, storey_high INTEGER, floor_area_sqm REAL,
            resale_price REAL, pred_price REAL, asof_month TEXT
        )
        """
    )
    check_summary = None
    if check_rows:
        cr = pd.DataFrame(check_rows)
        assert (cr["cutoff"] < cr["mi"]).all() and (cr["cutoff"] >= just_from - 1).all()
        crel = check_model.predict(encoder.matrix(cr))
        cfc = np.array([trend_forecast(idx, c - idx_start, m - idx_start, selector.choose(c, 1)) for c, m in zip(cr["cutoff"], cr["mi"])])
        cr["pred"] = np.exp(crel + cfc) * cr["floor_area_sqm"] * SQFT_PER_SQM
        conn.executemany(
            "INSERT INTO mop_check VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [(r.unit_id, r.month, r.flat_type, r.storey_low, r.storey_high, r.floor_area_sqm, r.price,
              round(float(r.pred), -2), month_str(r.cutoff)) for r in cr.itertuples(index=False)],
        )
        check_summary = metrics(cr["price"].to_numpy(), cr["pred"].to_numpy())
        print(f"Just-MOP'd check: {len(cr):,} sales, MAPE {check_summary['mape']:.1%}")
    conn.execute("CREATE INDEX idx_mopcheck_unit ON mop_check(unit_id)")

    summary = {
        "trained_at": time.strftime("%Y-%m-%d %H:%M"),
        "latest_month": month_str(latest),
        "events": int(len(events)),
        "training_rows": int(len(data)),
        "report_from_year": REPORT_FROM_YEAR,
        "trend_methods_live": {str(e["horizon"]): e["live_method"] for e in trend_table},
        "debut_offset_months": debut_offset,
        "in_mop_blocks": int(sum(t["estimated"] for t in targets)),
        "just_mopd_blocks": int(sum(not t["estimated"] for t in targets)),
        "prediction_rows": int(len(live)),
        "just_mopd_check": check_summary,
    }
    conn.execute("DROP TABLE IF EXISTS mop_meta")
    conn.execute("CREATE TABLE mop_meta (key TEXT PRIMARY KEY, value TEXT)")
    conn.executemany(
        "INSERT INTO mop_meta VALUES (?, ?)",
        [
            ("summary", json.dumps(summary)),
            ("by_horizon", json.dumps(by_horizon)),
            ("by_year", json.dumps(by_year)),
            ("trend", json.dumps(trend_table)),
            ("checks", json.dumps(checks)),
        ],
    )
    conn.commit()
    conn.close()
    print(f"{summary['in_mop_blocks']} in-MOP + {summary['just_mopd_blocks']} just-MOP'd blocks, "
          f"{len(live):,} rows in {time.time() - started:.0f}s")


def nearest_horizon(hs) -> list[int]:
    return [min(HORIZONS, key=lambda x: abs(x - h)) for h in hs]


if __name__ == "__main__":
    main()
