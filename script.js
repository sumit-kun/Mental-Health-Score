// ---------- Config ----------
const API_BASE_URL = 'https://mental-health-score-1-9rln.onrender.com';
const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;

// Assumed display range for the gauge only (visual approximation, not a hard backend contract)
const GAUGE_MIN = 0;
const GAUGE_MAX = 10;
const GAUGE_ARC_LENGTH = 283; // matches the SVG path's approximate length

// ---------- Element refs ----------
const form = document.getElementById('predictForm');
const submitBtn = document.getElementById('submitBtn');
const btnLabel = submitBtn.querySelector('.btn-label');
const btnSpinner = submitBtn.querySelector('.btn-spinner');
const formError = document.getElementById('formError');

const resultView = document.getElementById('resultView');
const scoreValueEl = document.getElementById('scoreValue');
const gaugeFill = document.getElementById('gaugeFill');
const resultMessage = document.getElementById('resultMessage');
const restartBtn = document.getElementById('restartBtn');

// ---------- Segmented controls (Gender, Stress_Level) ----------
const segmentedGroups = document.querySelectorAll('.segmented');

segmentedGroups.forEach((group) => {
  const buttons = group.querySelectorAll('.seg-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      group.dataset.value = btn.dataset.value;
    });
  });
});

// ---------- Sliders: live value display ----------
const sliderConfigs = [
  { input: 'usageHours', output: 'usageHoursVal' },
  { input: 'studyHours', output: 'studyHoursVal' },
  { input: 'activityHours', output: 'activityHoursVal' },
  { input: 'sleepHours', output: 'sleepHoursVal' },
];

sliderConfigs.forEach(({ input, output }) => {
  const inputEl = document.getElementById(input);
  const outputEl = document.getElementById(output);
  inputEl.addEventListener('input', () => {
    outputEl.textContent = inputEl.value;
  });
});

// ---------- Helpers ----------
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnSpinner.hidden = !isLoading;
  btnLabel.textContent = isLoading ? 'Checking in…' : 'See my score';
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearFormError() {
  formError.hidden = true;
  formError.textContent = '';
}

function getSegmentedValue(name) {
  const group = document.querySelector(`.segmented[data-name="${name}"]`);
  return group ? group.dataset.value || '' : '';
}

function collectPayload() {
  const formData = new FormData(form);

  const payload = {
    Age: Number(formData.get('Age')),
    Gender: getSegmentedValue('Gender'),
    Country: (formData.get('Country') || '').trim(),
    Academic_Level: formData.get('Academic_Level'),
    Most_Used_Platform: formData.get('Most_Used_Platform'),
    Purpose_Of_Use: formData.get('Purpose_Of_Use'),
    Avg_Daily_Usage_Hours: Number(formData.get('Avg_Daily_Usage_Hours')),
    Daily_Unlocks: Number(formData.get('Daily_Unlocks')),
    Study_Hours: Number(formData.get('Study_Hours')),
    Physical_Activity_Hours: Number(formData.get('Physical_Activity_Hours')),
    Sleep_Hours_Per_Night: Number(formData.get('Sleep_Hours_Per_Night')),
    Stress_Level: getSegmentedValue('Stress_Level'),
  };

  return payload;
}

function validatePayload(payload) {
  const missing = [];

  if (!payload.Age) missing.push('Age');
  if (!payload.Gender) missing.push('Gender');
  if (!payload.Country) missing.push('Country');
  if (!payload.Academic_Level) missing.push('Academic level');
  if (!payload.Most_Used_Platform) missing.push('Most used platform');
  if (!payload.Purpose_Of_Use) missing.push('Purpose of use');
  if (!payload.Daily_Unlocks && payload.Daily_Unlocks !== 0) missing.push('Phone unlocks per day');
  if (!payload.Stress_Level) missing.push('Stress level');

  return missing;
}

function formatValidationErrors(detail) {
  if (!Array.isArray(detail)) return 'Please check your inputs and try again.';
  const lines = detail.map((d) => {
    const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : 'field';
    return `${field}: ${d.msg}`;
  });
  return lines.join(' · ');
}

function scoreToLabel(score) {
  if (score >= 7.5) return "You're showing strong balance with your habits right now.";
  if (score >= 5) return 'Things look fairly steady, with some room to recharge more.';
  if (score >= 2.5) return 'Your day-to-day patterns may be taking a toll — small changes could help.';
  return 'These patterns suggest real strain. Consider talking to someone you trust.';
}

function renderResult(score) {
  const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, score));
  const ratio = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
  const offset = GAUGE_ARC_LENGTH - ratio * GAUGE_ARC_LENGTH;

  // Color interpolation: coral (low) -> lavender (mid) -> teal (high)
  const color = ratio < 0.5
    ? interpolateColor('#e4674b', '#8a7fba', ratio / 0.5)
    : interpolateColor('#8a7fba', '#2e9e8f', (ratio - 0.5) / 0.5);

  scoreValueEl.textContent = score.toFixed(2);
  resultMessage.textContent = scoreToLabel(clamped);

  form.hidden = true;
  resultView.hidden = false;

  // Animate on next frame so the transition actually plays
  requestAnimationFrame(() => {
    gaugeFill.style.stroke = color;
    gaugeFill.style.strokeDashoffset = offset;
  });
}

function interpolateColor(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function resetGauge() {
  gaugeFill.style.strokeDashoffset = GAUGE_ARC_LENGTH;
}

// ---------- Submit handler ----------
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormError();

  const payload = collectPayload();
  const missing = validatePayload(payload);

  if (missing.length > 0) {
    showFormError(`Please fill in: ${missing.join(', ')}.`);
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = `Request failed (status ${response.status}).`;
      try {
        const errBody = await response.json();
        if (errBody && errBody.detail) {
          message = formatValidationErrors(errBody.detail);
        }
      } catch (_) {
        // response wasn't JSON — keep the generic message
      }
      showFormError(message);
      return;
    }

    const data = await response.json();
    const score = Number(data.predicted_mental_health_score);

    if (Number.isNaN(score)) {
      showFormError("The server responded, but no score came back. Please try again.");
      return;
    }

    renderResult(score);
  } catch (err) {
    showFormError(
      `Couldn't reach the prediction server at ${API_BASE_URL}. Make sure the FastAPI backend is running (uvicorn main:app --port 2468 --reload).`
    );
  } finally {
    setLoading(false);
  }
});

// ---------- Restart ----------
restartBtn.addEventListener('click', () => {
  resultView.hidden = true;
  form.hidden = false;
  resetGauge();
  clearFormError();
});
