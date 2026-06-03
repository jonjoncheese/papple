const $ = id => document.getElementById(id);

async function init() {
  const s = await window.papple.getSettings();
  $("theme").value = s.theme || "dark";
  document.documentElement.dataset.theme = s.theme || "dark";
  $("theme").onchange = () => { document.documentElement.dataset.theme = $("theme").value; };
  $("aiMode").value = s.aiMode;
  $("apiKey").value = s.apiKey || "";
  $("ollamaModel").value = s.ollamaModel || "qwen2.5:3b";
  $("endlessMode").checked = s.endlessMode !== false;
  $("questionsPerDay").value = s.questionsPerDay;
  $("answerMode").value = s.answerMode;
  $("pace").value = s.pace;
  $("nudgeIntervalMin").value = s.nudgeIntervalMin;
  $("quietStartHour").value = s.quietStartHour;
  $("quietEndHour").value = s.quietEndHour;
  $("hydrationEnabled").checked = s.hydration.enabled;
  $("hydrationIntervalMin").value = s.hydration.intervalMin;

  const decks = await window.papple.listDecks();
  const active = s.activeDecks.length ? s.activeDecks : decks;
  const box = $("decks");
  box.innerHTML = "";
  decks.forEach(d => {
    const label = document.createElement("label");
    label.className = "deck";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = d; cb.checked = active.includes(d);
    label.appendChild(cb); label.append(" " + d);
    box.appendChild(label);
  });
}

$("save").onclick = async () => {
  const decks = [...document.querySelectorAll("#decks input:checked")].map(c => c.value);
  await window.papple.saveSettings({
    theme: $("theme").value,
    aiMode: $("aiMode").value,
    apiKey: $("apiKey").value,
    ollamaModel: $("ollamaModel").value,
    endlessMode: $("endlessMode").checked,
    questionsPerDay: Number($("questionsPerDay").value),
    answerMode: $("answerMode").value,
    pace: $("pace").value,
    nudgeIntervalMin: Number($("nudgeIntervalMin").value),
    quietStartHour: Number($("quietStartHour").value),
    quietEndHour: Number($("quietEndHour").value),
    hydration: { enabled: $("hydrationEnabled").checked, intervalMin: Number($("hydrationIntervalMin").value) },
    activeDecks: decks
  });
  $("status").textContent = "saved ✓";
  setTimeout(() => $("status").textContent = "", 1500);
};

init();
