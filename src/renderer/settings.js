const $ = id => document.getElementById(id);
let savedApiModel = "";

function applyTheme(t) { document.documentElement.dataset.theme = t; }

const MODELS = {
  gemini: [
    ["gemini-2.5-flash", "Gemini 2.5 Flash — free + fast (recommended)"],
    ["gemini-flash-latest", "Gemini Flash (latest)"],
    ["gemini-2.5-pro", "Gemini 2.5 Pro — smarter, slower"]
  ],
  openai: [
    ["gpt-4o-mini", "GPT-4o mini — fast + cheap"],
    ["gpt-4o", "GPT-4o — smarter"],
    ["gpt-4.1-mini", "GPT-4.1 mini"]
  ],
  claude: [
    ["claude-haiku-4-5-20251001", "Claude Haiku 4.5 — fast + cheap"],
    ["claude-sonnet-4-6", "Claude Sonnet 4.6 — smarter"],
    ["claude-opus-4-8", "Claude Opus 4.8 — best, priciest"]
  ]
};

function populateModels(mode, selected) {
  const sel = $("apiModel");
  sel.innerHTML = "";
  (MODELS[mode] || []).forEach(([v, label]) => {
    const o = document.createElement("option"); o.value = v; o.textContent = label; sel.appendChild(o);
  });
  if (selected && [...sel.options].some(o => o.value === selected)) sel.value = selected;
}

function updateApiRow() {
  const mode = $("aiMode").value;
  const help = {
    gemini: "Free key from aistudio.google.com/apikey — fast and free.",
    openai: "Key from platform.openai.com — paid per use.",
    claude: "Key from console.anthropic.com — paid per use (needs API credits)."
  };
  if (mode === "claude-code") { $("apiRow").style.display = "none"; }
  else { $("apiRow").style.display = ""; $("apiHelp").textContent = help[mode] || ""; populateModels(mode, savedApiModel); }
}

async function init() {
  const s = await window.papple.getSettings();
  $("theme").value = s.theme || "dark"; applyTheme($("theme").value);
  $("aiMode").value = s.aiMode || "claude-code";
  $("apiKey").value = s.apiKey || "";
  savedApiModel = s.apiModel || "";
  $("questionsPerDay").value = s.questionsPerDay;
  $("answerMode").value = s.answerMode;
  $("endlessMode").checked = s.endlessMode !== false;
  $("pace").value = s.pace;
  $("hydrationEnabled").checked = s.hydration.enabled;
  $("hydrationIntervalMin").value = s.hydration.intervalMin;
  $("quietStartHour").value = s.quietStartHour;
  $("quietEndHour").value = s.quietEndHour;
  updateApiRow();

  const decks = await window.papple.listDecks();
  const active = s.activeDecks.length ? s.activeDecks : decks;
  const box = $("decks"); box.innerHTML = "";
  if (!decks.length) { box.innerHTML = '<small class="help">No subject folders yet — click “Open my sources folder” and make some.</small>'; return; }
  decks.forEach(d => {
    const label = document.createElement("label"); label.className = "toggle deck";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = d; cb.checked = active.includes(d);
    const span = document.createElement("span"); span.textContent = d;
    label.appendChild(cb); label.appendChild(span); box.appendChild(label);
  });
}

$("aiMode").onchange = updateApiRow;
$("theme").onchange = () => applyTheme($("theme").value);
$("openFolder").onclick = () => window.papple.openSourcesFolder();
$("resetQ").onclick = async () => {
  const btn = $("resetQ");
  btn.disabled = true; $("resetStatus").textContent = "wiping + regenerating…";
  try { await window.papple.resetQuestions(); $("resetStatus").textContent = "fresh batch ready ✓"; }
  catch (e) { $("resetStatus").textContent = "failed: " + (e && e.message ? e.message : "error"); }
  btn.disabled = false;
  setTimeout(() => $("resetStatus").textContent = "", 3000);
};

$("save").onclick = async () => {
  const decks = [...document.querySelectorAll("#decks input:checked")].map(c => c.value);
  await window.papple.saveSettings({
    theme: $("theme").value,
    aiMode: $("aiMode").value,
    apiKey: $("apiKey").value,
    apiModel: $("apiModel").value,
    questionsPerDay: Number($("questionsPerDay").value),
    answerMode: $("answerMode").value,
    endlessMode: $("endlessMode").checked,
    pace: $("pace").value,
    hydration: { enabled: $("hydrationEnabled").checked, intervalMin: Number($("hydrationIntervalMin").value) },
    quietStartHour: Number($("quietStartHour").value),
    quietEndHour: Number($("quietEndHour").value),
    activeDecks: decks
  });
  $("status").textContent = "saved ✓";
  setTimeout(() => $("status").textContent = "", 1500);
};

init();
