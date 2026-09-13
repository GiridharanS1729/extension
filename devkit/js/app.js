import { icon } from "./icons.js";
import { renderTool, tools } from "./tools.js";
import { bridge, copy, debounce, dialog, download, escapeHtml, store, uuid } from "./utils.js";

const content = document.querySelector("#content");
const nav = document.querySelector("#nav");
const shell = document.querySelector("#shell");
const paletteBackdrop = document.querySelector("#paletteBackdrop");
const paletteInput = document.querySelector("#paletteInput");
const paletteResults = document.querySelector("#paletteResults");
const fileInput = document.querySelector("#fileInput");

const state = {
  page: "dashboard",
  context: {},
  cookies: [],
  network: [],
  filter: "",
  selectedCommand: 0,
  theme: "dark",
  accent: "#8b5cf6",
  accentRgb: "139, 92, 246",
  storageScope: "local",
  jsonMode: "pretty-print",
  base64Mode: "encode",
  codeType: "fetch",
  networkType: "all"
};

const persistKeys = ["headerPresets", "storagePresets", "variables", "snippets", "notes", "theme", "accent", "accentRgb", "collapsed", "page"];

const initialize = async () => {
  const values = await Promise.all(persistKeys.map(key => store.get(`devkit-${key}`, undefined)));
  persistKeys.forEach((key, index) => { if (values[index] !== undefined) state[key] = values[index]; });
  state.variables ||= [];
  state.headerPresets ||= [];
  state.storagePresets ||= [];
  state.snippets ||= [];
  state.notes ||= [];
  state.uuids = Array.from({ length: 5 }, uuid);
  applyTheme();
  shell.classList.toggle("collapsed", Boolean(state.collapsed));
  renderNav();
  navigate(state.page || "dashboard", false);
  parent.postMessage({ type: "DEVKIT_CONTEXT_REQUEST" }, "*");
};

const persist = (key, value = state[key]) => store.set(`devkit-${key}`, value);

const applyTheme = () => {
  const resolved = state.theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : state.theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.setProperty("--accent", state.accent);
  document.documentElement.style.setProperty("--accent-rgb", state.accentRgb);
  document.querySelector("#themeIcon").innerHTML = icon(resolved === "dark" ? "moon" : "sun");
};

const renderNav = () => {
  const groups = [...new Set(tools.filter(tool => !["settings"].includes(tool.id)).map(tool => tool.group))];
  nav.innerHTML = groups.map(group => `<div class="nav-section-label">${group}</div>${tools.filter(tool => tool.group === group && tool.id !== "settings").map(tool => `<button class="nav-item ${tool.id === state.page ? "active" : ""}" data-page="${tool.id}" data-tooltip="${tool.name}"><span class="nav-icon">${icon(tool.icon)}</span><span class="nav-label">${tool.name}</span></button>`).join("")}`).join("");
  document.querySelectorAll(".sidebar-footer [data-page]").forEach(element => element.classList.toggle("active", state.page === element.dataset.page));
};

const render = () => {
  content.innerHTML = renderTool(state.page, state);
  const current = tools.find(tool => tool.id === state.page) || tools[0];
  document.querySelector("#pageTitle").textContent = current.name;
  document.querySelector("#crumbIcon").innerHTML = icon(current.icon);
  renderNav();
  afterRender();
};

const navigate = (page, save = true) => {
  if (!tools.some(tool => tool.id === page)) return;
  state.page = page;
  state.filter = "";
  if (save) persist("page");
  render();
  content.scrollTop = 0;
  if (page === "cookies") loadCookies();
};

const toast = (message, error = false) => {
  const element = document.createElement("div");
  element.className = `toast ${error ? "error" : ""}`;
  element.textContent = message;
  document.querySelector("#toasts").appendChild(element);
  setTimeout(() => {
    element.style.opacity = "0";
    element.style.transform = "translateY(6px)";
    setTimeout(() => element.remove(), 180);
  }, 2500);
};

const loadCookies = async () => {
  const cookies = await bridge("DEVKIT_COOKIES", { url: state.context.url });
  state.cookies = Array.isArray(cookies) ? cookies : [];
  state.cookieCount = state.cookies.length;
  if (["cookies", "dashboard"].includes(state.page)) render();
};

window.addEventListener("message", event => {
  if (event.data?.type === "DEVKIT_CONTEXT") {
    state.context = event.data.payload;
    if (["dashboard", "storage", "url"].includes(state.page)) render();
    loadCookies();
  }
  if (event.data?.type === "DEVKIT_NETWORK") {
    state.network.unshift(event.data.payload);
    state.network = state.network.slice(0, 500);
    if (state.page === "network") render();
  }
});

window.addEventListener("devkit:toast", event => toast(event.detail));

const paletteCommands = query => {
  const normalized = query.trim().toLowerCase();
  const actions = [
    { id: "theme", name: "Toggle appearance", icon: "sun", action: toggleTheme, hint: "Action" },
    { id: "copy-url", name: "Copy current URL", icon: "copy", action: () => copy(state.context.url || ""), hint: "Action" },
    { id: "refresh", name: "Refresh page context", icon: "refresh", action: () => parent.postMessage({ type: "DEVKIT_CONTEXT_REQUEST" }, "*"), hint: "Action" }
  ];
  const workspaceItems = [
    ...(state.notes || []).map(item => ({ id: `note-${item.id}`, name: item.title, icon: "notes", hint: "Note", action: () => { state.activeNote = item.id; navigate("notes"); } })),
    ...(state.snippets || []).map(item => ({ id: `snippet-${item.id}`, name: item.title, icon: "snippets", hint: `Snippet · ${item.language}`, action: () => { navigate("snippets"); state.filter = item.title; render(); } })),
    ...(state.variables || []).map(item => ({ id: `env-${item.key}`, name: item.key, icon: "environment", hint: "Environment variable", action: () => copy(item.value) }))
  ];
  return [...tools.map(tool => ({ ...tool, action: () => navigate(tool.id), hint: tool.group })), ...workspaceItems, ...actions].filter(command => !normalized || `${command.name} ${command.hint}`.toLowerCase().includes(normalized));
};

