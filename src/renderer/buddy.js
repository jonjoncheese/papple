window.papple.getSettings().then(s => { if (s.theme) document.documentElement.dataset.theme = s.theme; }).catch(() => {});

const bubble = document.getElementById("bubble");
const buddy = document.getElementById("buddy");
const face = document.getElementById("face");
const delay = ms => new Promise(r => setTimeout(r, ms));

let frame = "papple.png";        // current resting frame
let sleeping = false;

function setFace(name) { frame = name; face.src = name; }
function bounce() { face.classList.remove("bounce"); void face.offsetWidth; face.classList.add("bounce"); }

function say(text, ms = 4000) {
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(say._t);
  if (ms < 999999) say._t = setTimeout(() => bubble.classList.remove("show"), ms);
}
function hideBubble() { clearTimeout(say._t); bubble.classList.remove("show"); }

async function wave(times = 3) {
  for (let i = 0; i < times; i++) { face.src = "papple-wave.png"; await delay(230); face.src = frame; await delay(230); }
}

// --- blink every few seconds (skip while sleeping or waving) ---
setInterval(() => {
  if (sleeping || frame.includes("wave")) return;
  const prev = frame;
  face.src = "papple-blink.png";
  setTimeout(() => { if (!sleeping) face.src = prev; }, 150);
}, 5000 + Math.random() * 3000);

// --- sleep when idle for a while; wake on interaction ---
let idleTimer;
function sleep() { sleeping = true; document.body.classList.add("sleeping"); setFace("papple-blink.png"); say("💤", 999999); }
function wake() { if (!sleeping) return; sleeping = false; document.body.classList.remove("sleeping"); setFace("papple.png"); hideBubble(); }
function resetIdle() { wake(); clearTimeout(idleTimer); idleTimer = setTimeout(sleep, 90000); }

// --- run away after 10 rapid consecutive clicks ---
let clickCount = 0, lastClick = 0;
function registerRapidClick() {
  const now = Date.now();
  clickCount = (now - lastClick < 1500) ? clickCount + 1 : 1;
  lastClick = now;
  if (clickCount >= 10) { clickCount = 0; say("okok too many clicks!! 🏃💨", 2500); window.papple.runAway(); }
}

// --- interactions (responsive!) ---
buddy.addEventListener("mouseenter", () => { window.papple.setIgnore(false); resetIdle(); });
buddy.addEventListener("mouseleave", () => window.papple.setIgnore(true));
buddy.addEventListener("click", () => { resetIdle(); bounce(); registerRapidClick(); window.papple.togglePopup(); });
window.papple.onHydrate(() => { wake(); say("sip some water 🥤"); });

// --- launch: wave hello ---
(async () => {
  await delay(300);
  say("hi, i'm papple! i live on your computer — close me anytime from the tray 🍍", 6500);
  await wave(4);
  resetIdle();
})();

// --- occasional spontaneous wave to feel alive ---
setInterval(() => { if (!sleeping && !frame.includes("wave")) wave(2); }, 35000);
