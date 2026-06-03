window.papple.getSettings().then(s => { if (s.theme) document.documentElement.dataset.theme = s.theme; }).catch(() => {});

const $ = id => document.getElementById(id);
let chosenFolder = null;

$("chooseBtn").onclick = async () => {
  const f = await window.papple.pickFolder();
  if (f) { chosenFolder = f; $("folderPath").textContent = f; }
};

$("start").onclick = async () => {
  $("start").disabled = true;
  $("start").textContent = "setting up… 🍍";
  await window.papple.finishOnboarding(chosenFolder ? { folder: chosenFolder } : {});
  // main process closes this window + starts generating
};
