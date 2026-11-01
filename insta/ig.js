// Runs Instagram web calls inside an instagram.com tab so cookies + origin are real.

const APP_ID = "936619743392459";

export async function getIgTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.instagram.com/*" });
  if (tabs.length) return tabs[0];
  const tab = await chrome.tabs.create({ url: "https://www.instagram.com/", active: false, pinned: true });
  await new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  return tab;
}

// Executed in page context (world MAIN). Must be self-contained.
async function pageRequest(method, path, body, appId, withJazoest) {
  const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "";
  // Page tokens the web app sends with writes. Read from Meta modules, else page HTML.
  const mod = (name) => { try { return window.require?.(name); } catch (e) { return null; } };
  const html = () => document.documentElement.innerHTML;
  const find = (re) => (html().match(re) || [])[1] || "";
  let rev = "1";
  if (body && withJazoest) {
    const dtsg = mod("DTSGInitialData")?.token
      || find(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/) || find(/"dtsg":\{"token":"([^"]+)"/);
    rev = String(mod("SiteData")?.server_revision || find(/"server_revision":(\d+)/) || find(/"__spin_r":(\d+)/) || "1");
    let sum = 0;
    for (const ch of csrf) sum += ch.charCodeAt(0);
    body += `&jazoest=2${sum}`;
    if (dtsg) body += `&fb_dtsg=${encodeURIComponent(dtsg)}`;
  }
  const userId = (document.cookie.match(/ds_user_id=([^;]+)/) || [])[1] || "";
  if (method === "WHOAMI") return { ok: !!userId, status: userId ? 200 : 401, data: { userId } };
  let claim = "0";
  try { claim = sessionStorage.getItem("www-claim-v2") || "0"; } catch (e) { /* ignore */ }
  const res = await fetch("https://www.instagram.com" + path, {
    method,
    credentials: "include",
    headers: {
      "Accept": "*/*",
      "X-CSRFToken": csrf,
      "X-IG-App-ID": appId,
      "X-IG-WWW-Claim": claim,
      "X-ASBD-ID": "359341",
      "X-Instagram-AJAX": rev,
      "X-Requested-With": "XMLHttpRequest",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body || undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* non-JSON = likely login/challenge page */ }
  return {
    ok: res.ok,
    status: res.status,
    data,
    url: res.redirected ? res.url : "",
    snippet: data ? "" : text.slice(0, 120).replace(/\s+/g, " "),
  };
}

async function run(method, path, body, withJazoest = false) {
  const tab = await getIgTab();
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: pageRequest,
    args: [method, path, body || null, APP_ID, withJazoest],
  });
  return result.result;
}

