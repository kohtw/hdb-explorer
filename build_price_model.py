"""Train a resale price model and predict a value for every HDB block.

Gradient-boosted trees (scikit-learn HistGradientBoostingRegressor) learn
log(resale price) from the last 3 years of resales, using the flat itself
(type, model, size, storey, lease left, month) and its block's location and
livability measures (town, coordinates, MRT/bus access, CBD commute,
amenities, schools, block height and size). Two quantile models give an 80%
range.

Accuracy is measured honestly: train on all but the latest 6 months, test on
those unseen months, compare with a town + flat type median baseline. The
final models are then refit on the whole window.

Writes to data/hdb.db:
  predictions       one row per block x flat type x 3-storey band, priced at the
                    latest month with the block's typical flat for that type
  sale_predictions  each sale in the last 12 months with an out-of-fold model
                    price (from a model that didn't train on it)
  model_meta        JSON blobs: summary metrics, factor importance, predicted vs
                    actual sample, error by town

and saves the final models to data/price_model.pkl so the web app can price
any flat a user describes.

Run after build_livability.py.
"""

import json
import math
import pathlib
import pickle
import sqlite3
import time
from collections import Counter, defaultdict

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance

DB_FILE = pathlib.Path(__file__).parent / "data" / "hdb.db"
MODEL_FILE = pathlib.Path(__file__).parent / "data" / "price_model.pkl"
WINDOW_MONTHS = 36
TEST_MONTHS = 6
RANDOM_STATE = 0
CROSS_FIT_FOLDS = 4
UNIT_TYPE_COLUMNS = {
    "1 ROOM": "1room_sold",
    "2 ROOM": "2room_sold",
    "3 ROOM": "3room_sold",
    "4 ROOM": "4room_sold",
    "5 ROOM": "5room_sold",
    "EXECUTIVE": "exec_sold",
    "MULTI-GENERATION": "multigen_sold",
}

CATEGORICAL = ["town", "flat_type", "flat_model"]
NUMERIC = [
    "floor_area_sqm", "storey_mid", "lease_years", "month_index", "latitude", "longitude",
    "rail_min", "cbd_min", "lines_15min", "interchange_min", "bus_services_400m",
    "nearest_hawker_m", "hawkers_1km", "nearest_gp_m", "gps_1km", "nearest_polyclinic_m",
    "nearest_hospital_m", "nearest_park_m", "parks_1km", "primary_1km", "primary_2km",
    "max_floor_lvl", "total_dwelling_units",
]
FEATURES = CATEGORICAL + NUMERIC
# Factor groups for the importance chart (permuting one feature at a time understates correlated groups).
FEATURE_GROUPS = {
    "Floor area": ["floor_area_sqm"],
    "Flat type & model": ["flat_type", "flat_model"],
    "Lease left": ["lease_years"],
    "Storey": ["storey_mid"],
    "Town & location": ["town", "latitude", "longitude"],
    "CBD commute": ["cbd_min"],
    "MRT & bus access": ["rail_min", "lines_15min", "interchange_min", "bus_services_400m"],
    "Hawker food": ["nearest_hawker_m", "hawkers_1km"],
    "Healthcare": ["nearest_gp_m", "gps_1km", "nearest_polyclinic_m", "nearest_hospital_m"],
    "Parks": ["nearest_park_m", "parks_1km"],
    "Schools": ["primary_1km", "primary_2km"],
    "Block height & size": ["max_floor_lvl", "total_dwelling_units"],
    "Month of sale": ["month_index"],
}
LIVABILITY_COLUMNS = [
    "town", "latitude", "longitude", "rail_min", "cbd_min", "lines_15min", "interchange_min", "bus_services_400m",
    "nearest_hawker_m", "hawkers_1km", "nearest_gp_m", "gps_1km", "nearest_polyclinic_m", "nearest_hospital_m",
    "nearest_park_m", "parks_1km", "primary_1km", "primary_2km", "lease_left_years",
]
MISSING_MINUTES = 99


