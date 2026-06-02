const bubble = document.getElementById("bubble");
const buddy = document.getElementById("buddy");

function say(text, ms = 4000) {
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(say._t);
  say._t = setTimeout(() => bubble.classList.remove("show"), ms);
}

buddy.addEventListener("click", () => window.papple.openPopup());
window.papple.onHydrate(() => say("sip some water 🥤"));

say("click me to start your 10! 🍍");
