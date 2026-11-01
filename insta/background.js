import { fetchFollowingPage, fetchList, followsMeMap, getIgTab, lookupPk, unfollow } from "./ig.js";

const DAILY_CAP = 2000;
const PAGE_SIZE = 20;
const MAX_PAGES = 100; // 100 x 20 = newest 2000 followings
const FOLLOWERS_LIMIT = 10000;
// Burst mode: high block risk. Safer: 2 * 60 * 1000 and 4 * 60 * 1000.
const MIN_GAP_MS = 2 * 1000;
const MAX_GAP_MS = 5 * 1000;
const ALARM_MIN_MS = 30 * 1000; // Chrome alarms can't fire sooner
const BLOCK_PAUSE_MS = 24 * 60 * 60 * 1000;
const ALARM = "unfollow-tick";

const today = () => new Date().toISOString().slice(0, 10);

const defaults = {
  queue: [],          // [{pk, username}]
  log: [],            // [{t, username, result, msg}]
  running: false,
  pauseUntil: 0,
  pauseReason: "",
  day: today(),
  dayCount: 0,
  nextAt: 0,
};

async function getState() {
  const s = { ...defaults, ...(await chrome.storage.local.get(Object.keys(defaults))) };
  if (s.day !== today()) {
    s.day = today();
    s.dayCount = 0;
    await chrome.storage.local.set({ day: s.day, dayCount: 0 });
  }
  return s;
}

const setState = (patch) => chrome.storage.local.set(patch);

function midnight() {
  const d = new Date();
  d.setHours(24, 0, 30, 0);
  return d.getTime();
}

async function schedule(when) {
  await chrome.alarms.clear(ALARM);
  // Short gaps use a timer; alarm stays as backup if the worker sleeps.
  await chrome.alarms.create(ALARM, { when: Math.max(when, Date.now() + ALARM_MIN_MS) });
  await setState({ nextAt: when });
  const wait = when - Date.now();
  if (wait < ALARM_MIN_MS) setTimeout(tick, Math.max(0, wait));
}

function randomGap() {
  return MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
}

async function addLog(s, entry) {
  const log = [{ t: Date.now(), ...entry }, ...s.log].slice(0, 300);
  await setState({ log });
}

let ticking = false;

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await step();
  } finally {
    ticking = false;
  }
}

async function step() {
  const s = await getState();
  if (!s.running) return;
  if (!s.queue.length) {
    await setState({ running: false, nextAt: 0 });
    return;
  }
  if (Date.now() < s.pauseUntil) return schedule(s.pauseUntil);
  if (s.dayCount >= DAILY_CAP) {
    await setState({ pauseReason: "Daily cap reached" });
    return schedule(midnight());
  }

  const [item, ...rest] = s.queue;
  let res;
  try {
    res = await unfollow(item.pk);
  } catch (e) {
    res = { result: "error", msg: String(e.message || e) };
  }

  if (res.result === "ok") {
    await setState({ queue: rest, dayCount: s.dayCount + 1, pauseReason: "" });
    await markUnfollowed(item.pk);
    await addLog(s, { pk: item.pk, username: item.username, result: "ok" });
    return schedule(Date.now() + randomGap());
  }

  await addLog(s, { pk: item.pk, username: item.username, result: res.result, msg: res.msg });

  if (res.result === "blocked") {
    const until = Date.now() + BLOCK_PAUSE_MS;
    await setState({ pauseUntil: until, pauseReason: "Instagram blocked action. Waiting 24h." });
    return schedule(until);
  }
  if (res.result === "badapi") {
    // Keep account in queue; skipping would burn the whole list.
    await setState({ running: false, nextAt: 0, pauseReason: "Unfollow API not answering. Queue kept. Stopped." });
    return;
  }
    if (res.result === "logout") {
    await setState({ running: false, nextAt: 0, pauseReason: "Logged out. Log in to instagram.com, then Start." });
    return;
  }
  // Other error: skip this account, keep going.
  await setState({ queue: rest });
  return schedule(Date.now() + randomGap());
}

// Fill u.followsMe for cached accounts that don't have it yet.
async function addFollowsMe(list) {
  const need = list.filter((u) => u.followsMe === undefined).map((u) => u.pk);
  if (!need.length) return list;
  const m = await followsMeMap(need);
  return list.map((u) => (u.pk in m ? { ...u, followsMe: m[u.pk] } : u));
}

// Keep the card in place (marked), so pages don't shift while picking.
async function markUnfollowed(pk) {
  const { following = [] } = await chrome.storage.local.get("following");
  await setState({ following: following.map((u) => (u.pk === pk ? { ...u, unfollowed: true } : u)) });
}

// Worker start (also after extension reload): alarms may be gone, so resume.
(async () => {
  const s = await getState();
  if (s.running && s.queue.length && !(await chrome.alarms.get(ALARM))) {
    await schedule(Math.max(Date.now() + 1000, s.pauseUntil));
  }
})();

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) tick();
});

