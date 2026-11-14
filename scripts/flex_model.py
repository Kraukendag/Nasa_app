# =============================================================================
#  MICRO FLAMMA  ·  flex_model.py
# =============================================================================
#  A logistic regression fitted to the real FLEX droplet tests (PSI-69). It
#  estimates how likely a test was to end in Extinction, given its conditions.
#
#  WHAT CHANGED, AND WHY
#  ---------------------
#  An earlier version reported "81% accuracy". On its own that was misleading:
#  69% of FLEX tests ended in extinction, so a "model" that always answers
#  extinction scores 69% without learning anything. Random cross-validation
#  also let near-identical repeat tests land on both sides of the split, which
#  flatters the score. This version:
#
#    * reports the always-extinction BASELINE next to every score,
#    * reports BALANCED accuracy (fair to the rarer outcomes) and AUC,
#    * cross-validates by GROUP, keeping repeat tests at the same conditions
#      together so the model is always scored on conditions it has not seen,
#    * exports the training points, so the website can refuse to predict for a
#      COMBINATION of inputs that FLEX never came near -- not just for inputs
#      that are individually out of range.
# =============================================================================

import math

FEATURES = ["is_heptane", "o2_mole_fraction", "co2_mole_fraction",
            "he_mole_fraction", "pressure_mmhg", "droplet_d0_mm"]


def _sigmoid(z):
    z = max(-30.0, min(30.0, z))
    return 1.0 / (1.0 + math.exp(-z))


def _fit(x, y, epochs=3000, lr=0.15, l2=0.01):
    """Gradient-descent logistic regression with a small L2 penalty."""
    k = len(x[0])
    w, b = [0.0] * k, 0.0
    n = len(x)
    for _ in range(epochs):
        gw, gb = [0.0] * k, 0.0
        for row, label in zip(x, y):
            err = _sigmoid(b + sum(wi * xi for wi, xi in zip(w, row))) - label
            for j in range(k):
                gw[j] += err * row[j]
            gb += err
        for j in range(k):
            w[j] -= lr * (gw[j] / n + l2 * w[j])
        b -= lr * gb / n
    return b, w


def _auc(scores, labels):
    """Area under the ROC curve via ranks (Mann-Whitney)."""
    pairs = sorted(zip(scores, labels))
    pos = sum(labels)
    neg = len(labels) - pos
    if pos == 0 or neg == 0:
        return None
    rank_sum, i = 0.0, 0
    while i < len(pairs):
        j = i
        while j < len(pairs) and pairs[j][0] == pairs[i][0]:
            j += 1
        avg_rank = (i + 1 + j) / 2.0          # ties share their average rank
        rank_sum += avg_rank * sum(1 for p in pairs[i:j] if p[1] == 1)
        i = j
    return (rank_sum - pos * (pos + 1) / 2.0) / (pos * neg)


def _balanced_accuracy(pred, labels):
    tp = sum(1 for p, l in zip(pred, labels) if p == 1 and l == 1)
    tn = sum(1 for p, l in zip(pred, labels) if p == 0 and l == 0)
    pos = sum(labels)
    neg = len(labels) - pos
    return 0.5 * ((tp / pos if pos else 0) + (tn / neg if neg else 0))


