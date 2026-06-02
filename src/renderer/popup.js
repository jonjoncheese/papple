const qEl = document.getElementById("q");
const ansEl = document.getElementById("answers");
const fbEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next");
const hintBtn = document.getElementById("hint");
let current = null;

async function load() {
  fbEl.textContent = ""; ansEl.innerHTML = ""; nextBtn.style.display = "none"; hintBtn.style.display = "";
  current = await window.papple.getNext();
  if (!current) { qEl.textContent = "That's all 10 — nice work today! 🍍"; hintBtn.style.display = "none"; return; }
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
    const submit = document.createElement("button");
    submit.className = "opt"; submit.textContent = "Submit";
    submit.onclick = () => answerTyped(input.value);
    ansEl.appendChild(input); ansEl.appendChild(submit);
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
  const r = await window.papple.submitAnswer(current.id, { typedAnswer: value });
  showFeedback(r);
}

function showFeedback(r) {
  fbEl.textContent = (r.correct ? "✅ " : "❌ ") + (r.feedback || r.explanation || "");
  hintBtn.style.display = "none";
  nextBtn.style.display = "";
}

hintBtn.onclick = async () => { hintBtn.disabled = true; fbEl.textContent = "💡 " + await window.papple.getHint(current.id); hintBtn.disabled = false; };
nextBtn.onclick = load;
load();