const renderPalette = () => {
  const commands = paletteCommands(paletteInput.value);
  state.selectedCommand = Math.min(state.selectedCommand, Math.max(0, commands.length - 1));
  paletteResults.innerHTML = commands.length ? `<div class="palette-group">Commands</div>${commands.map((command, index) => `<button class="command ${index === state.selectedCommand ? "selected" : ""}" data-command="${command.id}"><span class="nav-icon">${icon(command.icon)}</span><span>${escapeHtml(command.name)}</span><small>${escapeHtml(command.hint)}</small></button>`).join("")}` : `<div class="empty" style="min-height:150px"><div><b>No results</b><p>Try another tool or action.</p></div></div>`;
  paletteResults.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
};

const openPalette = () => {
  paletteBackdrop.hidden = false;
  paletteInput.value = "";
  state.selectedCommand = 0;
  renderPalette();
  requestAnimationFrame(() => paletteInput.focus());
};

const closePalette = () => { paletteBackdrop.hidden = true; };
const executeCommand = id => {
  const command = paletteCommands(paletteInput.value).find(item => item.id === id);
  closePalette();
  command?.action();
};

const toggleTheme = () => {
  state.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme();
  persist("theme");
  if (state.page === "settings") render();
};

document.querySelector("#searchTrigger").onclick = openPalette;
document.querySelector("#themeBtn").onclick = toggleTheme;
document.querySelector("#closeBtn").onclick = () => parent.postMessage({ type: "DEVKIT_CLOSE" }, "*");
document.querySelector("#sidebar").addEventListener("click", event => {
  const page = event.target.closest("[data-page]");
  if (page) navigate(page.dataset.page);
});
document.querySelector("#collapseBtn").onclick = () => {
  state.collapsed = !state.collapsed;
  shell.classList.toggle("collapsed", state.collapsed);
  persist("collapsed");
};

paletteBackdrop.onclick = event => { if (event.target === paletteBackdrop) closePalette(); };
paletteInput.oninput = () => { state.selectedCommand = 0; renderPalette(); };
paletteInput.onkeydown = event => {
  const commands = paletteCommands(paletteInput.value);
  if (event.key === "ArrowDown") { event.preventDefault(); state.selectedCommand = Math.min(commands.length - 1, state.selectedCommand + 1); renderPalette(); }
  if (event.key === "ArrowUp") { event.preventDefault(); state.selectedCommand = Math.max(0, state.selectedCommand - 1); renderPalette(); }
  if (event.key === "Enter" && commands[state.selectedCommand]) executeCommand(commands[state.selectedCommand].id);
};
paletteResults.onclick = event => {
  const command = event.target.closest("[data-command]");
  if (command) executeCommand(command.dataset.command);
};

document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openPalette(); }
  if (event.key === "Escape") {
    if (!paletteBackdrop.hidden) closePalette();
    else if (!document.querySelector("#dialogBackdrop").hidden) document.querySelector("#dialogBackdrop [data-cancel]")?.click();
    else parent.postMessage({ type: "DEVKIT_CLOSE" }, "*");
  }
});

let resizing = false;
document.querySelector("#resizeHandle").onpointerdown = event => {
  resizing = true;
  event.target.setPointerCapture(event.pointerId);
};
document.querySelector("#resizeHandle").onpointermove = event => {
  if (!resizing) return;
  parent.postMessage({ type: "DEVKIT_RESIZE", payload: { width: innerWidth + (0 - event.clientX) } }, "*");
};
document.querySelector("#resizeHandle").onpointerup = () => { resizing = false; };

const rerenderFilter = debounce(value => {
  state.filter = value;
  render();
  content.querySelector("[data-filter]")?.focus();
}, 160);

content.addEventListener("input", event => {
  if (event.target.matches("[data-filter]")) rerenderFilter(event.target.value);
  if (["regexPattern", "regexFlags", "regexText"].includes(event.target.id)) updateRegex();
  if (["colorPicker", "colorHex", "colorOpacity", "gradientStart", "gradientEnd"].includes(event.target.id)) updateColor(event.target);
  if (["noteTitle", "noteBody", "noteTags"].includes(event.target.id)) autosaveNote();
});

content.addEventListener("change", async event => {
  if (event.target.matches("[data-storage-key]")) {
    const oldKey = event.target.dataset.storageKey;
    const row = event.target.closest(".table-row");
    const nextKey = row.querySelector('[data-role="key"]').value;
    const value = row.querySelector('[data-role="value"]').value;
    if (nextKey !== oldKey) await setPageStorage(state.storageScope, oldKey, null);
    await setPageStorage(state.storageScope, nextKey, value);
    toast("Storage updated");
  }
});

