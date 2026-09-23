// ============================================================
// QUESTION DATA
// Order matters — it must match backend/app.py's build_short_features
// and build_long_features exactly.
// ============================================================

const SHORT_QUESTIONS = [
  { id: "Q1", type: "likert", section: "Big Five — Extraversion",
    text: "I enjoy being around people and feel comfortable in social situations." },
  { id: "Q2", type: "likert", section: "Big Five — Extraversion",
    text: "I start conversations with people rather than waiting for them to begin." },

  { id: "Q3", type: "ab", section: "MBTI — Introvert / Extrovert",
    text: "In social situations, you are more likely to:",
    a: "Be communicative", b: "Be quite restrained and calm" },
  { id: "Q4", type: "ab", section: "MBTI — Introvert / Extrovert",
    text: "With a stranger, you are more likely to:",
    a: "Talk freely with almost anyone", b: "Not always find what to say" },

  { id: "Q5", type: "ab", section: "MBTI — Feeling / Thinking",
    text: "When making an important decision, you are more likely to:",
    a: "Trust your feelings", b: "Trust logic" },
  { id: "Q6", type: "ab", section: "MBTI — Feeling / Thinking",
    text: "You value:",
    a: "Feelings more than logic", b: "Logic more than feelings" },
  { id: "Q7", type: "ab", section: "MBTI — Feeling / Thinking",
    text: "When solving an important problem, you are more likely to:",
    a: "Trust your feelings", b: "Trust logical reasoning" },

  { id: "Q8", type: "likert", section: "Neuroticism",
    text: "I get stressed out easily." },
  { id: "Q9", type: "likert", section: "Neuroticism",
    text: "I worry about things." },
  { id: "Q10", type: "likert", section: "Neuroticism",
    text: "I get upset easily." },
  { id: "Q11", type: "likert", section: "Neuroticism",
    text: "I change my mood a lot." },
  { id: "Q12", type: "likert", section: "Neuroticism",
    text: "I have frequent mood swings." },
];

// Standard IPIP-50 wording for the Big Five items (public domain).
const EXT_TEXT = [
  "I am the life of the party.", "I don't talk a lot.", "I feel comfortable around people.",
  "I keep in the background.", "I start conversations.", "I have little to say.",
  "I talk to a lot of different people at parties.", "I don't like to draw attention to myself.",
  "I don't mind being the center of attention.", "I am quiet around strangers.",
];
const EST_TEXT = [
  "I get stressed out easily.", "I am relaxed most of the time.", "I worry about things.",
  "I seldom feel blue.", "I am easily disturbed.", "I get upset easily.",
  "I change my mood a lot.", "I have frequent mood swings.", "I get irritated easily.",
  "I often feel blue.",
];

const LONG_MBTI_EI_IDS = [1, 5, 9, 13, 17, 21, 29, 33, 37, 41, 65, 81, 97];
const LONG_MBTI_TF_IDS = [
  3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 54, 55,
  59, 63, 79, 91, 95, 103, 107, 114, 115, 127,
];

function buildLongQuestions() {
  const qs = [];
  let n = 1;

  EXT_TEXT.forEach((text) => {
    qs.push({ id: `Q${n++}`, type: "likert", section: "Big Five — Extraversion", text });
  });

  LONG_MBTI_EI_IDS.forEach((code) => {
    qs.push({
      id: `Q${n++}`, type: "ab", section: "MBTI — Introvert / Extrovert",
      text: `Item q${code} (placeholder wording — see note above)`,
      a: "Option A", b: "Option B",
    });
  });

  LONG_MBTI_TF_IDS.forEach((code) => {
    qs.push({
      id: `Q${n++}`, type: "ab", section: "MBTI — Feeling / Thinking",
      text: `Item q${code} (placeholder wording — see note above)`,
      a: "Option A", b: "Option B",
    });
  });

  EST_TEXT.forEach((text) => {
    qs.push({ id: `Q${n++}`, type: "likert", section: "Neuroticism", text });
  });

  return qs;
}

const LONG_QUESTIONS = buildLongQuestions();

// ============================================================
// STATE + DOM
// ============================================================

let currentSurvey = "short";

const form = document.getElementById("surveyForm");
const resultsSection = document.getElementById("results");
const resultGrid = document.getElementById("resultGrid");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const longWarning = document.getElementById("longWarning");
const apiBaseInput = document.getElementById("apiBase");
const apiStatus = document.getElementById("apiStatus");

document.querySelectorAll(".toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".toggle-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    currentSurvey = btn.dataset.survey;
    longWarning.hidden = currentSurvey !== "long";
    resultsSection.hidden = true;
    renderSurvey();
  });
});