def build_flex_model(flex_tests):
    rows, labels, groups = [], [], []
    for test in flex_tests:
        n = test["normalized"]
        if n.get("outcome_class") not in ("Extinction", "Disruption", "Completion"):
            continue
        if "zero_pressure_outlier" in test["anomalies"]:
            continue
        values = [1.0 if n.get("substance") == "Heptane" else 0.0, n.get("o2_mole_fraction"),
                  n.get("co2_mole_fraction"), n.get("he_mole_fraction"),
                  n.get("pressure_mmhg"), n.get("droplet_d0_mm")]
        if any(v is None for v in values):
            continue            # fit only on complete rows; never fill gaps
        rows.append([float(v) for v in values])
        labels.append(1 if n["outcome_class"] == "Extinction" else 0)
        # Repeat tests at the same fuel / atmosphere / pressure form one group.
        groups.append((values[0], round(values[1], 2), round(values[2], 2),
                       round(values[3], 2), round(values[4] / 25.0)))

    if len(rows) < 20:
        return {"available": False, "reason": "not enough complete rows"}

    k = len(FEATURES)
    means = [sum(r[j] for r in rows) / len(rows) for j in range(k)]
    stds = []
    for j in range(k):
        var = sum((r[j] - means[j]) ** 2 for r in rows) / len(rows)
        stds.append(math.sqrt(var) or 1.0)
    scaled = [[(r[j] - means[j]) / stds[j] for j in range(k)] for r in rows]

    # ---- Grouped 5-fold cross-validation -----------------------------------
    # Whole groups are dealt to folds, largest first, always into the fold that
    # currently holds the fewest rows. Deterministic, and repeats never leak.
    distinct = sorted(set(groups), key=lambda g: -groups.count(g))
    fold_of, fold_size = {}, [0] * 5
    for g in distinct:
        target = fold_size.index(min(fold_size))
        fold_of[g] = target
        fold_size[target] += groups.count(g)

    oof_scores = [0.0] * len(rows)
    fold_acc = []
    for f in range(5):
        train = [i for i in range(len(rows)) if fold_of[groups[i]] != f]
        test = [i for i in range(len(rows)) if fold_of[groups[i]] == f]
        if not test:
            continue
        b, w = _fit([scaled[i] for i in train], [labels[i] for i in train], epochs=1500)
        correct = 0
        for i in test:
            p = _sigmoid(b + sum(wj * xj for wj, xj in zip(w, scaled[i])))
            oof_scores[i] = p
            correct += int((p > 0.5) == (labels[i] == 1))
        fold_acc.append(correct / len(test))

    oof_pred = [1 if s > 0.5 else 0 for s in oof_scores]
    accuracy = sum(int(p == l) for p, l in zip(oof_pred, labels)) / len(labels)
    base_rate = sum(labels) / len(labels)
    baseline = max(base_rate, 1 - base_rate)

    # ---- Final model and its support region --------------------------------
    b, w = _fit(scaled, labels, epochs=4000)

    # For every training point, the distance to its nearest OTHER training
    # point. The 95th percentile becomes the threshold: a user's input farther
    # than that from every real test is outside the tested combinations.
    def dist(a, c):
        return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, c)))
    nn = []
    for i, a in enumerate(scaled):
        nn.append(min(dist(a, c) for j, c in enumerate(scaled) if j != i))
    nn.sort()
    threshold = nn[int(0.95 * (len(nn) - 1))]

    ranges = {name: {"min": min(r[j] for r in rows), "max": max(r[j] for r in rows)}
              for j, name in enumerate(FEATURES)}

    return {
        "available": True,
        "target": "Extinction versus other outcomes (Disruption or Completion)",
        "features": FEATURES,
        "bias": b,
        "weights": w,
        "feature_means": means,
        "feature_stds": stds,
        "feature_ranges": ranges,
        "n_training_rows": len(rows),
        "n_condition_groups": len(distinct),
        "metrics": {
            "accuracy": round(accuracy, 4),
            "balanced_accuracy": round(_balanced_accuracy(oof_pred, labels), 4),
            "auc": round(_auc(oof_scores, labels), 4),
            "baseline_accuracy": round(baseline, 4),
            "fold_accuracy": [round(a, 4) for a in fold_acc],
            "validation": "grouped 5-fold cross-validation (repeat conditions kept together)",
        },
        "base_rate": round(base_rate, 4),
        "support": {
            "points": [[round(x, 3) for x in p] for p in scaled],
            "nn_threshold": round(threshold, 4),
            "note": "95th percentile of nearest-neighbour distance between FLEX tests",
        },
        "disclaimer": ("Statistical fit to recorded FLEX outcomes. Not a physical model. "
                       "Shown only for input combinations close to tests FLEX actually ran."),
        "source": {"psi_id": "PSI-69", "doi": "10.60555/mbq8-0451"},
    }
