window.papple.getSettings().then(s => { if (s.theme) document.documentElement.dataset.theme = s.theme; }).catch(() => {});

const bubble = document.getElementById("bubble");
const buddy = document.getElementById("buddy");
const face = document.getElementById("face");
const delay = ms => new Promise(r => setTimeout(r, ms));

let frame = "papple.png";   // current resting frame
let sleeping = false;
let busy = false;           // animation lock (stretch)
let drag = null;            // active drag state

function setFace(name) { frame = name; face.src = name; }
function bounce() { face.classList.remove("bounce"); void face.offsetWidth; face.classList.add("bounce"); }

function say(text, ms = 4000) {
  bubble.textContent = text; bubble.classList.add("show");
  clearTimeout(say._t);
  if (ms < 999999) say._t = setTimeout(() => bubble.classList.remove("show"), ms);
}
function hideBubble() { clearTimeout(say._t); bubble.classList.remove("show"); }

async function wave(times = 3) {
  if (busy || sleeping) return;
  for (let i = 0; i < times; i++) { face.src = "papple-wave.png"; await delay(230); face.src = frame; await delay(230); }
}

// --- blink ---
setInterval(() => {
  if (sleeping || busy || drag || frame.includes("wave")) return;
  const prev = frame;
  face.src = "papple-blink.png";
  setTimeout(() => { if (!sleeping && !busy) face.src = prev; }, 150);
}, 5000 + Math.random() * 3000);

// --- idle → 50/50 sleep or stretch ---
let idleTimer;
function sleep() { sleeping = true; document.body.classList.add("sleeping"); setFace("papple-blink.png"); say("💤", 999999); }
function wake() { if (!sleeping) return; sleeping = false; document.body.classList.remove("sleeping"); setFace("papple.png"); hideBubble(); }
async function stretch() {
  busy = true;
  say("*streeetch* 🙆", 1500);
  face.classList.remove("stretch"); void face.offsetWidth; face.classList.add("stretch");
  await delay(1200);
  face.classList.remove("stretch");
  busy = false;
  resetIdle();
}
function onIdle() { Math.random() < 0.5 ? sleep() : stretch(); }
function resetIdle() { wake(); clearTimeout(idleTimer); idleTimer = setTimeout(onIdle, 90000); }

// --- run away after 10 rapid clicks ---
let clickCount = 0, lastClick = 0;
function registerRapidClick() {
  const now = Date.now();
  clickCount = (now - lastClick < 1500) ? clickCount + 1 : 1;
  lastClick = now;
  if (clickCount >= 10) { clickCount = 0; say("okok too many clicks!! 🏃💨", 2500); window.papple.runAway(); }
}

// --- grab → drag → click / plop / throw ---
buddy.addEventListener("pointerdown", (e) => {
  resetIdle();
  window.papple.setIgnore(false);
  try { buddy.setPointerCapture(e.pointerId); } catch {}
  const t = performance.now();
  drag = {
    moved: 0, startT: t,
    winX: e.screenX - e.clientX, winY: e.screenY - e.clientY,
    lastX: e.screenX, lastY: e.screenY,
    hist: [{ x: e.screenX, y: e.screenY, t }]
  };
});
buddy.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.screenX - drag.lastX, dy = e.screenY - drag.lastY;
  drag.winX += dx; drag.winY += dy;
  drag.lastX = e.screenX; drag.lastY = e.screenY;
  drag.moved += Math.abs(dx) + Math.abs(dy);
  window.papple.dragMove({ x: drag.winX, y: drag.winY });
  drag.hist.push({ x: e.screenX, y: e.screenY, t: performance.now() });
  if (drag.hist.length > 6) drag.hist.shift();
});
buddy.addEventListener("pointerup", (e) => {
  if (!drag) return;
  try { buddy.releasePointerCapture(e.pointerId); } catch {}
  const d = drag; drag = null;
  const dur = performance.now() - d.startT;

  if (d.moved < 6 && dur < 350) {              // tap = click
    bounce(); registerRapidClick(); window.papple.togglePopup();
    return;
  }
  const a = d.hist[0], b = d.hist[d.hist.length - 1];
  const dt = Math.max(1, b.t - a.t);
  const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed >= 0.9) {                          // hard flick = throw
    say("wheee! 🪁", 1500);
    window.papple.throwAway({ vx, vy });
  } else {                                     // gentle release = plop
    face.classList.remove("plop"); void face.offsetWidth; face.classList.add("plop");
    window.papple.savePos({ x: d.winX, y: d.winY });
  }
});

// --- click-through toggle (solid only over Papple) + idle reset ---
buddy.addEventListener("mouseenter", () => { window.papple.setIgnore(false); resetIdle(); });
buddy.addEventListener("mouseleave", () => { if (!drag) window.papple.setIgnore(true); });
window.papple.onHydrate(() => { wake(); say("sip some water 🥤"); });

// --- generation status bubble ---
let genDone = false;
window.papple.onGenStatus((s) => {
  if (s === "ready") { genDone = true; if (!sleeping) say("today's questions are ready — click me! 🍍", 5000); }
  else if (s === "error") { genDone = true; say("couldn't load questions — check Settings 🍍", 8000); }
});

// --- launch: wave hello ---
(async () => {
  await delay(300);
  say("hi, i'm papple! i live on your computer — close me anytime from the tray 🍍", 5000);
  await wave(4);
  if (!genDone) say("brewing today's questions… 🍍", 999999);
  resetIdle();
})();

// --- occasional spontaneous wave ---
setInterval(() => { if (!sleeping && !busy && !drag && !frame.includes("wave")) wave(2); }, 35000);