content.addEventListener("click", async event => {
  const page = event.target.closest("[data-page]");
  if (page) return navigate(page.dataset.page);
  const copyValue = event.target.closest("[data-copy]");
  if (copyValue) return copy(copyValue.dataset.copy);
  const copyTarget = event.target.closest("[data-copy-target]");
  if (copyTarget) return copy(document.querySelector(copyTarget.dataset.copyTarget)?.textContent || "");
  const tab = event.target.closest("[data-tab]");
  if (tab) return changeTab(tab.dataset.tab);
  const actionElement = event.target.closest("[data-action]");
  if (actionElement) return runAction(actionElement.dataset.action);
  const hash = event.target.closest("[data-hash]");
  if (hash) return generateHash(hash.dataset.hash);
  const accent = event.target.closest("[data-accent]");
  if (accent) return setAccent(accent.dataset.accent, accent.dataset.rgb);
  const deleteStorage = event.target.closest("[data-delete-storage]");
  if (deleteStorage) { await setPageStorage(state.storageScope, deleteStorage.dataset.deleteStorage, null); toast("Value deleted"); return; }
  const deleteCookie = event.target.closest("[data-delete-cookie]");
  if (deleteCookie) return removeCookie(Number(deleteCookie.dataset.deleteCookie));
  const editCookie = event.target.closest("[data-edit-cookie]");
  if (editCookie) return editCookieAt(Number(editCookie.dataset.editCookie));
  const duplicateCookie = event.target.closest("[data-duplicate-cookie]");
  if (duplicateCookie) return duplicateCookieAt(Number(duplicateCookie.dataset.duplicateCookie));
  const applyStoragePreset = event.target.closest("[data-apply-storage-preset]");
  if (applyStoragePreset) return applyStoragePresetAt(Number(applyStoragePreset.dataset.applyStoragePreset));
  const duplicateStoragePreset = event.target.closest("[data-duplicate-storage-preset]");
  if (duplicateStoragePreset) { const preset = state.storagePresets[Number(duplicateStoragePreset.dataset.duplicateStoragePreset)]; state.storagePresets.push({ ...preset, name: `${preset.name} copy`, values: { ...preset.values } }); await persist("storagePresets"); render(); return; }
  const renameStoragePreset = event.target.closest("[data-rename-storage-preset]");
  if (renameStoragePreset) return renameStoragePresetAt(Number(renameStoragePreset.dataset.renameStoragePreset));
  const deleteStoragePreset = event.target.closest("[data-delete-storage-preset]");
  if (deleteStoragePreset) { state.storagePresets.splice(Number(deleteStoragePreset.dataset.deleteStoragePreset), 1); await persist("storagePresets"); render(); return; }
  const deletePreset = event.target.closest("[data-delete-preset]");
  if (deletePreset) { state.headerPresets.splice(Number(deletePreset.dataset.deletePreset), 1); await persist("headerPresets"); render(); return; }
  const deleteEnv = event.target.closest("[data-delete-env]");
  if (deleteEnv) { state.variables.splice(Number(deleteEnv.dataset.deleteEnv), 1); await persist("variables"); render(); return; }
  const favoriteSnippet = event.target.closest("[data-favorite-snippet]");
  if (favoriteSnippet) { const item = state.snippets[Number(favoriteSnippet.dataset.favoriteSnippet)]; item.favorite = !item.favorite; await persist("snippets"); render(); return; }
  const deleteSnippet = event.target.closest("[data-delete-snippet]");
  if (deleteSnippet) { state.snippets.splice(Number(deleteSnippet.dataset.deleteSnippet), 1); await persist("snippets"); render(); return; }
  const note = event.target.closest("[data-note]");
  if (note) { state.activeNote = note.dataset.note; render(); }
});

const changeTab = tab => {
  if (state.page === "storage") state.storageScope = tab;
  if (state.page === "json") state.jsonMode = tab;
  if (state.page === "base64") state.base64Mode = tab;
  if (state.page === "request") state.codeType = tab;
  if (state.page === "network") state.networkType = tab;
  if (state.page === "settings") {
    state.theme = tab;
    applyTheme();
    persist("theme");
  }
  if (state.page === "request") generateRequestCode();
  render();
};

const setPageStorage = async (scope, key, value) => {
  parent.postMessage({ type: "DEVKIT_STORAGE_SET", payload: { scope, key, value } }, "*");
  if (value === null) delete state.context[scope][key]; else state.context[scope][key] = value;
  render();
};

const chooseFile = (accept, handler) => {
  fileInput.accept = accept;
  fileInput.value = "";
  fileInput.onchange = () => fileInput.files[0] && handler(fileInput.files[0]);
  fileInput.click();
};

const exportJson = (name, value) => download(name, JSON.stringify(value, null, 2));
const importJson = (handler) => chooseFile("application/json,.json", file => {
  const reader = new FileReader();
  reader.onload = () => {
    try { handler(JSON.parse(reader.result)); }
    catch { toast("That file is not valid JSON", true); }
  };
  reader.readAsText(file);
});

