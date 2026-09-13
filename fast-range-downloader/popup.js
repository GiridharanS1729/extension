const $ = id => document.getElementById(id);

async function loadCurrentUrl() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (tab?.url && /^https?:/i.test(tab.url)) $("url").value = tab.url;
}

loadCurrentUrl();

$("download").addEventListener("click", async () => {
  const url = $("url").value.trim();
  const threads = Number($("threads").value);

  if (!/^https?:/i.test(url)) {
    $("message").textContent = "Enter an HTTP(S) file URL.";
    $("status").hidden = false;
    return;
  }

  $("status").hidden = false;
  $("message").textContent = "Starting...";
  $("download").disabled = true;

  const response = await chrome.runtime.sendMessage({
    type: "START_DOWNLOAD",
    url,
    threads
  });

  if (!response?.ok) {
    $("message").textContent = response?.error || "Failed to start.";
    $("download").disabled = false;
    return;
  }

  const timer = setInterval(async () => {
    const s = await chrome.runtime.sendMessage({type: "GET_STATUS"});
    if (!s) return;

    $("filename").textContent = s.filename || "";
    $("bar").style.width = `${s.percent || 0}%`;
    $("percent").textContent = `${s.percent || 0}%`;
    $("speed").textContent = `${formatBytes(s.speed || 0)}/s`;
    $("eta").textContent = s.eta == null ? "--" : formatTime(s.eta);
    $("message").textContent = s.message || "";

    if (["completed", "failed"].includes(s.state)) {
      clearInterval(timer);
      $("download").disabled = false;
    }
  }, 500);
});

function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B","KB","MB","GB","TB"];
  const i = Math.min(Math.floor(Math.log(n)/Math.log(1024)), units.length - 1);
  return `${(n/1024**i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
function formatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`;
  return `${Math.floor(sec/3600)}h ${Math.floor(sec%3600/60)}m`;
}