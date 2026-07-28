window.papple.getSettings().then(s => { if (s.theme) document.documentElement.dataset.theme = s.theme; }).catch(() => {});

const $ = id => document.getElementById(id);
let current = { prompt: "", siteUrl: "", siteLabel: "ChatGPT" };

function showErr(msg) {
  $("err").hidden = !msg;
  $("err").textContent = msg || "";
}

window.papple.onHandoffStart((payload) => {
  current = payload;
  $("siteLabel").textContent = payload.siteLabel;
  $("siteLabel2").textContent = payload.siteLabel;
  showErr("");
  $("reply").value = "";
  $("reply").focus();
});

$("copyAgain").onclick = async () => {
  await window.papple.handoffCopyAgain(current.prompt);
  showErr("");
  $("copyAgain").textContent = "copied ✓";
  setTimeout(() => { $("copyAgain").textContent = "📋 Copy prompt again"; }, 1200);
};

$("reopen").onclick = () => {
  if (current.siteUrl) window.open(current.siteUrl, "_blank");
};

$("cancel").onclick = () => window.papple.handoffCancel();

$("submit").onclick = async () => {
  showErr("");
  $("submit").disabled = true;
  try {
    const r = await window.papple.handoffSubmit($("reply").value);
    if (!r?.ok) showErr(r?.error || "couldn't use that paste — try again");
  } catch (e) {
    showErr(e?.message || "paste failed");
  }
  $("submit").disabled = false;
};