def month_index(month: str) -> int:
    return int(month[:4]) * 12 + int(month[5:7]) - 1


def shift_month(month: str, delta: int) -> str:
    total = month_index(month) + delta
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def make_model(loss: str = "squared_error", quantile: float | None = None) -> HistGradientBoostingRegressor:
    kwargs = {"quantile": quantile} if quantile is not None else {}
    return HistGradientBoostingRegressor(
        loss=loss,
        learning_rate=0.06,
        max_iter=700,
        max_leaf_nodes=63,
        min_samples_leaf=30,
        l2_regularization=0.1,
        categorical_features=[FEATURES.index(c) for c in CATEGORICAL],
        random_state=RANDOM_STATE,
        **kwargs,
    )


class Encoder:
    """Integer codes for categorical columns; unseen values map to a shared 'other' code."""

    def __init__(self, rows: list[dict] | None = None, codes: dict | None = None):
        self.codes = codes or {c: {v: i for i, v in enumerate(sorted({r[c] for r in rows}))} for c in CATEGORICAL}

    def matrix(self, rows: list[dict]) -> np.ndarray:
        out = np.empty((len(rows), len(FEATURES)), dtype=np.float64)
        for i, r in enumerate(rows):
            for j, c in enumerate(FEATURES):
                if c in self.codes:
                    out[i, j] = self.codes[c].get(r[c], len(self.codes[c]))
                else:
                    v = r[c]
                    out[i, j] = np.nan if v is None else float(v)
        return out


def load_training_rows(conn: sqlite3.Connection, since: str) -> list[dict]:
    liv = ", ".join(f"l.{c}" for c in LIVABILITY_COLUMNS)
    rows = conn.execute(
        f"""
        SELECT t.month, t.flat_type, t.flat_model, t.floor_area_sqm, t.storey_low, t.storey_high,
               t.remaining_lease_months, t.resale_price, t.unit_id, {liv},
               p.max_floor_lvl, p.total_dwelling_units
        FROM transactions t
        JOIN livability l ON l.unit_id = t.unit_id
        JOIN property_info p ON p.unit_id = t.unit_id
        WHERE t.month >= ?
        """,
        (since,),
    )
    cols = [d[0] for d in rows.description]
    out = []
    for values in rows:
        r = dict(zip(cols, values))
        r["storey_mid"] = (r["storey_low"] + r["storey_high"]) / 2
        r["lease_years"] = r["remaining_lease_months"] / 12
        r["month_index"] = month_index(r["month"])
        if r["interchange_min"] is None:
            r["interchange_min"] = MISSING_MINUTES
        out.append(r)
    return out


def load_blocks(conn: sqlite3.Connection, unit_id: str | None = None) -> list[dict]:
    """Scored blocks with everything the model needs about the block itself."""
    liv_cols = ", ".join(f"l.{c}" for c in ["unit_id"] + LIVABILITY_COLUMNS)
    cursor = conn.execute(
        f"""
        SELECT {liv_cols}, p.max_floor_lvl, p.total_dwelling_units, p.year_completed,
               {', '.join(f'p."{c}"' for c in UNIT_TYPE_COLUMNS.values())}
        FROM livability l JOIN property_info p ON p.unit_id = l.unit_id
        {"WHERE l.unit_id = ?" if unit_id else ""}
        """,
        (unit_id,) if unit_id else (),
    )
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, v)) for v in cursor]


def flat_row(block: dict, flat_type: str, flat_model: str, area: float, low: int, high: int, month_idx: int) -> dict:
    """One flat in a block, as a model input row."""
    return {
        **block,
        "flat_type": flat_type,
        "flat_model": flat_model,
        "floor_area_sqm": area,
        "storey_low": low,
        "storey_high": high,
        "storey_mid": (low + high) / 2,
        "lease_years": block["lease_left_years"],
        "month_index": month_idx,
        "interchange_min": block["interchange_min"] if block["interchange_min"] is not None else MISSING_MINUTES,
    }


def metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    ape = np.abs(predicted - actual) / actual
    ss_res = float(np.sum((actual - predicted) ** 2))
    ss_tot = float(np.sum((actual - actual.mean()) ** 2))
    return {
        "mae": float(np.mean(np.abs(predicted - actual))),
        "mape": float(np.mean(ape)),
        "median_ape": float(np.median(ape)),
        "within_5pct": float(np.mean(ape <= 0.05)),
        "within_10pct": float(np.mean(ape <= 0.10)),
        "r2": 1 - ss_res / ss_tot if ss_tot else None,
    }


def grouped_importance(model, X: np.ndarray, y: np.ndarray, rng: np.random.Generator) -> list[dict]:
    """Drop in accuracy (MAE on log price) when a whole factor group is shuffled together."""
    base = float(np.mean(np.abs(model.predict(X) - y)))
    results = []
    for label, cols in FEATURE_GROUPS.items():
        idx = [FEATURES.index(c) for c in cols]
        losses = []
        for _ in range(3):
            Xp = X.copy()
            perm = rng.permutation(len(X))
            Xp[:, idx] = X[perm][:, idx]
            losses.append(float(np.mean(np.abs(model.predict(Xp) - y))) - base)
        results.append({"factor": label, "importance": sum(losses) / len(losses)})
    total = sum(max(0.0, r["importance"]) for r in results) or 1.0
    for r in results:
        r["share"] = max(0.0, r["importance"]) / total
    return sorted(results, key=lambda r: -r["importance"])


