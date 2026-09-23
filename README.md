# Personality Prediction — Frontend + API

Turns the 8 models trained in `Final_Personality_Prediction.ipynb` (Logistic
Regression / Random Forest, predicting Introvert–Extrovert, Feeling–Thinking,
and Neuroticism from a 12-question or 58-question survey) into:

- **`backend/`** — a Flask REST API that loads the 8 exported `.pkl` models
  and serves predictions.
- **`frontend/`** — a plain HTML/CSS/JS page where a user fills out the
  survey and sees their predicted profile, calling the API above.

```
project/
├── backend/
│   ├── app.py            Flask API
│   ├── requirements.txt
│   └── models/           the 8 .pkl files (already copied in)
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## 1. Run the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API starts on `http://localhost:5000`. Check it's alive:

```bash
curl http://localhost:5000/api/health
```

You'll see an `InconsistentVersionWarning` from scikit-learn if your
installed version doesn't exactly match the one the models were pickled
with (1.6.1). It's usually harmless for these simple models, but if you see
different predictions than in the notebook, `pip install scikit-learn==1.6.1`
to match exactly.

### Endpoints

| Method | Path                  | Body                                   |
|--------|-----------------------|-----------------------------------------|
| GET    | `/api/health`         | —                                       |
| POST   | `/api/predict/short`  | `{"answers": [Q1..Q12]}`  (12 values)   |
| POST   | `/api/predict/long`   | `{"answers": [Q1..Q58]}`  (58 values)   |

Answers are the **raw** survey values in question order — Likert questions
as numbers 1–7, MBTI questions as the string `"A"` or `"B"`. All the 7→5
rescaling, reverse-scoring, and A/B→0/1 conversion from the notebook happens
server-side in `app.py`, so the frontend never has to know about it.

Response shape:
```json
{
  "introvert_extrovert": {"label": "Extrovert", "probability_extrovert": 89.1, "big5_component": 84.2, "mbti_component": 94.0},
  "feeling_thinking":   {"label": "Thinking", "probability_thinking": 95.2},
  "neuroticism":        {"label": "Low Neuroticism", "probability_high": 0.3}
}
```

## 2. Run the frontend

No build step — it's plain HTML/CSS/JS. Just open `frontend/index.html` in a
browser, or serve it so it doesn't run into `file://` CORS quirks:

```bash
cd frontend
python -m http.server 8000
# then open http://localhost:8000
```

At the top of the page there's an **"Model API address"** field (defaults
to `http://localhost:5000`). If you deploy the backend somewhere else
(Render, Railway, PythonAnywhere, etc.), paste that URL in — no code changes
needed.

## 3. What to know before you demo/submit this

- **Long survey is 58 questions, not 69.** The notebook's `long_survey_answers.csv`
  has 69 columns, but only Q1–Q58 are ever fed into a model (Q59–Q69 are
  collected in the notebook but unused by any model). The frontend only
  asks the 58 that actually matter — worth a sentence in your report so it
  doesn't look like an oversight.
- **The 38 MBTI items in the long survey use placeholder text.** `kpmi_data.csv`
  (the original question bank) wasn't part of what was uploaded, so
  `frontend/script.js` labels those "Item q5 (placeholder wording)" with
  generic Option A / Option B choices. Search for `LONG_MBTI_EI_IDS` and
  `LONG_MBTI_TF_IDS` in `script.js` and add a `text`/`a`/`b` per item once
  you have the real wording — the question **order** is already correct.
- **Big Five (EXT/EST) wording** uses the standard public-domain IPIP-50
  items, matching what your Kaggle dataset is built from.
- **E/I prediction is a blend**, exactly as in the notebook: the Big Five
  model and the MBTI model each vote, and the two probabilities are
  averaged before thresholding at 50%.
- The dev server (`python app.py`) is fine for a class demo but isn't meant
  for production; if you need it reachable outside your machine, deploy
  `backend/` to something like Render or Railway (both have a free tier)
  rather than relying on this dev server.

## 4. Connecting this back to "Colab as the backend"

Your teacher's note said the frontend could connect to "the Colab-based
model through an API." What's actually happening here: the notebook trained
and exported the models (`saved_models/*.pkl`, already in `backend/models/`)
— reproducible in Colab — and this Flask app is what serves them over HTTP.
If you want the API itself running *inside* Colab (rather than as a
standalone service), the same `app.py` logic can run there behind `ngrok`;
ask if you want that variant too — it's a few extra lines but the tunnel URL
changes every time the notebook restarts, which is a bit brittle for a live
demo.
