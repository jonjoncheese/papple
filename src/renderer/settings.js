const $ = id => document.getElementById(id);

function applyTheme(t) { document.documentElement.dataset.theme = t; }

function updateApiRow() {
  const mode = $("aiMode").value;
  const help = {
    gemini: "Free key from aistudio.google.com/apikey — fast and free.",
    openai: "Key from platform.openai.com — paid per use.",
    claude: "Key from console.anthropic.com — paid per use (needs API credits)."
  };
  if (mode === "claude-code") { $("apiRow").style.display = "none"; }
  else { $("apiRow").style.display = ""; $("apiHelp").textContent = help[mode] || ""; }
}

async function init() {
  const s = await window.papple.getSettings();
  $("theme").value = s.theme || "dark"; applyTheme($("theme").value);
  $("aiMode").value = s.aiMode || "claude-code";
  $("apiKey").value = s.apiKey || "";
  $("apiModel").value = s.apiModel || "";
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