const runAction = async name => {
  if (name === "storage-add") {
    const value = await dialog({ title: "Add storage value", fields: [{ name: "key", label: "Key", required: true }, { name: "value", label: "Value" }] });
    if (value) { await setPageStorage(state.storageScope, value.key, value.value); toast("Value added"); }
  }
  if (name === "storage-export") exportJson(`${state.context.domain || "devkit"}-${state.storageScope}-storage.json`, state.context[state.storageScope] || {});
  if (name === "storage-import") importJson(async value => { for (const [key, item] of Object.entries(value)) await setPageStorage(state.storageScope, key, String(item)); toast("Storage imported"); });
  if (name === "storage-preset") saveStoragePreset();
  if (name === "cookie-add") createCookie();
  if (name === "cookies-export") exportJson(`${state.context.domain || "devkit"}-cookies.json`, state.cookies);
  if (name === "cookies-import") importJson(importCookies);
  if (name === "header-generate") generateHeaders();
  if (name === "header-save") saveHeaderPreset();
  if (name === "request-send") sendRequest();
  if (name === "json-run") runJson();
  if (name === "json-copy") copy(state.jsonOutput || document.querySelector("#jsonInput")?.value || "");
  if (name === "json-download") download("devkit.json", state.jsonOutput || document.querySelector("#jsonInput")?.value || "{}", "application/json");
  if (name === "jwt-decode") decodeJwt();
  if (name === "regex-save") saveRegex();
  if (name.startsWith("url-")) runUrl(name.slice(4));
  if (name === "base64-run") runBase64();
  if (name === "base64-file") chooseFile("*/*", encodeFile);
  if (name.startsWith("timestamp-")) convertTimestamp(name.slice(10));
  if (name === "uuid-generate") generateUuids();
  if (name === "uuid-copy-all") copy((state.uuids || []).join("\n"));
  if (name === "qr-generate") generateQr();
  if (name === "qr-download") downloadQr();
  if (name === "env-add") addEnvironment();
  if (name === "env-export") exportJson("devkit-environment.json", state.variables);
  if (name === "env-import") importJson(async value => { state.variables = Array.isArray(value) ? value : Object.entries(value).map(([key, item]) => ({ key, value: String(item) })); await persist("variables"); render(); });
  if (name === "snippet-add") addSnippet();
  if (name === "snippet-favorites") { state.filter = ""; state.snippets = [...state.snippets].sort((a, b) => Number(b.favorite) - Number(a.favorite)); render(); }
  if (name === "note-add") addNote();
  if (name === "note-pin") toggleNotePin();
  if (name === "note-delete") deleteNote();
  if (name === "network-clear") { state.network = []; render(); }
  if (name === "settings-export") exportJson("devkit-settings.json", await store.all());
  if (name === "settings-import") importJson(async value => { for (const [key, item] of Object.entries(value)) await store.set(key, item); toast("Settings imported"); setTimeout(() => location.reload(), 500); });
  if (name === "settings-reset") resetSettings();
};

const createCookie = async () => {
  const value = await dialog({ title: "Create cookie", fields: [{ name: "name", label: "Name", required: true }, { name: "value", label: "Value" }, { name: "path", label: "Path", value: "/" }] });
  if (!value) return;
  await bridge("DEVKIT_COOKIE_SET", { cookie: { url: state.context.url, name: value.name, value: value.value, path: value.path || "/" } });
  toast("Cookie created");
  loadCookies();
};

const editCookieAt = async index => {
  const cookie = state.cookies[index];
  const value = await dialog({ title: `Edit ${cookie.name}`, fields: [{ name: "value", label: "Value", value: cookie.value, type: "textarea" }] });
  if (!value) return;
  await bridge("DEVKIT_COOKIE_SET", { cookie: { url: state.context.url, name: cookie.name, value: value.value, path: cookie.path || "/", secure: cookie.secure, sameSite: cookie.sameSite === "unspecified" ? undefined : cookie.sameSite } });
  toast("Cookie updated");
  loadCookies();
};

const duplicateCookieAt = async index => {
  const cookie = state.cookies[index];
  const value = await dialog({ title: "Duplicate cookie", fields: [{ name: "name", label: "New name", value: `${cookie.name}_copy`, required: true }, { name: "value", label: "Value", value: cookie.value }] });
  if (!value) return;
  await bridge("DEVKIT_COOKIE_SET", { cookie: { url: state.context.url, name: value.name, value: value.value, path: cookie.path || "/", secure: cookie.secure, sameSite: cookie.sameSite === "unspecified" ? undefined : cookie.sameSite } });
  toast("Cookie duplicated");
  loadCookies();
};

const saveStoragePreset = async () => {
  const value = await dialog({ title: "Save storage preset", fields: [{ name: "name", label: "Preset name", required: true, placeholder: "Local development" }] });
  if (!value) return;
  state.storagePresets.push({ name: value.name, scope: state.storageScope, values: { ...(state.context[state.storageScope] || {}) } });
  await persist("storagePresets");
  render();
};

const applyStoragePresetAt = async index => {
  const preset = state.storagePresets[index];
  state.storageScope = preset.scope;
  for (const [key, value] of Object.entries(preset.values)) await setPageStorage(preset.scope, key, value);
  toast("Preset applied");
};

const renameStoragePresetAt = async index => {
  const preset = state.storagePresets[index];
  const value = await dialog({ title: "Rename preset", fields: [{ name: "name", label: "Preset name", value: preset.name, required: true }] });
  if (!value) return;
  preset.name = value.name;
  await persist("storagePresets");
  render();
};

const removeCookie = async index => {
  const cookie = state.cookies[index];
  await bridge("DEVKIT_COOKIE_DELETE", { url: state.context.url, name: cookie.name });
  toast("Cookie deleted");
  loadCookies();
};

const importCookies = async cookies => {
  if (!Array.isArray(cookies)) return toast("Expected an array of cookies", true);
  for (const cookie of cookies) await bridge("DEVKIT_COOKIE_SET", { cookie: { url: state.context.url, name: cookie.name, value: cookie.value, path: cookie.path || "/", secure: cookie.secure, sameSite: cookie.sameSite === "unspecified" ? undefined : cookie.sameSite } });
  toast("Cookies imported");
  loadCookies();
};

