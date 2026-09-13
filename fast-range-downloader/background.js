let current = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fast-download-link",
    title: "Download with Fast Range Downloader",
    contexts: ["link"]
  });
  chrome.contextMenus.create({
    id: "fast-download-page",
    title: "Download current URL with Fast Range Downloader",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.linkUrl || tab?.url;
  if (!url || !/^https?:/i.test(url)) return;
  await startDownload(url, 8);
});

chrome.commands.onCommand.addListener(async command => {
  if (command === "download-current-page") {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab?.url && /^https?:/i.test(tab.url)) await startDownload(tab.url, 8);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_DOWNLOAD") {
    startDownload(msg.url, msg.threads)
      .then(() => sendResponse({ok: true}))
      .catch(e => sendResponse({ok: false, error: e.message}));
    return true;
  }
  if (msg.type === "GET_STATUS") {
    sendResponse(current ? publicStatus() : null);
  }
});

async function startDownload(url, threads) {
  if (current && ["probing", "downloading", "assembling"].includes(current.state)) {
    throw new Error("A download is already running.");
  }

  current = {
    state: "probing", url, filename: "", total: 0, received: 0,
    speed: 0, eta: null, percent: 0, message: "Checking server..."
  };

  try {
    const info = await probe(url);
    current.filename = info.filename;
    current.total = info.size;

    if (!info.rangeSupported) {
      current.state = "fallback";
      current.message = "Server does not support byte ranges. Using normal Chrome download.";
      await chrome.downloads.download({url, filename: info.filename, saveAs: true});
      current.state = "completed";
      current.message = "Normal download started.";
      return;
    }

    current.state = "downloading";
    current.message = `Downloading with ${threads} connections...`;

    const blob = await segmentedFetch(url, info.size, Math.max(1, Math.min(32, threads)), info);
    current.state = "assembling";
    current.message = "Preparing final file...";

    const objectUrl = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url: objectUrl,
      filename: info.filename,
      saveAs: true
    });
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

    current.state = "completed";
    current.received = info.size;
    current.percent = 100;
    current.message = "Download handed to Chrome.";
  } catch (e) {
    current.state = "failed";
    current.message = e?.message || String(e);
    throw e;
  }
}

async function probe(url) {
  let r;
  try {
    r = await fetch(url, {method: "HEAD", credentials: "include", redirect: "follow"});
  } catch {
    r = await fetch(url, {
      headers: {"Range": "bytes=0-0"},
      credentials: "include",
      redirect: "follow"
    });
  }

  const sizeHeader = r.headers.get("content-length");
  const contentRange = r.headers.get("content-range");
  let size = sizeHeader ? Number(sizeHeader) : 0;

  if (contentRange) {
    const m = contentRange.match(/\/(\d+)$/);
    if (m) size = Number(m[1]);
  }

  const cd = r.headers.get("content-disposition") || "";
  const filename = filenameFromHeaders(cd) || filenameFromUrl(url);

  let rangeSupported = /bytes/i.test(r.headers.get("accept-ranges") || "");
  if (!rangeSupported && r.status === 206 && contentRange) rangeSupported = true;

  return {
    url: r.url || url,
    size,
    filename,
    rangeSupported
  };
}

function filenameFromHeaders(cd) {
  const utf = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf) {
    try { return decodeURIComponent(utf[1].trim().replace(/^["']|["']$/g, "")); } catch {}
  }
  const plain = cd.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : "";
}

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname.split("/").pop() || "download");
    return p || "download";
  } catch {
    return "download";
  }
}

async function segmentedFetch(url, size, concurrency, info) {
  if (!Number.isFinite(size) || size <= 0) throw new Error("Could not determine file size.");

  const chunkSize = Math.ceil(size / concurrency);
  const chunks = new Array(concurrency);
  let next = 0;
  let received = 0;
  const startTime = performance.now();

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= concurrency) return;

      const start = i * chunkSize;
      const end = Math.min(size - 1, start + chunkSize - 1);
      const data = await fetchRangeWithRetry(info.url, start, end);

      if (data.byteLength !== end - start + 1) {
        throw new Error(`Chunk ${i + 1} has an unexpected length.`);
      }

      chunks[i] = data;
      received += data.byteLength;
      updateProgress(received, size, startTime);
    }
  }

  await Promise.all(Array.from({length: concurrency}, worker));
  return new Blob(chunks);
}

async function fetchRangeWithRetry(url, start, end, attempts = 4) {
  let last;
  for (let n = 0; n < attempts; n++) {
    try {
      const r = await fetch(url, {
        headers: {Range: `bytes=${start}-${end}`},
        credentials: "include",
        redirect: "follow",
        cache: "no-store"
      });

      if (r.status !== 206) {
        throw new Error(`Range request returned HTTP ${r.status}.`);
      }

      const cr = r.headers.get("content-range") || "";
      const expected = `bytes ${start}-${end}/`;
      if (!cr.startsWith(expected)) {
        throw new Error(`Server returned an incorrect Content-Range for ${start}-${end}.`);
      }

      return await r.arrayBuffer();
    } catch (e) {
      last = e;
      await new Promise(resolve => setTimeout(resolve, 400 * 2 ** n));
    }
  }
  throw last;
}

function updateProgress(received, total, startTime) {
  const seconds = Math.max(0.001, (performance.now() - startTime) / 1000);
  const speed = received / seconds;
  current.received = received;
  current.percent = Math.min(100, received / total * 100);
  current.speed = speed;
  current.eta = speed ? (total - received) / speed : null;
}

function publicStatus() {
  return {...current};
}
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({url: chrome.runtime.getURL("newtab.html")});
});
