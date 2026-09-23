"""
Personality Prediction API
==========================
Wraps the 8 models trained in the Colab notebook (Final_Personality_Prediction.ipynb)
behind a small Flask REST API so a separate frontend can call it.

Endpoints
---------
GET  /api/health
POST /api/predict/short   body: {"answers": [Q1..Q12]}
POST /api/predict/long    body: {"answers": [Q1..Q58]}

Run
---
pip install -r requirements.txt
python app.py
# Server starts on http://localhost:5000
"""

import os
import pickle

import pandas as pd
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    """Allow the separately-hosted frontend to call this API from any origin."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/predict/<survey>", methods=["OPTIONS"])
def preflight(survey):
    return "", 204

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")


# ---------------------------------------------------------------------------
# Load the 8 trained models once at startup
# ---------------------------------------------------------------------------
def load_model(name):
    path = os.path.join(MODELS_DIR, f"{name}.pkl")
    with open(path, "rb") as f:
        return pickle.load(f)


MODELS = {
    "short_Big5_EI": load_model("short_Big5_EI"),
    "short_MBTI_EI": load_model("short_MBTI_EI"),
    "short_MBTI_TF": load_model("short_MBTI_TF"),
    "short_Neuroticism": load_model("short_Neuroticism"),
    "long_Big5_EI": load_model("long_Big5_EI"),
    "long_MBTI_EI": load_model("long_MBTI_EI"),
    "long_MBTI_TF": load_model("long_MBTI_TF"),
    "long_Neuroticism": load_model("long_Neuroticism"),
}


# ---------------------------------------------------------------------------
# Feature-engineering helpers (mirror the notebook exactly)
# ---------------------------------------------------------------------------
def convert_7_to_5(v):
    """Rescale a 1-7 Likert answer to the 1-5 scale the models were trained on."""
    return 1 + (float(v) - 1) * 4 / 6


def ab_to_binary(v):
    """A -> 0, B -> 1 (also accepts 0/1 directly)."""
    if isinstance(v, str):
        v = v.strip().upper()
        if v == "A":
            return 0
        if v == "B":
            return 1
    return int(v)


def proba_class1(model, df):
    """predict_proba for class '1', robust to class ordering."""
    proba = model.predict_proba(df)[0]
    classes = list(model.classes_)
    return float(proba[classes.index(1)])


def combine_ei(b5_ei_prob, mbti_ei_prob):
    final_prob = (b5_ei_prob + mbti_ei_prob) / 2
    label = "Extrovert" if final_prob >= 0.5 else "Introvert"
    return label, final_prob


def label_tf(prob):
    return "Thinking" if prob >= 0.5 else "Feeling"


def label_n(prob):
    return "High Neuroticism" if prob >= 0.5 else "Low Neuroticism"


# ---------------------------------------------------------------------------
# SHORT SURVEY  (12 answers: Q1..Q12)
#   Q1,Q2        Likert 1-7  -> Big Five E/I   (EXT3, EXT5)
#   Q3,Q4        A/B         -> MBTI E/I       (q1, q21)
#   Q5,Q6,Q7     A/B         -> MBTI T/F       (q19, q11, q3)
#   Q8..Q12      Likert 1-7  -> Neuroticism    (EST1, EST3, EST6, EST7, EST8)
#                               (all 5 reverse-scored: 6 - x, per notebook)
# ---------------------------------------------------------------------------
def build_short_features(answers):
    if len(answers) != 12:
        raise ValueError(f"Expected 12 answers, got {len(answers)}")

    q = answers

    b5_ei_df = pd.DataFrame(
        [[convert_7_to_5(q[0]), convert_7_to_5(q[1])]],
        columns=["EXT3", "EXT5"],
    )

    mbti_ei_df = pd.DataFrame(
        [[ab_to_binary(q[2]), ab_to_binary(q[3])]],
        columns=["q1", "q21"],
    )

    mbti_tf_df = pd.DataFrame(
        [[ab_to_binary(q[4]), ab_to_binary(q[5]), ab_to_binary(q[6])]],
        columns=["q19", "q11", "q3"],
    )

    n_vals = [convert_7_to_5(v) for v in q[7:12]]
    n_vals = [6 - v for v in n_vals]  # reverse-score, matches notebook exactly
    n_df = pd.DataFrame([n_vals], columns=["EST1", "EST3", "EST6", "EST7", "EST8"])

    return b5_ei_df, mbti_ei_df, mbti_tf_df, n_df


# ---------------------------------------------------------------------------
# LONG SURVEY  (58 answers: Q1..Q58 — Q59..Q69 from the original 69-item
#   design were never consumed by any model in the notebook, so they are
#   intentionally excluded here)
#   Q1..Q10      Likert 1-7  -> Big Five E/I   (EXT1..EXT10)
#                               reverse-scored: EXT2, EXT4, EXT6, EXT8, EXT10
#   Q11..Q23     A/B         -> MBTI E/I       (13 items)
#   Q24..Q48     A/B         -> MBTI T/F       (25 items)
#   Q49..Q58     Likert 1-7  -> Neuroticism    (EST1..EST10, all reverse-scored)
# ---------------------------------------------------------------------------
LONG_MBTI_EI_COLS = ["q1", "q5", "q9", "q13", "q17", "q21", "q29", "q33", "q37", "q41", "q65", "q81", "q97"]
LONG_MBTI_TF_COLS = [
    "q3", "q7", "q11", "q15", "q19", "q23", "q27", "q31", "q35", "q39", "q43", "q47",
    "q51", "q54", "q55", "q59", "q63", "q79", "q91", "q95", "q103", "q107", "q114", "q115", "q127",
]
EXT_REVERSE_IDX = {1, 3, 5, 7, 9}  # 0-based positions of EXT2, EXT4, EXT6, EXT8, EXT10


def build_long_features(answers):
    if len(answers) != 58:
        raise ValueError(f"Expected 58 answers, got {len(answers)}")

    q = answers

    # --- Big Five E/I : Q1-Q10 -> EXT1..EXT10 ---
    ext_vals = [convert_7_to_5(v) for v in q[0:10]]
    ext_vals = [6 - v if i in EXT_REVERSE_IDX else v for i, v in enumerate(ext_vals)]
    b5_ei_df = pd.DataFrame([ext_vals], columns=[f"EXT{i}" for i in range(1, 11)])

    # --- MBTI E/I : Q11-Q23 (13 items) ---
    mbti_ei_vals = [ab_to_binary(v) for v in q[10:23]]
    mbti_ei_df = pd.DataFrame([mbti_ei_vals], columns=LONG_MBTI_EI_COLS)

    # --- MBTI T/F : Q24-Q48 (25 items) ---
    mbti_tf_vals = [ab_to_binary(v) for v in q[23:48]]
    mbti_tf_df = pd.DataFrame([mbti_tf_vals], columns=LONG_MBTI_TF_COLS)

    # --- Neuroticism : Q49-Q58 -> EST1..EST10, all reverse-scored ---
    est_vals = [convert_7_to_5(v) for v in q[48:58]]
    est_vals = [6 - v for v in est_vals]
    n_df = pd.DataFrame([est_vals], columns=[f"EST{i}" for i in range(1, 11)])

    return b5_ei_df, mbti_ei_df, mbti_tf_df, n_df


# ---------------------------------------------------------------------------
# Shared prediction runner
# ---------------------------------------------------------------------------
def run_prediction(prefix, b5_ei_df, mbti_ei_df, mbti_tf_df, n_df):
    b5_ei_prob = proba_class1(MODELS[f"{prefix}_Big5_EI"], b5_ei_df)
    mbti_ei_prob = proba_class1(MODELS[f"{prefix}_MBTI_EI"], mbti_ei_df)
    tf_prob = proba_class1(MODELS[f"{prefix}_MBTI_TF"], mbti_tf_df)
    n_prob = proba_class1(MODELS[f"{prefix}_Neuroticism"], n_df)

    ei_label, ei_prob = combine_ei(b5_ei_prob, mbti_ei_prob)
    tf_label = label_tf(tf_prob)
    n_label = label_n(n_prob)

    return {
        "introvert_extrovert": {
            "label": ei_label,
            "probability_extrovert": round(ei_prob * 100, 1),
            "big5_component": round(b5_ei_prob * 100, 1),
            "mbti_component": round(mbti_ei_prob * 100, 1),
        },
        "feeling_thinking": {
            "label": tf_label,
            "probability_thinking": round(tf_prob * 100, 1),
        },
        "neuroticism": {
            "label": n_label,
            "probability_high": round(n_prob * 100, 1),
        },
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "models_loaded": list(MODELS.keys())})


@app.route("/api/predict/short", methods=["POST"])
def predict_short():
    data = request.get_json(force=True) or {}
    answers = data.get("answers")
    if not answers:
        return jsonify({"error": "Missing 'answers' array (expected 12 values)"}), 400
    try:
        dfs = build_short_features(answers)
        result = run_prediction("short", *dfs)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/predict/long", methods=["POST"])
def predict_long():
    data = request.get_json(force=True) or {}
    answers = data.get("answers")
    if not answers:
        return jsonify({"error": "Missing 'answers' array (expected 58 values)"}), 400
    try:
        dfs = build_long_features(answers)
        result = run_prediction("long", *dfs)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    # debug=False for a stable long-running server (flip to True only while
    # actively editing app.py — the auto-reloader can double-load the models)
    app.run(host="0.0.0.0", port=5000, debug=False)