const generateHeaders = () => {
  const auth = document.querySelector("#headerAuth").value;
  const token = document.querySelector("#headerToken").value;
  const value = {
    "Content-Type": document.querySelector("#headerContent").value,
    Accept: document.querySelector("#headerAccept").value,
    "Cache-Control": document.querySelector("#headerCache").value
  };
  try { Object.assign(value, JSON.parse(document.querySelector("#headerCustom").value || "{}")); }
  catch { return toast("Custom headers must be valid JSON", true); }
  if (auth === "Bearer" && token) value.Authorization = `Bearer ${token}`;
  if (auth === "Basic" && token) value.Authorization = `Basic ${btoa(token)}`;
  state.headerOutput = JSON.stringify(value, null, 2);
  state.generatedHeaders = value;
  render();
};

const saveHeaderPreset = async () => {
  if (!state.generatedHeaders) generateHeaders();
  const result = await dialog({ title: "Save header preset", fields: [{ name: "name", label: "Preset name", required: true, placeholder: "Production API" }] });
  if (!result) return;
  state.headerPresets.push({ name: result.name, value: state.generatedHeaders || {} });
  await persist("headerPresets");
  render();
};

const requestValues = () => {
  const method = document.querySelector("#requestMethod")?.value || "GET";
  const rawUrl = document.querySelector("#requestUrl")?.value || "";
  const query = document.querySelector("#requestQuery")?.value.trim();
  const body = document.querySelector("#requestBody")?.value || "";
  let headers = {};
  try { headers = JSON.parse(document.querySelector("#requestHeaders")?.value || "{}"); } catch {}
  const auth = document.querySelector("#requestAuth")?.value;
  const authValue = document.querySelector("#requestAuthValue")?.value;
  if (auth === "Bearer" && authValue) headers.Authorization = `Bearer ${authValue}`;
  if (auth === "Basic" && authValue) headers.Authorization = `Basic ${btoa(authValue)}`;
  const url = query ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}${query}` : rawUrl;
  return { method, url: substitute(url), headers, body };
};

const requestCode = (values, type) => {
  const options = { method: values.method, headers: values.headers };
  if (!['GET', 'HEAD'].includes(values.method) && values.body) options.body = values.body;
  if (type === "axios") return `axios({\n  method: '${values.method.toLowerCase()}',\n  url: '${values.url}',\n  headers: ${JSON.stringify(values.headers, null, 2)},${values.body ? `\n  data: ${values.body}` : ""}\n});`;
  if (type === "curl") return `curl -X ${values.method} '${values.url}'${Object.entries(values.headers).map(([key, value]) => ` \\\n  -H '${key}: ${value}'`).join("")}${values.body ? ` \\\n  -d '${values.body.replaceAll("'", "'\\''")}'` : ""}`;
  return `const response = await fetch('${values.url}', ${JSON.stringify(options, null, 2)});\nconst data = await response.json();`;
};

const generateRequestCode = values => {
  if (!values && !document.querySelector("#requestUrl")) return;
  values ||= requestValues();
  state.requestCode = requestCode(values, state.codeType);
};

const sendRequest = async () => {
  const values = requestValues();
  if (!values.url) return toast("Enter a request URL", true);
  generateRequestCode(values);
  render();
  const options = { method: values.method, headers: values.headers };
  if (!['GET', 'HEAD'].includes(values.method) && values.body) options.body = substitute(values.body);
  state.requestResult = await bridge("DEVKIT_FETCH", { url: values.url, options });
  render();
};

const runJson = () => {
  state.jsonInput = document.querySelector("#jsonInput").value;
  try {
    const value = JSON.parse(state.jsonInput);
    state.jsonValid = true;
    state.jsonMessage = "Valid JSON";
    state.jsonOutput = state.jsonMode === "minify" ? JSON.stringify(value) : JSON.stringify(value, null, 2);
    if (state.jsonMode === "validate") state.jsonOutput = "✓ Valid JSON\n\nNo syntax errors found.";
    if (state.jsonMode === "tree-view") state.jsonOutput = treeText(value);
  } catch (error) {
    state.jsonValid = false;
    state.jsonMessage = error.message;
    state.jsonOutput = "";
  }
  render();
};

const treeText = (value, depth = 0) => Object.entries(value).map(([key, item]) => `${"  ".repeat(depth)}${Array.isArray(value) ? "[" + key + "]" : key}${item && typeof item === "object" ? `\n${treeText(item, depth + 1)}` : `: ${JSON.stringify(item)}`}`).join("\n");

const decodeJwt = () => {
  state.jwtInput = document.querySelector("#jwtInput").value.trim();
  try {
    const [header, payload] = state.jwtInput.split(".");
    const decode = part => JSON.parse(decodeURIComponent(atob(part.replaceAll("-", "+").replaceAll("_", "/")).split("").map(character => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
    state.jwt = { header: decode(header), payload: decode(payload) };
    state.jwt.expired = Boolean(state.jwt.payload.exp && state.jwt.payload.exp * 1000 < Date.now());
    state.jwtError = "";
  } catch { state.jwt = null; state.jwtError = "Invalid JWT structure"; }
  render();
};

const updateRegex = () => {
  state.regexPattern = document.querySelector("#regexPattern")?.value || "";
  state.regexFlags = document.querySelector("#regexFlags")?.value || "";
  state.regexText = document.querySelector("#regexText")?.value || "";
  try {
    const flags = state.regexFlags.includes("g") ? state.regexFlags : `${state.regexFlags}g`;
    const expression = new RegExp(state.regexPattern, flags);
    const matches = [...state.regexText.matchAll(expression)];
    state.regexMatches = matches.length;
    state.regexError = "";
    let cursor = 0;
    state.regexOutput = matches.map(match => {
      const before = escapeHtml(state.regexText.slice(cursor, match.index));
      cursor = match.index + match[0].length;
      return `${before}<mark class="match">${escapeHtml(match[0])}</mark>`;
    }).join("") + escapeHtml(state.regexText.slice(cursor));
    document.querySelector("#regexOutput").innerHTML = state.regexOutput || "No matches found.";
    document.querySelector("#regexOutput")?.closest(".card")?.querySelector(".card-header h2");
  } catch (error) { state.regexError = error.message; }
};

const saveRegex = async () => {
  updateRegex();
  const saved = await store.get("devkit-regex", []);
  saved.push({ pattern: state.regexPattern, flags: state.regexFlags, created: Date.now() });
  await store.set("devkit-regex", saved);
  toast("Expression saved");
};

const runUrl = mode => {
  state.urlInput = document.querySelector("#urlInput").value;
  try {
    if (mode === "encode") state.urlOutput = encodeURIComponent(state.urlInput);
    if (mode === "decode") state.urlOutput = decodeURIComponent(state.urlInput);
    if (mode === "parse") {
      const parsed = new URL(state.urlInput);
      state.urlParams = [...parsed.searchParams.entries()];
      state.urlOutput = `Origin: ${parsed.origin}\nProtocol: ${parsed.protocol}\nHost: ${parsed.host}\nPath: ${parsed.pathname}\nHash: ${parsed.hash || "—"}`;
    }
  } catch (error) { state.urlOutput = error.message; state.urlParams = []; }
  render();
};

const updateColor = target => {
  if (target.id === "colorPicker" || target.id === "colorHex") state.color = target.value;
  if (target.id === "colorOpacity") state.opacity = target.value;
  if (target.id === "gradientStart") state.color = target.value;
  if (target.id === "gradientEnd") state.gradientEnd = target.value;
  if (/^#[\da-f]{6}$/i.test(state.color || "")) render();
};

const runBase64 = () => {
  state.base64Input = document.querySelector("#base64Input").value;
  try {
    state.base64Output = state.base64Mode === "decode" ? decodeURIComponent(atob(state.base64Input).split("").map(character => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")) : btoa(unescape(encodeURIComponent(state.base64Input)));
  } catch { return toast("Invalid Base64 input", true); }
  render();
};

const encodeFile = file => {
  const reader = new FileReader();
  reader.onload = () => { state.base64Output = reader.result; render(); };
  reader.readAsDataURL(file);
};

const generateHash = async type => {
  state.hashInput = document.querySelector("#hashInput").value;
  state.hashType = type;
  if (type === "MD5") state.hashOutput = md5(state.hashInput);
  else {
    const digest = await crypto.subtle.digest(type, new TextEncoder().encode(state.hashInput));
    state.hashOutput = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }
  render();
};

const md5 = input => {
  const rotate = (value, amount) => value << amount | value >>> 32 - amount;
  const add = (a, b) => a + b | 0;
  const cmn = (q, a, b, x, s, t) => add(rotate(add(add(a, q), add(x, t)), s), b);
  const ff = (a,b,c,d,x,s,t) => cmn(b & c | ~b & d,a,b,x,s,t);
  const gg = (a,b,c,d,x,s,t) => cmn(b & d | c & ~d,a,b,x,s,t);
  const hh = (a,b,c,d,x,s,t) => cmn(b ^ c ^ d,a,b,x,s,t);
  const ii = (a,b,c,d,x,s,t) => cmn(c ^ (b | ~d),a,b,x,s,t);
  const bytes = new TextEncoder().encode(input);
  const length = ((bytes.length + 8) >> 6) + 1;
  const words = new Int32Array(length * 16);
  bytes.forEach((byte, index) => words[index >> 2] |= byte << index % 4 * 8);
  words[bytes.length >> 2] |= 0x80 << bytes.length % 4 * 8;
  words[words.length - 2] = bytes.length * 8;
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < words.length; i += 16) {
    const [aa,bb,cc,dd] = [a,b,c,d];
    a=ff(a,b,c,d,words[i],7,-680876936); d=ff(d,a,b,c,words[i+1],12,-389564586); c=ff(c,d,a,b,words[i+2],17,606105819); b=ff(b,c,d,a,words[i+3],22,-1044525330);
    a=ff(a,b,c,d,words[i+4],7,-176418897); d=ff(d,a,b,c,words[i+5],12,1200080426); c=ff(c,d,a,b,words[i+6],17,-1473231341); b=ff(b,c,d,a,words[i+7],22,-45705983);
    a=ff(a,b,c,d,words[i+8],7,1770035416); d=ff(d,a,b,c,words[i+9],12,-1958414417); c=ff(c,d,a,b,words[i+10],17,-42063); b=ff(b,c,d,a,words[i+11],22,-1990404162);
    a=ff(a,b,c,d,words[i+12],7,1804603682); d=ff(d,a,b,c,words[i+13],12,-40341101); c=ff(c,d,a,b,words[i+14],17,-1502002290); b=ff(b,c,d,a,words[i+15],22,1236535329);
    a=gg(a,b,c,d,words[i+1],5,-165796510); d=gg(d,a,b,c,words[i+6],9,-1069501632); c=gg(c,d,a,b,words[i+11],14,643717713); b=gg(b,c,d,a,words[i],20,-373897302);
    a=gg(a,b,c,d,words[i+5],5,-701558691); d=gg(d,a,b,c,words[i+10],9,38016083); c=gg(c,d,a,b,words[i+15],14,-660478335); b=gg(b,c,d,a,words[i+4],20,-405537848);
    a=gg(a,b,c,d,words[i+9],5,568446438); d=gg(d,a,b,c,words[i+14],9,-1019803690); c=gg(c,d,a,b,words[i+3],14,-187363961); b=gg(b,c,d,a,words[i+8],20,1163531501);
    a=gg(a,b,c,d,words[i+13],5,-1444681467); d=gg(d,a,b,c,words[i+2],9,-51403784); c=gg(c,d,a,b,words[i+7],14,1735328473); b=gg(b,c,d,a,words[i+12],20,-1926607734);
    a=hh(a,b,c,d,words[i+5],4,-378558); d=hh(d,a,b,c,words[i+8],11,-2022574463); c=hh(c,d,a,b,words[i+11],16,1839030562); b=hh(b,c,d,a,words[i+14],23,-35309556);
    a=hh(a,b,c,d,words[i+1],4,-1530992060); d=hh(d,a,b,c,words[i+4],11,1272893353); c=hh(c,d,a,b,words[i+7],16,-155497632); b=hh(b,c,d,a,words[i+10],23,-1094730640);
    a=hh(a,b,c,d,words[i+13],4,681279174); d=hh(d,a,b,c,words[i],11,-358537222); c=hh(c,d,a,b,words[i+3],16,-722521979); b=hh(b,c,d,a,words[i+6],23,76029189);
    a=hh(a,b,c,d,words[i+9],4,-640364487); d=hh(d,a,b,c,words[i+12],11,-421815835); c=hh(c,d,a,b,words[i+15],16,530742520); b=hh(b,c,d,a,words[i+2],23,-995338651);
    a=ii(a,b,c,d,words[i],6,-198630844); d=ii(d,a,b,c,words[i+7],10,1126891415); c=ii(c,d,a,b,words[i+14],15,-1416354905); b=ii(b,c,d,a,words[i+5],21,-57434055);
    a=ii(a,b,c,d,words[i+12],6,1700485571); d=ii(d,a,b,c,words[i+3],10,-1894986606); c=ii(c,d,a,b,words[i+10],15,-1051523); b=ii(b,c,d,a,words[i+1],21,-2054922799);
    a=ii(a,b,c,d,words[i+8],6,1873313359); d=ii(d,a,b,c,words[i+15],10,-30611744); c=ii(c,d,a,b,words[i+6],15,-1560198380); b=ii(b,c,d,a,words[i+13],21,1309151649);
    a=ii(a,b,c,d,words[i+4],6,-145523070); d=ii(d,a,b,c,words[i+11],10,-1120210379); c=ii(c,d,a,b,words[i+2],15,718787259); b=ii(b,c,d,a,words[i+9],21,-343485551);
    a=add(a,aa); b=add(b,bb); c=add(c,cc); d=add(d,dd);
  }
  return [a,b,c,d].map(value => [0,8,16,24].map(shift => (value >>> shift & 255).toString(16).padStart(2,"0")).join("")).join("");
};

const convertTimestamp = mode => {
  const date = mode === "unix" ? new Date(Number(document.querySelector("#unixInput").value) * 1000) : new Date(document.querySelector("#dateInput").value);
  if (Number.isNaN(date.getTime())) return toast("Invalid date", true);
  state.timestampDate = date.toISOString();
  render();
};

const generateUuids = () => {
  const count = Math.min(100, Math.max(1, Number(document.querySelector("#uuidCount").value) || 1));
  state.uuidCount = count;
  state.uuids = Array.from({ length: count }, uuid);
  render();
};

const generateQr = () => {
  state.qrInput = document.querySelector("#qrInput")?.value || state.qrInput || "";
  render();
};

const drawQr = (text, canvas) => {
  const bytes = [...new TextEncoder().encode(text)];
  const version = bytes.length <= 17 ? 1 : 2;
  const max = version === 1 ? 17 : 32;
  if (bytes.length > max) {
    toast(`QR input is limited to ${max} UTF-8 bytes`, true);
    return;
  }
  const dataCount = version === 1 ? 19 : 34;
  const eccCount = version === 1 ? 7 : 10;
  const bits = [0,1,0,0, ...[...Array(8)].map((_, i) => bytes.length >> 7 - i & 1)];
  bytes.forEach(byte => { for (let i = 7; i >= 0; i--) bits.push(byte >> i & 1); });
  for (let i = 0; i < Math.min(4, dataCount * 8 - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0; data.length < dataCount; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  const multiply = (x, y) => { let result = 0; for (let i = 7; i >= 0; i--) { result = result << 1 ^ (result >>> 7) * 0x11d; result ^= (y >>> i & 1) * x; } return result; };
  const divisor = new Uint8Array(eccCount); divisor[eccCount - 1] = 1;
  let root = 1;
  for (let i = 0; i < eccCount; i++) { for (let j = 0; j < eccCount; j++) { divisor[j] = multiply(divisor[j], root); if (j + 1 < eccCount) divisor[j] ^= divisor[j + 1]; } root = multiply(root, 2); }
  const remainder = new Uint8Array(eccCount);
  data.forEach(byte => { const factor = byte ^ remainder[0]; remainder.copyWithin(0, 1); remainder[eccCount - 1] = 0; divisor.forEach((value, index) => remainder[index] ^= multiply(value, factor)); });
  const codewords = [...data, ...remainder];
  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const set = (row, column, value) => { if (row >= 0 && column >= 0 && row < size && column < size) matrix[row][column] = Boolean(value); };
  const finder = (centerRow, centerColumn) => { for (let row = -4; row <= 4; row++) for (let column = -4; column <= 4; column++) { const distance = Math.max(Math.abs(row), Math.abs(column)); set(centerRow + row, centerColumn + column, distance !== 2 && distance !== 4); } };
  finder(3, 3); finder(3, size - 4); finder(size - 4, 3);
  for (let index = 8; index < size - 8; index++) { set(6, index, index % 2 === 0); set(index, 6, index % 2 === 0); }
  if (version === 2) for (let row = -2; row <= 2; row++) for (let column = -2; column <= 2; column++) set(18 + row, 18 + column, Math.max(Math.abs(row), Math.abs(column)) !== 1);
  const format = 0x77c4;
  for (let i = 0; i <= 5; i++) set(i, 8, format >> i & 1);
  set(7,8,format>>6&1); set(8,8,format>>7&1); set(8,7,format>>8&1);
  for (let i = 9; i < 15; i++) set(8,14-i,format>>i&1);
  for (let i = 0; i < 8; i++) set(8,size-1-i,format>>i&1);
  for (let i = 8; i < 15; i++) set(size-15+i,8,format>>i&1);
  set(size-8,8,true);
  const dataBits = codewords.flatMap(byte => [...Array(8)].map((_, i) => byte >> 7 - i & 1));
  let bitIndex = 0, upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vertical = 0; vertical < size; vertical++) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const column = right - offset;
        if (matrix[row][column] !== null) continue;
        const value = (dataBits[bitIndex++] || 0) ^ ((row + column) % 2 === 0);
        set(row, column, value);
      }
    }
    upward = !upward;
  }
  const context = canvas.getContext("2d"), quiet = 4, scale = Math.floor(canvas.width / (size + quiet * 2)), offset = Math.floor((canvas.width - size * scale) / 2);
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111217";
  matrix.forEach((row, y) => row.forEach((value, x) => { if (value) context.fillRect(offset + x * scale, offset + y * scale, scale, scale); }));
};

const downloadQr = () => {
  const canvas = document.querySelector("#qrCanvas");
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = "devkit-qr.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};

const addEnvironment = async () => {
  const value = await dialog({ title: "Add environment variable", fields: [{ name: "key", label: "Variable name", placeholder: "API_URL", required: true }, { name: "value", label: "Value", required: true }, { name: "secret", label: "Secret (type yes to mask)", placeholder: "no" }] });
  if (!value) return;
  state.variables.push({ key: value.key.toUpperCase(), value: value.value, secret: value.secret.toLowerCase() === "yes" });
  await persist("variables");
  render();
};

const substitute = input => String(input).replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => state.variables.find(variable => variable.key === key)?.value ?? match);

const addSnippet = async () => {
  const value = await dialog({ title: "New snippet", fields: [{ name: "title", label: "Title", required: true }, { name: "language", label: "Language", value: "JavaScript" }, { name: "code", label: "Code", type: "textarea", required: true }] });
  if (!value) return;
  state.snippets.unshift({ ...value, id: uuid(), favorite: false, created: Date.now() });
  await persist("snippets");
  render();
};

const addNote = async () => {
  const value = await dialog({ title: "New note", fields: [{ name: "title", label: "Note title", required: true, placeholder: "Untitled note" }] });
  if (!value) return;
  const note = { id: uuid(), title: value.title, body: "", tags: [], pinned: false, updated: Date.now() };
  state.notes.unshift(note);
  state.activeNote = note.id;
  await persist("notes");
  render();
};

const autosaveNote = debounce(async () => {
  const note = state.notes.find(item => item.id === state.activeNote) || state.notes[0];
  if (!note) return;
  note.title = document.querySelector("#noteTitle")?.value || note.title;
  note.body = document.querySelector("#noteBody")?.value || "";
  note.tags = (document.querySelector("#noteTags")?.value || "").split(",").map(value => value.trim()).filter(Boolean);
  note.updated = Date.now();
  await persist("notes");
}, 350);

const activeNote = () => state.notes.find(note => note.id === state.activeNote) || state.notes[0];
const toggleNotePin = async () => { const note = activeNote(); if (!note) return; note.pinned = !note.pinned; await persist("notes"); render(); };
const deleteNote = async () => { const note = activeNote(); if (!note) return; state.notes = state.notes.filter(item => item.id !== note.id); state.activeNote = state.notes[0]?.id; await persist("notes"); render(); };

const setAccent = (accent, rgb) => {
  state.accent = accent;
  state.accentRgb = rgb;
  applyTheme();
  persist("accent");
  persist("accentRgb");
  render();
};

const resetSettings = async () => {
  const result = await dialog({ title: "Reset DevKit?", description: "This removes all saved variables, notes, snippets, and preferences.", confirm: "Reset everything", danger: true, fields: [] });
  if (!result) return;
  await store.clear();
  location.reload();
};

const afterRender = () => {
  if (state.page === "qr") requestAnimationFrame(() => drawQr(state.qrInput || "https://example.com", document.querySelector("#qrCanvas")));
  if (state.page === "request") {
    const update = debounce(() => { generateRequestCode(); const output = document.querySelector("#requestCode"); if (output) output.textContent = state.requestCode; }, 100);
    ["requestMethod", "requestUrl", "requestAuth", "requestAuthValue", "requestHeaders", "requestQuery", "requestBody"].forEach(id => document.querySelector(`#${id}`)?.addEventListener("input", update));
  }
};

initialize();