document.getElementById("retakeBtn").addEventListener("click", () => {
  resultsSection.hidden = true;
  form.reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ============================================================
// RENDER FORM
// ============================================================

function renderSurvey() {
  const questions = currentSurvey === "short" ? SHORT_QUESTIONS : LONG_QUESTIONS;
  form.innerHTML = "";

  let currentSection = null;
  let sectionEl = null;

  questions.forEach((q) => {
    if (q.section !== currentSection) {
      currentSection = q.section;
      sectionEl = document.createElement("div");
      sectionEl.className = "q-section";
      const h = document.createElement("h3");
      h.className = "q-section-title";
      h.textContent = currentSection;
      sectionEl.appendChild(h);
      form.appendChild(sectionEl);
    }

    const qEl = document.createElement("div");
    qEl.className = "question";

    const p = document.createElement("p");
    p.textContent = q.text;
    qEl.appendChild(p);

    if (q.type === "likert") {
      qEl.appendChild(renderLikert(q.id));
    } else {
      qEl.appendChild(renderAB(q));
    }

    sectionEl.appendChild(qEl);
  });
}

function renderLikert(id) {
  const row = document.createElement("div");
  row.className = "likert-row";

  const left = document.createElement("span");
  left.className = "scale-label";
  left.textContent = "Disagree";
  row.appendChild(left);

  const opts = document.createElement("div");
  opts.className = "likert-options";
  for (let v = 1; v <= 7; v++) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = id;
    input.value = v;
    input.required = true;
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.textContent = v;
    label.appendChild(input);
    label.appendChild(dot);
    opts.appendChild(label);
  }
  row.appendChild(opts);

  const right = document.createElement("span");
  right.className = "scale-label right";
  right.textContent = "Agree";
  row.appendChild(right);

  return row;
}

function renderAB(q) {
  const wrap = document.createElement("div");
  wrap.className = "ab-options";

  ["A", "B"].forEach((letter) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = q.id;
    input.value = letter;
    input.required = true;
    const card = document.createElement("span");
    card.className = "ab-card";
    card.textContent = `${letter} — ${letter === "A" ? q.a : q.b}`;
    label.appendChild(input);
    label.appendChild(card);
    wrap.appendChild(label);
  });

  return wrap;
}

// ============================================================
// SUBMIT
// ============================================================

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const questions = currentSurvey === "short" ? SHORT_QUESTIONS : LONG_QUESTIONS;
  const answers = [];

  for (const q of questions) {
    const checked = form.querySelector(`input[name="${q.id}"]:checked`);
    if (!checked) {
      formError.textContent = "Please answer every question before submitting.";
      checked?.focus();
      return;
    }
    answers.push(checked.value);
  }

  const apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
  const endpoint = `${apiBase}/api/predict/${currentSurvey}`;

  submitBtn.disabled = true;
  submitBtn.textContent = "Scoring…";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Server returned ${res.status}`);
    }

    const data = await res.json();
    renderResults(data);
  } catch (err) {
    formError.textContent = `Could not reach the model API: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Get my results";
  }
});

function renderResults(data) {
  resultGrid.innerHTML = "";

  const cards = [
    {
      label: "Social orientation",
      value: data.introvert_extrovert.label,
      fill: data.introvert_extrovert.probability_extrovert,
      sub: `${data.introvert_extrovert.probability_extrovert}% Extrovert · Big Five model: ${data.introvert_extrovert.big5_component}% · MBTI model: ${data.introvert_extrovert.mbti_component}%`,
    },
    {
      label: "Decision style",
      value: data.feeling_thinking.label,
      fill: data.feeling_thinking.probability_thinking,
      sub: `${data.feeling_thinking.probability_thinking}% Thinking`,
    },
    {
      label: "Stress response",
      value: data.neuroticism.label,
      fill: data.neuroticism.probability_high,
      sub: `${data.neuroticism.probability_high}% probability of high neuroticism`,
    },
  ];

  cards.forEach((c) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <p class="r-label">${c.label}</p>
      <p class="r-value">${c.value}</p>
      <div class="r-bar-track"><div class="r-bar-fill" style="width:${c.fill}%"></div></div>
      <p class="r-sub">${c.sub}</p>
    `;
    resultGrid.appendChild(card);
  });

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

// ============================================================
// API health check
// ============================================================

async function checkApi() {
  const apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
  apiStatus.textContent = "checking…";
  apiStatus.className = "api-status";
  try {
    const res = await fetch(`${apiBase}/api/health`);
    if (!res.ok) throw new Error();
    apiStatus.textContent = "API connected";
    apiStatus.className = "api-status ok";
  } catch {
    apiStatus.textContent = "API unreachable";
    apiStatus.className = "api-status error";
  }
}

apiBaseInput.addEventListener("change", checkApi);

// ============================================================
// INIT
// ============================================================

renderSurvey();
checkApi();
