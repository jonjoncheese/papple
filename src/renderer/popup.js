const qEl = document.getElementById("q");
const ansEl = document.getElementById("answers");
const fbEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next");
const hintBtn = document.getElementById("hint");
const endlessBtn = document.getElementById("endless");
const progressEl = document.getElementById("progress");
let current = null;
let qPerDay = 10;
let endlessOn = false;

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

(async () => {
  const s = await window.papple.getSettings().catch(() => ({}));
  if (s.theme) document.documentElement.dataset.theme = s.theme;
  qPerDay = s.questionsPerDay || 10;
  setEndless(!!s.endlessMode);
})();

function setEndless(on) { endlessOn = on; endlessBtn.classList.toggle("on", on); }

async function updateProgress() {
  try {
    const st = await window.papple.getStatus();
    progressEl.textContent = endlessOn ? `${st.today.total} / ∞` : `${st.today.total} / ${qPerDay}`;
  } catch { /* keep */ }
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
  if (!current) return showDone();
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

function showDone() {
  hintBtn.style.display = "none"; nextBtn.style.display = "none";
  if (endlessOn) { qEl.textContent = "phew — taking a breather. flip ∞ off or come back later 🍍"; return; }
  renderSummary();
}

async function renderSummary() {
  qEl.textContent = "Today's recap 🍍";
  ansEl.innerHTML = '<div class="muted">crunching your results…</div>';
  fbEl.textContent = "";
  const sum = await window.papple.getSummary();
  const pct = sum.answered ? Math.round(sum.correct / sum.answered * 100) : 0;
  let html = '<div class="recap">';
  html += `<div class="score">You got <b>${sum.correct} / ${sum.answered}</b> right — ${pct}% ${pct >= 80 ? "🎉" : pct >= 50 ? "🍍" : "💪"}</div>`;
  if (sum.byTopic.length) {
    html += '<div class="recap-h">How each topic went</div>';
    for (const t of sum.byTopic) {
      const p = Math.round(t.correct / t.total * 100);
      html += `<div class="bar-row"><span class="bar-label" title="${esc(t.name)}">${esc(t.name)}</span>` +
        `<span class="bar"><span class="bar-fill" style="width:${p}%"></span></span>` +
        `<span class="bar-num">${t.correct}/${t.total}</span></div>`;
    }
  }
  if (sum.wrong.length) {
    html += `<div class="recap-h">Worth another look (${sum.wrong.length})</div>`;
    for (const w of sum.wrong) {
      html += `<div class="miss"><div class="miss-q">${esc(w.question)}</div>` +
        (w.answer ? `<div class="miss-a">✓ ${esc(w.answer)}</div>` : "") +
        (w.explanation ? `<div class="miss-e">${esc(w.explanation)}</div>` : "") + `</div>`;
    }
  } else {
    html += '<div class="recap-h">Perfect run — nothing to review! 🌟</div>';
  }
  html += "</div>";
  ansEl.innerHTML = html;
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
  hintBtn.style.display = "none";
  hintBtn.disabled = false;
};
endlessBtn.onclick = async () => {
  const on = !endlessOn;
  setEndless(on);
  await window.papple.saveSettings({ endlessMode: on });
  updateProgress();
  if (on && !current) load(); // we were done → fetch more right away
};
nextBtn.onclick = load;
document.getElementById("close").onclick = () => window.papple.togglePopup();
load();