def main() -> None:
    started = time.time()
    conn = sqlite3.connect(DB_FILE)
    latest = conn.execute("SELECT MAX(month) FROM transactions").fetchone()[0]
    since = shift_month(latest, -(WINDOW_MONTHS - 1))
    test_from = shift_month(latest, -(TEST_MONTHS - 1))
    rows = load_training_rows(conn, since)
    print(f"{len(rows):,} resales {since}..{latest} joined to block data")

    encoder = Encoder(rows)
    X = encoder.matrix(rows)
    y = np.log(np.array([r["resale_price"] for r in rows]))
    is_test = np.array([r["month"] >= test_from for r in rows])
    X_train, y_train, X_test, y_test = X[~is_test], y[~is_test], X[is_test], y[is_test]

    # ----- honest evaluation on the latest unseen months -----
    eval_model = make_model().fit(X_train, y_train)
    lo_eval = make_model("quantile", 0.1).fit(X_train, y_train)
    hi_eval = make_model("quantile", 0.9).fit(X_train, y_train)
    pred_test = np.exp(eval_model.predict(X_test))
    actual_test = np.exp(y_test)
    lo_log, hi_log = lo_eval.predict(X_test), hi_eval.predict(X_test)
    model_metrics = metrics(actual_test, pred_test)
    model_metrics["raw_interval_coverage"] = float(np.mean((y_test >= lo_log) & (y_test <= hi_log)))

    # Conformalized quantile regression: widen the range by the margin that makes it cover 80% on one
    # half of the unseen months, then report coverage on the other half so the figure isn't circular.
    rng = np.random.default_rng(RANDOM_STATE)
    order = rng.permutation(len(y_test))
    calib, check = order[: len(order) // 2], order[len(order) // 2 :]
    scores = np.maximum(lo_log[calib] - y_test[calib], y_test[calib] - hi_log[calib])
    n_cal = len(calib)
    interval_margin = float(np.quantile(scores, min(1.0, math.ceil((n_cal + 1) * 0.8) / n_cal)))
    covered = (y_test[check] >= lo_log[check] - interval_margin) & (y_test[check] <= hi_log[check] + interval_margin)
    model_metrics["interval_coverage"] = float(np.mean(covered))
    model_metrics["interval_margin"] = interval_margin

    baseline_groups = defaultdict(list)
    for r, test in zip(rows, is_test):
        if not test:
            baseline_groups[(r["town"], r["flat_type"])].append(r["resale_price"])
    baseline_median = {k: float(np.median(v)) for k, v in baseline_groups.items()}
    test_rows = [r for r, t in zip(rows, is_test) if t]
    baseline_pred = np.array([baseline_median.get((r["town"], r["flat_type"]), np.median(actual_test)) for r in test_rows])
    baseline_metrics = metrics(actual_test, baseline_pred)
    print(f"Test ({len(test_rows):,} sales since {test_from}): model MAPE {model_metrics['mape']:.1%}, "
          f"R2 {model_metrics['r2']:.3f}, baseline MAPE {baseline_metrics['mape']:.1%}, 80% range covers "
          f"{model_metrics['raw_interval_coverage']:.0%} raw, {model_metrics['interval_coverage']:.0%} calibrated")

    sample = rng.choice(len(X_test), size=min(6000, len(X_test)), replace=False)
    importance = grouped_importance(eval_model, X_test[sample], y_test[sample], rng)

    town_err = defaultdict(list)
    for r, p, a in zip(test_rows, pred_test, actual_test):
        town_err[r["town"]].append(abs(p - a) / a)
    town_errors = sorted(
        ({"town": t, "mape": float(np.mean(v)), "n": len(v)} for t, v in town_err.items() if len(v) >= 30),
        key=lambda d: d["mape"],
    )
    scatter_idx = rng.choice(len(test_rows), size=min(2500, len(test_rows)), replace=False)
    scatter = [
        [round(float(actual_test[i])), round(float(pred_test[i])), test_rows[i]["flat_type"], test_rows[i]["town"]]
        for i in scatter_idx
    ]

    # ----- out-of-fold predictions for each recent sale, so "actual vs model" isn't flattered -----
    folds = rng.integers(0, CROSS_FIT_FOLDS, size=len(y))
    oof = np.empty(len(y))
    for k in range(CROSS_FIT_FOLDS):
        oof[folds == k] = make_model().fit(X[folds != k], y[folds != k]).predict(X[folds == k])
    recent_from = shift_month(latest, -11)
    conn.execute("DROP TABLE IF EXISTS sale_predictions")
    conn.execute(
        """
        CREATE TABLE sale_predictions (
            unit_id TEXT, month TEXT, flat_type TEXT, storey_low INTEGER, storey_high INTEGER,
            floor_area_sqm REAL, resale_price REAL, pred_price REAL
        )
        """
    )
    conn.executemany(
        "INSERT INTO sale_predictions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (r["unit_id"], r["month"], r["flat_type"], r["storey_low"], r["storey_high"], r["floor_area_sqm"],
             r["resale_price"], round(float(np.exp(p)), -2))
            for r, p in zip(rows, oof)
            if r["month"] >= recent_from
        ],
    )
    conn.execute("CREATE INDEX idx_salepred_unit ON sale_predictions(unit_id)")

    # ----- final models on the whole window -----
    final = make_model().fit(X, y)
    final_lo = make_model("quantile", 0.1).fit(X, y)
    final_hi = make_model("quantile", 0.9).fit(X, y)

    with MODEL_FILE.open("wb") as f:
        pickle.dump(
            {"price": final, "low": final_lo, "high": final_hi, "codes": encoder.codes,
             "interval_margin": interval_margin, "month": latest},
            f,
        )

    # ----- predict every block x flat type x storey band at the latest month -----
    blocks = load_blocks(conn)

    area_rows = conn.execute("SELECT unit_id, town, flat_type, floor_area_sqm, flat_model FROM transactions WHERE year >= ?", (int(latest[:4]) - 10,))
    block_area, town_area, type_area = defaultdict(list), defaultdict(list), defaultdict(list)
    block_model, town_model, type_model = defaultdict(Counter), defaultdict(Counter), defaultdict(Counter)
    for unit_id, town, flat_type, area, flat_model in area_rows:
        block_area[(unit_id, flat_type)].append(area)
        town_area[(town, flat_type)].append(area)
        type_area[flat_type].append(area)
        block_model[(unit_id, flat_type)][flat_model] += 1
        town_model[(town, flat_type)][flat_model] += 1
        type_model[flat_type][flat_model] += 1

    latest_index = month_index(latest)
    pred_rows = []
    for b in blocks:
        floors = b["max_floor_lvl"] or 12
        for flat_type, col in UNIT_TYPE_COLUMNS.items():
            if not b[col] or not type_area.get(flat_type):
                continue
            key = (b["unit_id"], flat_type)
            areas = block_area.get(key) or town_area.get((b["town"], flat_type)) or type_area[flat_type]
            models = block_model.get(key) or town_model.get((b["town"], flat_type)) or type_model[flat_type]
            area = float(np.median(areas))
            flat_model = models.most_common(1)[0][0]
            for low in range(1, floors + 1, 3):
                high = min(low + 2, max(floors, low))
                pred_rows.append(flat_row(b, flat_type, flat_model, area, low, high, latest_index))

    P = encoder.matrix(pred_rows)
    price = np.exp(final.predict(P))
    low = np.exp(final_lo.predict(P) - interval_margin)
    high = np.exp(final_hi.predict(P) + interval_margin)
    conn.execute("DROP TABLE IF EXISTS predictions")
    conn.execute(
        """
        CREATE TABLE predictions (
            unit_id TEXT, flat_type TEXT, flat_model TEXT, floor_area_sqm REAL, storey_low INTEGER, storey_high INTEGER,
            pred_price REAL, pred_low REAL, pred_high REAL, pred_psf REAL
        )
        """
    )
    conn.executemany(
        "INSERT INTO predictions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                r["unit_id"], r["flat_type"], r["flat_model"], r["floor_area_sqm"], r["storey_low"], r["storey_high"],
                round(float(p), -2), round(float(min(lo_, p)), -2), round(float(max(hi_, p)), -2),
                round(float(p) / (r["floor_area_sqm"] * 10.7639), 2),
            )
            for r, p, lo_, hi_ in zip(pred_rows, price, low, high)
        ],
    )
    conn.execute("CREATE INDEX idx_pred_unit ON predictions(unit_id)")

    summary = {
        "trained_at": time.strftime("%Y-%m-%d %H:%M"),
        "algorithm": "Gradient-boosted trees (scikit-learn HistGradientBoostingRegressor) on log resale price",
        "window": {"from": since, "to": latest},
        "test_from": test_from,
        "n_train": int((~is_test).sum()),
        "n_test": int(is_test.sum()),
        "n_total": len(rows),
        "n_features": len(FEATURES),
        "model": model_metrics,
        "baseline": baseline_metrics,
        "predicted_blocks": len({r["unit_id"] for r in pred_rows}),
        "prediction_rows": len(pred_rows),
        "predicted_month": latest,
    }
    conn.execute("DROP TABLE IF EXISTS model_meta")
    conn.execute("CREATE TABLE model_meta (key TEXT PRIMARY KEY, value TEXT)")
    conn.executemany(
        "INSERT INTO model_meta VALUES (?, ?)",
        [
            ("summary", json.dumps(summary)),
            ("importance", json.dumps(importance)),
            ("scatter", json.dumps(scatter)),
            ("town_errors", json.dumps(town_errors)),
        ],
    )
    conn.commit()
    conn.close()
    print(f"Predicted {len(pred_rows):,} rows for {summary['predicted_blocks']:,} blocks in {time.time() - started:.0f}s")
    print("Top factors:", ", ".join(f"{r['factor']} {r['share']:.0%}" for r in importance[:6]))


if __name__ == "__main__":
    main()