export async function whoAmI() {
  const r = await run("WHOAMI", "");
  if (!r.ok) throw new Error("Not logged in to instagram.com in this Chrome.");
  return r.data.userId;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Guess for brand / promo pages: Instagram's business flag when sent, else name words.
const PROMO_RE = /shop|store|boutique|official|deals?|offers?|sale|brand|digital|marketing|agency|solutions?|traders?|studio|collections?|wear|fashion|beauty|salon|spa|realestate|real_estate|academy|media|services|consult|events?|foods?|kitchen|bakery|cafe|jewel|properties|promo|\.in$|_in$/i;

function toUser(u) {
  const business = !!(u.is_business || u.account_type === 2 || u.account_type === 3 || u.category);
  return {
    pk: String(u.pk || u.pk_id || u.id),
    username: u.username,
    fullName: u.full_name || "",
    pic: u.profile_pic_url || "",
    verified: !!u.is_verified,
    private: !!u.is_private,
    promo: business || PROMO_RE.test(u.username || "") || PROMO_RE.test(u.full_name || ""),
  };
}

// One page of following, newest followed first. maxId "" = first page.
export async function fetchFollowingPage(maxId, count) {
  const userId = await whoAmI();
  const q = new URLSearchParams({ count: String(count), order: "date_followed_latest" });
  if (maxId) q.set("max_id", maxId);
  const r = await run("GET", `/api/v1/friendships/${userId}/following/?${q}`);
  // No silent fallback: unsorted list would mix old and new follows.
  if (!r.ok || !r.data) throw new Error(`Load newest following failed (HTTP ${r.status}). Try again later.`);
  return { users: (r.data.users || []).map(toUser), nextMaxId: r.data.next_max_id || "" };
}

// Full list, used for followers (the "not following back" check).
export async function fetchList(kind, limit, onProgress) {
  const userId = await whoAmI();
  const users = [];
  let maxId = "";
  do {
    const q = new URLSearchParams({ count: String(Math.min(100, limit - users.length)) });
    if (maxId) q.set("max_id", maxId);
    const r = await run("GET", `/api/v1/friendships/${userId}/${kind}/?${q}`);
    if (!r.ok || !r.data) throw new Error(`Load ${kind} failed (HTTP ${r.status}). Try again later.`);
    users.push(...(r.data.users || []).map(toUser));
    onProgress?.(users.length);
    maxId = users.length < limit ? r.data.next_max_id || "" : "";
    if (maxId) await sleep(1500 + Math.random() * 1500);
  } while (maxId);
  return users.slice(0, limit);
}

// pk -> do they follow me? One call checks many accounts.
export async function followsMeMap(pks) {
  const out = {};
  for (let i = 0; i < pks.length; i += 50) {
    const ids = pks.slice(i, i + 50).join(",");
    const r = await run("POST", "/api/v1/friendships/show_many/", `user_ids=${ids}`, true);
    const st = r?.data?.friendship_statuses;
    if (!st) throw new Error(`Follow-back check failed (HTTP ${r?.status}).`);
    for (const [pk, f] of Object.entries(st)) out[pk] = !!f.followed_by;
  }
  return out;
}

// Username -> pk, for log rows saved without one.
export async function lookupPk(username) {
  const r = await run("GET", `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
  return r?.data?.data?.user?.id || "";
}

// Returns "ok" | "blocked" | "logout" | "badapi" | "error"
export async function unfollow(pk) {
  let r = await run("POST", `/api/v1/friendships/destroy/${pk}/`, `container_module=profile&nav_chain=${encodeURIComponent("PolarisProfilePostsTabRoot:profilePage:1:via_cold_start")}&user_id=${pk}`, true);
  // HTML page instead of JSON: try the older web endpoint.
  if (!r.data && !r.url) r = await run("POST", `/web/friendships/${pk}/unfollow/`, "");
  const msg = r.data?.message || "";
  // "status: ok" alone is not proof; reply can still say following: true.
  const following = r.data?.friendship_status?.following ?? r.data?.following;
  if (r.ok && following === false) return { result: "ok" };
  if (r.url.includes("/challenge") || r.url.includes("/checkpoint")) return { result: "blocked", msg: "checkpoint: open instagram.com and verify" };
  if (r.url.includes("/accounts/login")) return { result: "logout", msg: "redirected to login" };
  if (r.status === 401 || r.status === 403 || msg === "login_required") return { result: "logout", msg };
  if (r.status === 429 || msg.includes("feedback_required") || r.data?.spam) return { result: "blocked", msg };

  // Odd reply: ask Instagram if we still follow them.
  if (r.ok) {
    const s = await run("GET", `/api/v1/friendships/show/${pk}/`);
    if (s.ok && s.data?.following === false) return { result: "ok" };
    if (s.ok && s.data?.following === true) return { result: "badapi", msg: "Instagram said ok but still following" };
  }
  if (!r.data) return { result: "badapi", msg: `HTTP ${r.status}: got web page, not API reply` };
  const detail = msg || JSON.stringify(r.data).slice(0, 120);
  return { result: "error", msg: `HTTP ${r.status}${detail ? ": " + detail : ""}` };
}
