const bubble = document.getElementById("bubble");
const badge = document.getElementById("badge");
const buddy = document.getElementById("buddy");

function say(text, ms = 4000) {
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(say._t);
  say._t = setTimeout(() => bubble.classList.remove("show"), ms);
}

async function refreshBadge() {
  const st = await window.papple.getStatus();
  badge.textContent = `🔥 ${st.streak} · ${st.today.correct}/${st.today.total}`;
}

buddy.addEventListener("click", () => window.papple.openPopup());
window.papple.onHydrate(() => say("sip some water 🥤"));

refreshBadge();
setInterval(refreshBadge, 30_000);
say("click me to start your 10! 🍍");
