// Overlay UI injected into instagram.com. Profile pics load as Instagram's own,
// so the CDN allows them. Queue + API calls still live in background.js.

(() => {
  // Old overlay from before an extension reload is dead: replace it.
  document.getElementById("slow-unfollow-root")?.remove();

  const PAGE_SIZE = 20;
  const MAX_PAGES = 100;
  const DAILY_CAP =2000;

  const DEAD = "Extension was reloaded. Refresh this page (your picks are kept).";
  const alive = () => !!chrome.runtime?.id;
  async function send(msg) {
    try {
      if (alive()) return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (alive()) throw e;
    }
    const st = root.getElementById("status");
    st.textContent = DEAD;
    st.classList.add("warn");
    return { error: DEAD };
  }

  // ---------- DOM ----------
  const host = document.createElement("div");
  host.id = "slow-unfollow-root";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <link rel="stylesheet" href="${chrome.runtime.getURL("overlay.css")}">
    <button id="launcher" title="Slow Unfollow">
      <img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="Slow Unfollow">
    </button>
    <div id="backdrop" hidden>
      <div id="panel" tabindex="-1">
        <header>
          <div class="brand">
            <img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="" width="32" height="32">
            <h1>Slow Unfollow</h1>
            <button id="close" class="icon" title="Close (Esc)">✕</button>
          </div>
          <div id="status" class="status">Loading…</div>
          <div class="row">
            <button id="start" class="primary">Start</button>
            <button id="pause" title="Hold; queue kept">Pause</button>
            <button id="stop" title="Stop now and empty the queue">Stop</button>
            <button id="retryFailed">Retry failed</button>
            <button id="clearQueue">Clear queue</button>
            <button id="resetCap" title="Allow another 1000 today">Reset cap</button>
            <button id="clearBlock" title="Use only if you are sure the block is gone">Clear block</button>
          </div>
        </header>

        <section class="toolbar">
          <button id="reload" title="Fetch page 1 again from Instagram">Reload newest</button>
          <button id="loadFollowers" title="Needed for the 'not following back' filter">Load followers</button>
          <input id="search" type="search" placeholder="Search username or name">
          <label title="First tick loads your followers list"><input id="notBack" type="checkbox"> Only who don't follow me back</label>
          <label><input id="hideQueued" type="checkbox"> Hide queued</label>
          <label><input id="verifiedOnly" type="checkbox"> Verified only</label>
          <label title="Business pages or names like shop, store, official, deals (a guess)"><input id="promoOnly" type="checkbox"> Promo / brand only</label>
          <button id="loadMore" title="Fetch next 20 newest from Instagram">Load 20 more</button>
          <button id="loadAllPages" title="Fetch every following, 20 per call">Load all</button>
        </section>

        <section class="toolbar">
          <label><input id="selectAll" type="checkbox"> Select all shown</label>
          <button id="selectLoaded" title="Pick every loaded account on all pages">Select all loaded</button>
          <button id="selectNone">Clear picks</button>
          <span class="hint"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> select · <kbd>PgUp</kbd><kbd>PgDn</kbd> page · <kbd>/</kbd> search · <kbd>Esc</kbd> close</span>
          <span id="counts"></span>
          <button id="confirm" class="primary" disabled>Unfollow selected (0)</button>
        </section>

        <div class="body">
          <main>
            <div id="grid" class="grid"></div>
            <p id="empty" class="empty" hidden>No accounts on this page.</p>
            <nav class="pager">
              <button id="prev">← Prev</button>
              <span id="pageLabel"></span>
              <button id="next">Next →</button>
            </nav>
          </main>
          <aside>
            <div class="logHead"><h2>Log</h2><button id="clearLog">Clear log</button></div>
            <ol id="log"></ol>
          </aside>
        </div>
      </div>
    </div>`;
  document.documentElement.append(host);

  const $ = (id) => root.getElementById(id);

  // ---------- state ----------
  let following = [];       // newest followed first
  let followerSet = null;
  let queuedSet = new Set();
  // Picked cards wait here until Confirm. Queued cards are locked.
  // Saved in the page so picks survive refresh and extension reload.
  const SEL_KEY = "slowUnfollowSelected";
  const selected = new Set((() => {
    try { return JSON.parse(sessionStorage.getItem(SEL_KEY) || "[]"); } catch (e) { return []; }
  })());
  const saveSel = () => {
    try { sessionStorage.setItem(SEL_KEY, JSON.stringify([...selected])); } catch (e) { /* ignore */ }
  };

  let rows = [];
  let cards = [];
  let focusIdx = 0;

  let page = 0;
  let followingDone = false;
  let busy = false;
  let isOpen = false;
  let statusTimer = null;

  // ---------- open / close ----------
  async function open() {
    if (isOpen) return;
    isOpen = true;
    $("backdrop").hidden = false;
    $("launcher").hidden = true;
    document.documentElement.style.overflow = "hidden";
    $("panel").focus();
    await loadCache();
    refreshStatus();
    statusTimer = setInterval(refreshStatus, 30000);
    if (!following.length) goPage(0, true);
  }

  function close() {
    isOpen = false;
    $("backdrop").hidden = true;
    $("launcher").hidden = false;
    document.documentElement.style.overflow = "";
    clearInterval(statusTimer);
  }

  const toggle = () => (isOpen ? close() : open());

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "toggleOverlay") toggle();
  });

  // ---------- data ----------
  async function loadCache() {
    const s = await chrome.storage.local.get(["following", "followers", "queue", "followingDone"]);
    following = s.following || [];
    followingDone = !!s.followingDone;
    followerSet = s.followers ? new Set(s.followers.map((u) => u.pk)) : null;
    queuedSet = new Set((s.queue || []).map((q) => q.pk));
    if (isOpen) render();
  }

  // Any filter on: search all loaded accounts (newest first), not just this page.
  function filtering() {
    return !!$("search").value.trim() || $("notBack").checked || $("verifiedOnly").checked || $("promoOnly").checked;
  }

  // true / false, or undefined when not checked yet.
  function followsMe(u) {
    if (u.followsMe !== undefined) return u.followsMe;
    return followerSet ? followerSet.has(u.pk) : undefined;
  }

  function visible() {
    const q = $("search").value.trim().toLowerCase();
    const list = filtering() ? following : following.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    return list.filter((u) => {
      if ($("hideQueued").checked && queuedSet.has(u.pk)) return false;
      if ($("verifiedOnly").checked && !u.verified) return false;
      if ($("promoOnly").checked && !u.promo) return false;
      if ($("notBack").checked && followsMe(u) !== false) return false;
      if (q && !u.username.toLowerCase().includes(q) && !u.fullName.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // ---------- cards ----------
  function avatar(u) {
    const fallback = () => {
      const d = document.createElement("div");
      d.className = "avatar";
      d.textContent = (u.username[0] || "?").toUpperCase();
      return d;
    };
    if (!u.pic) return fallback();
    const img = document.createElement("img");
    img.className = "avatar";
    img.loading = "lazy";
    img.alt = "";
    img.src = u.pic;
    img.onerror = () => img.replaceWith(fallback());
    return img;
  }

  function tag(text, cls = "") {
    const t = document.createElement("span");
    t.className = "tag " + cls;
    t.textContent = text;
    return t;
  }

  function makeCard(u, i) {
    const card = document.createElement("div");
    card.className = "card";
    const queued = queuedSet.has(u.pk);
    if (u.unfollowed) card.classList.add("done");
    else if (queued) card.classList.add("queued");
    else if (selected.has(u.pk)) card.classList.add("checked");

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = `#${following.indexOf(u) + 1}`;
    num.title = "1 = newest followed";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.tabIndex = -1;
    cb.checked = queued || !!u.unfollowed || selected.has(u.pk);
    cb.disabled = queued || !!u.unfollowed;

    const name = document.createElement("a");
    name.className = "user";
    name.href = `/${u.username}/`;
    name.target = "_blank";
    name.textContent = u.username;
    name.onclick = (e) => e.stopPropagation();

    const full = document.createElement("span");
    full.className = "full";
    full.textContent = u.fullName;

    const tags = document.createElement("div");
    tags.className = "tags";
    if (queued) tags.append(tag("queued"));
    if (u.unfollowed) tags.append(tag("unfollowed"));
    if (u.verified) tags.append(tag("verified"));
    if (u.promo) tags.append(tag("promo"));
    if (u.private) tags.append(tag("private"));
    if (followsMe(u) === false) tags.append(tag("not following back", "warn"));

    card.append(num, cb, avatar(u), name, full, tags);
    card.onclick = (e) => {
      setFocus(i, false);
      $("panel").focus({ preventScroll: true });
      if (e.target !== cb) toggleCard(i);
      else toggleCard(i, cb.checked);
    };
    return card;
  }

  function render() {
    const focusedPk = rows[focusIdx]?.pk;
    rows = visible();
    cards = rows.map(makeCard);
    $("grid").replaceChildren(...cards);
    $("empty").hidden = rows.length > 0;
    const keep = rows.findIndex((u) => u.pk === focusedPk);
    setFocus(keep >= 0 ? keep : 0, false);
    updateCounts();
    updatePager();
  }

  function toggleCard(i, force) {
    const u = rows[i];
    if (!u || u.unfollowed || queuedSet.has(u.pk)) return;
    const on = force ?? !selected.has(u.pk);
    on ? selected.add(u.pk) : selected.delete(u.pk);
    saveSel();
    cards[i].classList.toggle("checked", on);
    cards[i].querySelector("input").checked = on;
    updateCounts();
  }

  function setFocus(i, scroll = true) {
    cards[focusIdx]?.classList.remove("focus");
    focusIdx = Math.max(0, Math.min(i, cards.length - 1));
    const c = cards[focusIdx];
    if (!c) return;
    c.classList.add("focus");
    if (scroll) c.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function columns() {
    if (cards.length < 2) return 1;
    const top = cards[0].offsetTop;
    const n = cards.findIndex((c) => c.offsetTop !== top);
    return n === -1 ? cards.length : n;
  }

  function updateCounts() {
    $("counts").textContent = `${following.length} loaded · ${rows.length} shown · ${queuedSet.size} queued`;
    $("confirm").textContent = `Unfollow selected (${selected.size})`;
    $("confirm").disabled = selected.size === 0;
    $("selectAll").checked = rows.length > 0 && rows.every((u) => u.unfollowed || queuedSet.has(u.pk) || selected.has(u.pk));
  }

  // ---------- paging ----------
  function hasNext() {
    if (page + 1 >= MAX_PAGES) return false;
    return !followingDone || (page + 1) * PAGE_SIZE < following.length;
  }

  function updatePager() {
    const f = filtering();
    $("pageLabel").textContent = busy ? "Loading…"
      : f ? `Filter: ${rows.length} of ${following.length} loaded`
      : `Page ${page + 1}${followingDone ? ` of ${Math.max(1, Math.ceil(following.length / PAGE_SIZE))}` : ""}`;
    $("prev").disabled = busy || f || page === 0;
    $("next").disabled = busy || f || !hasNext();
    $("reload").disabled = busy;
    $("loadMore").disabled = busy || followingDone || following.length >= MAX_PAGES * PAGE_SIZE;
  }

  // Cached pages show at once; new pages are fetched from Instagram (20 per call).
  async function goPage(n, reset = false) {
    if (busy || n < 0 || (n > page && !hasNext() && !reset)) return;
    busy = true;
    updatePager();
    try {
      const r = await send({ type: "page", page: n, reset });
      if (r.error) {
        $("empty").textContent = r.error;
      } else {
        $("empty").textContent = "No accounts on this page.";
        page = r.page;
        focusIdx = 0;
      }
    } finally {
      busy = false;
    }
    await loadCache();
    $("grid").parentElement.scrollTop = 0;
  }

  // ---------- status ----------
  function fmt(ts) {
    return new Date(ts).toLocaleString();
  }

  async function refreshStatus() {
    if (!isOpen) return;
    const s = await send({ type: "state" });
    const lines = [
      `Queue: ${s.queue.length}   Today: ${s.dayCount}/${DAILY_CAP}   ${s.running ? "Running" : "Stopped"}`,
    ];
    if (s.running && s.nextAt) lines.push(`Next unfollow: ${fmt(s.nextAt)}`);
    if (s.queue.length) {
      const days = Math.ceil((s.queue.length + s.dayCount) / DAILY_CAP);
      lines.push(`About ${days} day(s) left. Keep Chrome + this tab open.`);
    }
    if (s.pauseReason) lines.push(s.pauseReason);
    const el = $("status");
    el.textContent = lines.join("\n");
    el.classList.toggle("warn", !!s.pauseReason && s.pauseReason !== "Daily cap reached");
    $("start").disabled = false; // empty queue: Start retries failed ones
    $("pause").disabled = !s.running;
    $("stop").disabled = !s.running && !s.queue.length;
    $("clearBlock").hidden = !(s.pauseUntil > Date.now());
    $("resetCap").hidden = s.dayCount < DAILY_CAP;

    $("log").replaceChildren(
      ...s.log.slice(0, 100).map((l) => {
        const li = document.createElement("li");
        li.textContent = `${new Date(l.t).toLocaleTimeString()} ${l.username} — ${l.result}${l.msg ? " (" + l.msg + ")" : ""}`;
        if (l.result !== "ok") li.className = "bad";
        return li;
      })
    );
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (!isOpen) return;
    if ((changes.following || changes.followers || changes.queue) ) loadCache();
    refreshStatus();
  });

  // ---------- keyboard ----------
  // Listener on the panel so keys never reach Instagram's own shortcuts.
  $("panel").addEventListener("keydown", (e) => {
    e.stopPropagation();
    const target = e.composedPath()[0];
    const inSearch = target === $("search");

    if (e.key === "Escape" && !inSearch) {
      e.preventDefault();
      return close();
    }
    if (inSearch) {
      if (e.key === "ArrowDown" || e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        $("panel").focus();
        setFocus(focusIdx);
      }
      return;
    }
    if (target.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
    if (!cards.length && !["/", "PageDown", "PageUp"].includes(e.key)) return;

    const cols = columns();
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
    if (e.key === "PageDown" || (e.key === "ArrowRight" && focusIdx === cards.length - 1)) {
      e.preventDefault();
      goPage(page + 1);
    } else if (e.key === "PageUp" || (e.key === "ArrowLeft" && focusIdx === 0)) {
      e.preventDefault();
      goPage(page - 1);
    } else if (e.key in moves) {
      e.preventDefault();
      setFocus(focusIdx + moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCard(focusIdx);
    } else if (e.key === "/") {
      e.preventDefault();
      $("search").focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocus(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocus(cards.length - 1);
    }
  });
  ["keyup", "keypress"].forEach((t) => $("panel").addEventListener(t, (e) => e.stopPropagation()));

  // ---------- buttons ----------
  async function loadFollowers(btn) {
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Loading…";
    try {
      const r = await send({ type: "load", kind: "followers" });
      if (r.error) alert(r.error);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
    await loadCache();
  }

  $("launcher").onclick = open;
  $("close").onclick = close;
  $("backdrop").onclick = (e) => { if (e.target === $("backdrop")) close(); };
  $("reload").onclick = () => goPage(0, true);
  $("prev").onclick = () => goPage(page - 1);
  $("next").onclick = () => goPage(page + 1);
  $("loadFollowers").onclick = (e) => loadFollowers(e.currentTarget);
  $("search").oninput = render;
  $("notBack").onchange = async () => {
    // Needs followers list; fetch it on first use.
    if ($("notBack").checked && following.some((u) => followsMe(u) === undefined)) {
      $("empty").textContent = "Checking who follows you back…";
      $("grid").replaceChildren();
      $("empty").hidden = false;
      const r = await send({ type: "followsMe" });
      // Fallback: full followers list (slow).
      if (r.error) await loadFollowers($("loadFollowers"));
      $("empty").textContent = "No accounts on this page.";
      await loadCache();
    }
    render();
  };
  $("hideQueued").onchange = render;
  $("verifiedOnly").onchange = render;
  $("promoOnly").onchange = render;
  $("loadMore").onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      const r = await send({ type: "page", page: Math.ceil(following.length / PAGE_SIZE) });
      if (r.error) alert(r.error);
    } finally {
      btn.textContent = "Load 20 more";
    }
    await loadCache();
  };
  $("confirm").onclick = async () => {
    const items = following.filter((u) => selected.has(u.pk)).map(({ pk, username }) => ({ pk, username }));
    if (!items.length || !confirm(`Unfollow ${items.length} accounts now?`)) return;
    const r = await send({ type: "enqueue", items });
    if (r?.error) return alert(r.error);
    selected.clear();
    saveSel();
    render();
    await send({ type: "start" });
  };
  $("resetCap").onclick = async () => {
    if (confirm(`You already unfollowed ${DAILY_CAP} today. More raises block risk. Continue?`)) await send({ type: "resetCap" });
  };
  $("loadAllPages").onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      // One page per message so the count updates as it goes.
      while (!followingDone && following.length < MAX_PAGES * PAGE_SIZE) {
        btn.textContent = `Loading… ${following.length}`;
        const r = await send({ type: "page", page: Math.ceil(following.length / PAGE_SIZE) });
        if (r.error) { alert(r.error); break; }
        const before = following.length;
        await loadCache();
        if (following.length === before) break;
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Load all";
    }
  };
  $("stop").onclick = () => send({ type: "stop" });
  $("clearLog").onclick = () => send({ type: "clearLog" });
  $("selectLoaded").onclick = () => {
    for (const u of following) if (!u.unfollowed && !queuedSet.has(u.pk)) selected.add(u.pk);
    saveSel();
    render();
  };
  $("selectNone").onclick = () => {
    selected.clear();
    saveSel();
    render();
  };
  $("selectAll").onchange = (e) => {
    // Read once: toggleCard -> updateCounts rewrites this checkbox mid-loop.
    const on = e.target.checked;
    rows.forEach((_, i) => toggleCard(i, on));
    updateCounts();
  };
  $("start").onclick = () => send({ type: "start" });
  $("pause").onclick = () => send({ type: "pause" });
  $("retryFailed").onclick = async () => {
    const r = await send({ type: "retryFailed" });
    if (!r.added) alert("No failed accounts to retry.");
  };
  $("clearQueue").onclick = async () => {
    if (confirm("Remove everything from the queue?")) await send({ type: "clearQueue" });
  };
  $("clearBlock").onclick = async () => {
    if (confirm("Instagram blocked you recently. Clearing early can make it worse. Continue?")) {
      await send({ type: "clearBlock" });
      await send({ type: "start" });
    }
  };
})();