// Icon click: open the overlay inside an instagram.com tab.
chrome.action.onClicked.addListener(async (tab) => {
  const target = tab.url?.startsWith("https://www.instagram.com/") ? tab : await getIgTab();
  await chrome.tabs.update(target.id, { active: true });
  try {
    await chrome.tabs.sendMessage(target.id, { type: "toggleOverlay" });
  } catch {
    // Tab opened before the extension loaded: inject, then toggle.
    await chrome.scripting.executeScript({ target: { tabId: target.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(target.id, { type: "toggleOverlay" });
  }
});

// Failed in log and never ok later go back in queue. Old log rows have no pk.
async function retryFailed() {
  const s = await getState();
  const { following = [] } = await chrome.storage.local.get("following");
  const okNames = new Set(s.log.filter((l) => l.result === "ok").map((l) => l.username));
  const byName = new Map(following.map((u) => [u.username, u.pk]));
  const inQueue = new Set(s.queue.map((q) => q.pk));
  const items = new Map();
  for (const l of s.log) {
    if (l.result === "ok" || okNames.has(l.username)) continue;
    let pk = l.pk || byName.get(l.username);
    if (!pk) {
      pk = await lookupPk(l.username).catch(() => "");
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    }
    okNames.add(l.username); // look up each name once
    if (pk && !inQueue.has(pk)) items.set(pk, { pk, username: l.username });
  }
  await setState({ queue: [...s.queue, ...items.values()] });
  if (items.size) {
    await setState({ running: true, pauseReason: "" });
    await schedule(Math.max(Date.now() + 1000, s.pauseUntil));
  }
  return { added: items.size };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  handle(msg).then(reply, (e) => reply({ error: String(e.message || e) }));
  return true;
});

async function handle(msg) {
  switch (msg.type) {
    case "load": {
      const users = await fetchList(msg.kind, FOLLOWERS_LIMIT, (n) =>
        chrome.runtime.sendMessage({ type: "progress", kind: msg.kind, n }).catch(() => {})
      );
      await setState({ [msg.kind]: users, [`${msg.kind}At`]: Date.now() });
      return { count: users.length };
    }
    case "page": {
      // Fetch following pages from API only until page msg.page (0-based) is cached.
      let { following = [], followingCursor = "", followingDone = false } =
        await chrome.storage.local.get(["following", "followingCursor", "followingDone"]);
      if (msg.reset) {
        following = [];
        followingCursor = "";
        followingDone = false;
      }
      const page = Math.min(msg.page, MAX_PAGES - 1);
      while (!followingDone && following.length < (page + 1) * PAGE_SIZE) {
        const r = await fetchFollowingPage(followingCursor, PAGE_SIZE);
        const have = new Set(following.map((u) => u.pk));
        following = [...following, ...r.users.filter((u) => !have.has(u.pk))];
        followingCursor = r.nextMaxId;
        followingDone = !r.nextMaxId || following.length >= MAX_PAGES * PAGE_SIZE;
      }
      following = await addFollowsMe(following).catch(() => following);
      await setState({ following, followingCursor, followingDone });
      return { page, pageSize: PAGE_SIZE, maxPages: MAX_PAGES };
    }
    case "enqueue": {
      const s = await getState();
      const have = new Set(s.queue.map((q) => q.pk));
      const queue = [...s.queue, ...msg.items.filter((i) => !have.has(i.pk))];
      await setState({ queue });
      return { queued: queue.length };
    }
    case "dequeue": {
      const s = await getState();
      const drop = new Set(msg.pks);
      await setState({ queue: s.queue.filter((q) => !drop.has(q.pk)) });
      return {};
    }
    case "followsMe": {
      const { following = [] } = await chrome.storage.local.get("following");
      await setState({ following: await addFollowsMe(following) });
      return {};
    }
    case "retryFailed":
      return retryFailed();
    case "start": {
      const s0 = await getState();
      if (!s0.queue.length) await retryFailed();
      await setState({ running: true, pauseReason: "" });
      const s = await getState();
      if (!s.queue.length) {
        await setState({ running: false });
        return {};
      }
      await schedule(Math.max(Date.now() + 1000, s.pauseUntil));
      return {};
    }
    case "stop": {
      await chrome.alarms.clear(ALARM);
      await setState({ running: false, nextAt: 0, queue: [], pauseReason: "" });
      return {};
    }
    case "resetCap": {
      // User chose to go past the daily cap today.
      await setState({ dayCount: 0, pauseReason: "" });
      const s = await getState();
      if (s.running && s.queue.length) await schedule(Math.max(Date.now() + 1000, s.pauseUntil));
      return {};
    }
    case "clearLog": {
      await setState({ log: [] });
      return {};
    }
    case "pause": {
      await chrome.alarms.clear(ALARM);
      await setState({ running: false, nextAt: 0 });
      return {};
    }
    case "clearQueue": {
      await setState({ queue: [] });
      return {};
    }
    case "clearBlock": {
      await setState({ pauseUntil: 0, pauseReason: "" });
      return {};
    }
    case "state":
      return getState();
  }
}
