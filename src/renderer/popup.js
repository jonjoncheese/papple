const qEl = document.getElementById("q");
const ansEl = document.getElementById("answers");
const fbEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next");
const hintBtn = document.getElementById("hint");
const endlessBtn = document.getElementById("endless");
const progressEl = document.getElementById("progress");
let current = null;
let qPerDay = 10;

(async () => {
  const s = await window.papple.getSettings().catch(() => ({}));
  if (s.theme) document.documentElement.dataset.theme = s.theme;
  qPerDay = s.questionsPerDay || 10;
  setEndless(!!s.endlessMode);
})();

function setEndless(on) { endlessBtn.classList.toggle("on", on); endlessBtn.dataset.on = on ? "1" : ""; }

async function updateProgress() {
  try { const st = await window.papple.getStatus(); progressEl.textContent = `${st.today.total} / ${qPerDay}`; }
  catch { /* leave as-is */ }
}

async function load() {
  fbEl.textContent = ""; ansEl.innerHTML = ""; nextBtn.style.display = "none"; hintBtn.style.display = "";
  qEl.textContent = "Loading your questions… 🍍";
  try {
    current = await window.papple.getNext();
  } catch (e) {
    qEl.textContent = "my brain's buffering… 🌀";
    fbEl.textContent = "Couldn't load questions — set up your AI in Settings. (" + (e && e.message ? e.message : "unknown error") + ")";
    hintBtn.style.display = "none";
    return;
  }
  await updateProgress();
  if (!current) { qEl.textContent = "That's all for today — nice work! 🍍 (flip on ∞ Endless for more)"; hintBtn.style.display = "none"; return; }
  qEl.textContent = current.question;
  if (current.type === "mc") {
    current.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "opt"; b.textContent = opt;
      b.onclick = () => answerMc(b, i);
      ansEl.appendChild(b);
    });
  } else {
    const input = document.createElement("input");
    input.id = "typed"; input.placeholder = "type your answer…";
    input.addEventListener("keydown", e => { if (e.key === "Enter") answerTyped(input.value); });
    const submit = document.createElement("button");
    submit.className = "opt"; submit.textContent = "Submit";
    submit.onclick = () => answerTyped(input.value);
    ansEl.appendChild(input); ansEl.appendChild(submit);
    input.focus();
  }
}

async function answerMc(btn, idx) {
  [...ansEl.children].forEach(c => c.onclick = null);
  const r = await window.papple.submitAnswer(current.id, { selectedIndex: idx });
  btn.classList.add(r.correct ? "correct" : "wrong");
  if (!r.correct) ansEl.children[current.answerIndex].classList.add("correct");
  showFeedback(r);
}

async function answerTyped(value) {
  fbEl.textContent = "checking… 🍍";
  const r = await window.papple.submitAnswer(current.id, { typedAnswer: value });
  showFeedback(r);
}

function showFeedback(r) {
  const detail = r.explanation || r.feedback || "";
  fbEl.textContent = (r.correct ? "✅ " : "❌ ") + detail;
  hintBtn.style.display = "none";
  nextBtn.style.display = "";
  updateProgress();
}

hintBtn.onclick = async () => {
  hintBtn.disabled = true;
  fbEl.textContent = "💡 " + (await window.papple.getHint(current.id).catch(() => "(no hint available)"));
  hintBtn.style.display = "none"; // one hint per question
  hintBtn.disabled = false;
};
endlessBtn.onclick = async () => {
  const on = !endlessBtn.dataset.on;
  setEndless(on);
  await window.papple.saveSettings({ endlessMode: on });
};
nextBtn.onclick = load;
document.getElementById("close").onclick = () => window.papple.togglePopup();
load();
