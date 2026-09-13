const $ = id => document.getElementById(id);

async function useCurrentTab() {
  const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  if (tab?.url && /^https?:/i.test(tab.url)) {
    $("url").value = tab.url;
  }
}

useCurrentTab();

$("use-tab").addEventListener("click", useCurrentTab);

$("download").addEventListener("click", async () => {
  const url = $("url").value.trim();
  const threads = Number($("threads").value);

  $("status").hidden = false;

  if (!/^https?:/i.test(url)) {
    $("message").textContent = "Enter a direct HTTP(S) file URL.";
    return;
  }

  $("download").disabled = true;
  $("message").textContent = "Starting...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "START_DOWNLOAD",
      url,
      threads
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Failed to start.");
    }
  } catch (e) {
    $("message").textContent = e.message;
    $("download").disabled = false;
    return;
  }

  const timer = setInterval(async () => {
    try {
      const s = await chrome.runtime.sendMessage({type: "GET_STATUS"});
      if (!s) return;

      $("filename").textContent = s.filename || "Preparing...";
      $("bar").style.width = `${s.percent || 0}%`;
      $("percent").textContent = `${Math.round(s.percent || 0)}%`;
      $("speed").textContent = `${formatBytes(s.speed || 0)}/s`;
      $("eta").textContent = s.eta == null ? "ETA --" : `ETA ${formatTime(s.eta)}`;
      $("message").textContent = s.message || "";

      if (["completed", "failed"].includes(s.state)) {
        clearInterval(timer);
        $("download").disabled = false;
      }
    } catch {
      // The background service worker can restart; keep polling.
    }
  }, 500);
});

function formatBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor(sec % 3600 / 60)}m`;
}