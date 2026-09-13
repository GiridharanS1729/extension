import { icon } from "./icons.js";
import { bridge, copy, debounce, dialog, download, empty, escapeHtml, formatBytes, pageHead, store, uuid } from "./utils.js";

export const tools = [
  { id: "dashboard", name: "Dashboard", icon: "dashboard", group: "Overview" },
  { id: "storage", name: "Storage", icon: "storage", group: "Website" },
  { id: "cookies", name: "Cookies", icon: "cookies", group: "Website" },
  { id: "headers", name: "Headers", icon: "headers", group: "Website" },
  { id: "request", name: "Request Builder", icon: "request", group: "API & Data" },
  { id: "json", name: "JSON Tools", icon: "json", group: "API & Data" },
  { id: "jwt", name: "JWT", icon: "jwt", group: "API & Data" },
  { id: "regex", name: "Regex", icon: "regex", group: "Text" },
  { id: "url", name: "URL Tools", icon: "url", group: "Text" },
  { id: "color", name: "Color Tools", icon: "color", group: "Generators" },
  { id: "base64", name: "Base64", icon: "base64", group: "Text" },
  { id: "hash", name: "Hash Generator", icon: "hash", group: "Text" },
  { id: "timestamp", name: "Timestamp", icon: "timestamp", group: "Generators" },
  { id: "uuid", name: "UUID", icon: "uuid", group: "Generators" },
  { id: "qr", name: "QR Generator", icon: "qr", group: "Generators" },
  { id: "environment", name: "Environment Variables", icon: "environment", group: "Workspace" },
  { id: "snippets", name: "Snippets", icon: "snippets", group: "Workspace" },
  { id: "notes", name: "Notes", icon: "notes", group: "Workspace" },
  { id: "network", name: "Network Monitor", icon: "network", group: "Website" },
  { id: "settings", name: "Settings", icon: "settings", group: "System" }
];

const action = (name, label, iconName = "plus", primary = false) => `<button class="btn ${primary ? "primary" : ""}" data-action="${name}">${icon(iconName)} ${label}</button>`;
const textArea = (id, placeholder, value = "", height = 150) => `<textarea id="${id}" class="code-input" placeholder="${escapeHtml(placeholder)}" style="min-height:${height}px">${escapeHtml(value)}</textarea>`;
const tabButtons = (tabs, active) => `<div class="segmented">${tabs.map(tab => `<button data-tab="${tab.toLowerCase().replaceAll(" ", "-")}" class="${tab.toLowerCase().replaceAll(" ", "-") === active ? "active" : ""}">${tab}</button>`).join("")}</div>`;
const output = (id, value = "") => `<div class="code-block" id="${id}">${escapeHtml(value)}</div><div class="output-actions"><button class="btn" data-copy-target="#${id}">${icon("copy")} Copy</button></div>`;

const dashboard = state => {
  const data = state.context || {};
  const greeting = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening";
  const metrics = [
    ["Protocol", data.protocol?.toUpperCase() || "—", "globe"],
    ["Page size", formatBytes(data.pageSize), "storage"],
    ["Cookies", state.cookieCount ?? "—", "cookies"],
    ["Local storage", Object.keys(data.local || {}).length, "storage"],
    ["Session storage", Object.keys(data.session || {}).length, "storage"],
    ["Page load", data.timing ? `${data.timing} ms` : "—", "zap"],
    ["Viewport", data.viewport || "—", "monitor"],
    ["Screen", data.screen || "—", "monitor"],
    ["Timezone", data.timezone || "—", "timestamp"],
    ["Language", data.language || "—", "globe"],
    ["Clipboard", navigator.clipboard ? "Available" : "Unavailable", "copy"],
    ["Browser", navigator.userAgentData?.brands?.at(-1)?.brand || "Chrome", "dashboard"]
  ];
  return `<div class="page">${pageHead(`Good ${greeting}`, "Everything you need to inspect, transform, and ship—without leaving the page.")}
    <div class="card hero-card"><div class="metric-label">Current page</div><div class="domain">${escapeHtml(data.domain || "Waiting for page…")}</div><div class="url">${escapeHtml(data.url || "")}</div></div>
    <div class="grid four" style="margin-top:10px">${metrics.map(([label, value, iconName]) => `<div class="card metric"><div class="metric-label">${icon(iconName)}${label}</div><div class="metric-value ${String(value).length > 18 ? "small" : ""}" title="${escapeHtml(value)}">${escapeHtml(value)}</div></div>`).join("")}</div>
    <div class="card" style="margin-top:10px"><div class="card-header"><h2>Quick tools</h2><span class="tag">${tools.length - 2} utilities</span></div><div class="tool-grid">${tools.filter(tool => !["dashboard", "settings"].includes(tool.id)).map(tool => `<button class="tool-tile" data-page="${tool.id}"><span class="tile-icon">${icon(tool.icon)}</span><span>${tool.name}</span></button>`).join("")}</div></div>
    <div class="card" style="margin-top:10px"><div class="card-header"><h2>Browser details</h2></div><div class="code-block">${escapeHtml(data.browser || navigator.userAgent)}</div></div>
  </div>`;
};

const storageView = state => {
  const scope = state.storageScope || "local";
  const values = state.context?.[scope] || {};
  const rows = Object.entries(values).filter(([key]) => key.toLowerCase().includes((state.filter || "").toLowerCase()));
  return `<div class="page">${pageHead("Storage Manager", "Inspect and edit this page's local and session storage.", `${action("storage-import", "Import", "upload")}${action("storage-export", "Export", "download")}${action("storage-preset", "Save preset", "star")}${action("storage-add", "Add row", "plus", true)}`)}
    <div class="card"><div class="card-header">${tabButtons(["Local", "Session"], scope)}<label class="field" style="width:160px"><input data-filter placeholder="Search keys…" value="${escapeHtml(state.filter || "")}"></label></div>
    <div class="data-table"><div class="table-row header"><span>Key</span><span>Value</span><span>Actions</span></div>${rows.map(([key, value]) => `<div class="table-row"><input class="code" data-storage-key="${escapeHtml(key)}" data-role="key" value="${escapeHtml(key)}"><input class="code" data-storage-key="${escapeHtml(key)}" data-role="value" value="${escapeHtml(value)}"><div class="table-actions"><button class="icon-btn" data-copy="${escapeHtml(value)}">${icon("copy")}</button><button class="icon-btn" data-delete-storage="${escapeHtml(key)}">${icon("trash")}</button></div></div>`).join("") || `<div>${empty("No stored values", "Add a key-value pair to get started.", "storage")}</div>`}</div></div>
    <div class="card" style="margin-top:10px"><div class="card-header"><h2>Saved presets</h2><span class="tag">${(state.storagePresets || []).length}</span></div>${(state.storagePresets || []).length ? `<div class="snippet-list">${state.storagePresets.map((preset, index) => `<div class="list-card row between"><div><b>${escapeHtml(preset.name)}</b><p>${preset.scope} · ${Object.keys(preset.values).length} values</p></div><div class="table-actions"><button class="btn" data-apply-storage-preset="${index}">Apply</button><button class="icon-btn" data-duplicate-storage-preset="${index}">${icon("copy")}</button><button class="icon-btn" data-rename-storage-preset="${index}">${icon("settings")}</button><button class="icon-btn" data-delete-storage-preset="${index}">${icon("trash")}</button></div></div>`).join("")}</div>` : empty("No storage presets", "Save the current values for one-click reuse.", "star")}</div></div>`;
};

const cookiesView = state => {
  const cookies = (state.cookies || []).filter(cookie => `${cookie.name} ${cookie.value} ${cookie.domain}`.toLowerCase().includes((state.filter || "").toLowerCase()));
  return `<div class="page">${pageHead("Cookie Manager", "View and manage cookies available to the current page.", `${action("cookies-import", "Import", "upload")}${action("cookies-export", "Export", "download")}${action("cookie-add", "Create", "plus", true)}`)}
    <div class="card"><div class="card-header"><div class="row"><span class="tag">${cookies.length} cookies</span><span class="tag success">${state.context?.domain || "Current domain"}</span></div><input data-filter style="width:170px" placeholder="Search cookies…" value="${escapeHtml(state.filter || "")}"></div>
    <div class="data-table"><div class="table-row header"><span>Name / Domain</span><span>Value / Attributes</span><span>Actions</span></div>${cookies.map((cookie, index) => `<div class="table-row"><div><b class="code">${escapeHtml(cookie.name)}</b><small style="display:block;color:var(--muted-2);margin-top:3px">${escapeHtml(cookie.domain)}</small></div><div style="min-width:0"><div class="code" style="overflow:hidden;text-overflow:ellipsis">${escapeHtml(cookie.value)}</div><div class="row wrap" style="margin-top:4px">${cookie.secure ? '<span class="tag success">Secure</span>' : ""}${cookie.httpOnly ? '<span class="tag">HttpOnly</span>' : ""}<span class="tag">${cookie.sameSite || "unspecified"}</span></div></div><div class="table-actions"><button class="icon-btn" data-copy="${escapeHtml(cookie.value)}">${icon("copy")}</button><button class="icon-btn" data-duplicate-cookie="${index}">${icon("plus")}</button><button class="icon-btn" data-edit-cookie="${index}">${icon("settings")}</button><button class="icon-btn" data-delete-cookie="${index}">${icon("trash")}</button></div></div>`).join("") || empty("No cookies found", "This page has no visible cookies.", "cookies")}</div></div></div>`;
};

const headersView = state => {
  const presets = state.headerPresets || [];
  return `<div class="page">${pageHead("HTTP Headers", "Compose common headers and keep reusable presets.", action("header-save", "Save preset", "plus", true))}
    <div class="grid two"><div class="card stack"><label class="field"><span>Authorization</span><select id="headerAuth"><option>None</option><option>Bearer</option><option>Basic</option></select></label><label class="field"><span>Token / Credentials</span><input id="headerToken" placeholder="Token or username:password"></label><label class="field"><span>Content-Type</span><select id="headerContent"><option>application/json</option><option>multipart/form-data</option><option>application/x-www-form-urlencoded</option><option>text/plain</option></select></label><label class="field"><span>Accept</span><input id="headerAccept" value="application/json"></label><label class="field"><span>Cache-Control</span><select id="headerCache"><option>no-cache</option><option>no-store</option><option>max-age=3600</option><option>public</option></select></label><label class="field"><span>Custom headers (JSON)</span><textarea id="headerCustom" class="code-input" placeholder='{"X-Client": "DevKit"}' style="min-height:65px"></textarea></label><button class="btn primary" data-action="header-generate">${icon("zap")} Generate headers</button></div>
    <div class="card"><div class="card-header"><h2>Generated output</h2></div>${output("headerOutput", state.headerOutput || "{")}</div></div>
    <div class="card" style="margin-top:10px"><div class="card-header"><h2>Saved presets</h2><span class="tag">${presets.length}</span></div>${presets.length ? `<div class="snippet-list">${presets.map((preset, index) => `<div class="list-card row between"><div><b>${escapeHtml(preset.name)}</b><p>${Object.keys(preset.value).join(", ")}</p></div><div class="table-actions"><button class="icon-btn" data-copy="${escapeHtml(JSON.stringify(preset.value, null, 2))}">${icon("copy")}</button><button class="icon-btn" data-delete-preset="${index}">${icon("trash")}</button></div></div>`).join("")}</div>` : empty("No header presets", "Generate headers and save them for later.", "headers")}</div></div>`;
};

const requestView = state => `<div class="page">${pageHead("Request Builder", "Build, send, and export API requests.")}
  <div class="card stack"><div class="row"><select id="requestMethod" style="width:90px"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select><input id="requestUrl" class="code" placeholder="https://api.example.com/v1/users"><button class="btn primary" data-action="request-send">${icon("play")} Send</button></div>
  <div class="row"><select id="requestAuth" style="width:110px"><option>None</option><option>Bearer</option><option>Basic</option></select><input id="requestAuthValue" class="code" placeholder="Authorization token or credentials"></div>
  <div class="grid two"><label class="field"><span>Headers (JSON)</span>${textArea("requestHeaders", '{\n  "Accept": "application/json"\n}', "", 105)}</label><label class="field"><span>Query parameters</span>${textArea("requestQuery", "page=1&limit=20", "", 105)}</label></div><label class="field"><span>Request body</span>${textArea("requestBody", '{\n  "name": "DevKit"\n}', "", 110)}</label></div>
  <div class="card" style="margin-top:10px"><div class="card-header"><h2>Response</h2>${state.requestResult ? `<span class="tag ${state.requestResult.ok ? "success" : "danger"}">${state.requestResult.status} · ${state.requestResult.duration} ms</span>` : ""}</div>${state.requestResult ? output("requestResult", state.requestResult.body || state.requestResult.error || "") : empty("Ready to send", "Enter a URL and send your request.", "request")}</div>
  <div class="card" style="margin-top:10px"><div class="card-header"><h2>Generate code</h2>${tabButtons(["Fetch", "Axios", "cURL"], state.codeType || "fetch")}</div>${output("requestCode", state.requestCode || "Configure a request to generate code.")}</div></div>`;

const jsonView = state => `<div class="page">${pageHead("JSON Tools", "Format, validate, minify, search, and export JSON.", `${action("json-download", "Download", "download")}`)}
  <div class="card"><div class="card-header">${tabButtons(["Pretty Print", "Minify", "Validate", "Tree View"], state.jsonMode || "pretty-print")}<input id="jsonSearch" style="width:150px" placeholder="Search JSON…"></div>${textArea("jsonInput", "Paste JSON here…", state.jsonInput || "", 250)}<div class="row" style="margin-top:9px"><button class="btn primary" data-action="json-run">${icon("zap")} Transform</button><button class="btn" data-action="json-copy">${icon("copy")} Copy</button><span id="jsonStatus" class="tag ${state.jsonValid === false ? "danger" : state.jsonValid ? "success" : ""}">${state.jsonMessage || "Waiting for input"}</span></div></div>
  ${state.jsonOutput ? `<div class="card" style="margin-top:10px"><div class="card-header"><h2>Output</h2></div>${output("jsonOutput", state.jsonOutput)}</div>` : ""}</div>`;

const jwtView = state => `<div class="page">${pageHead("JWT Decoder", "Decode token metadata locally. Tokens never leave your browser.")}
  <div class="card stack"><label class="field"><span>JSON Web Token</span>${textArea("jwtInput", "eyJhbGciOi...", state.jwtInput || "", 100)}</label><button class="btn primary" data-action="jwt-decode">${icon("zap")} Decode token</button></div>
  ${state.jwtError ? `<div class="card" style="margin-top:10px"><span class="tag danger">${escapeHtml(state.jwtError)}</span></div>` : ""}
  ${state.jwt ? `<div class="grid two" style="margin-top:10px"><div class="card"><div class="card-header"><h2>Header</h2><button class="icon-btn" data-copy="${escapeHtml(JSON.stringify(state.jwt.header, null, 2))}">${icon("copy")}</button></div><div class="code-block">${escapeHtml(JSON.stringify(state.jwt.header, null, 2))}</div></div><div class="card"><div class="card-header"><h2>Payload</h2><button class="icon-btn" data-copy="${escapeHtml(JSON.stringify(state.jwt.payload, null, 2))}">${icon("copy")}</button></div><div class="code-block">${escapeHtml(JSON.stringify(state.jwt.payload, null, 2))}</div></div></div><div class="card" style="margin-top:10px"><div class="row wrap"><span class="tag ${state.jwt.expired ? "danger" : "success"}">${state.jwt.expired ? "Expired" : "Active"}</span>${state.jwt.payload.iat ? `<span class="tag">Issued ${new Date(state.jwt.payload.iat * 1000).toLocaleString()}</span>` : ""}${state.jwt.payload.exp ? `<span class="tag">Expires ${new Date(state.jwt.payload.exp * 1000).toLocaleString()}</span>` : ""}</div></div>` : ""}</div>`;

const regexView = state => `<div class="page">${pageHead("Regex Tester", "Test expressions live with highlighted matches.", action("regex-save", "Save expression", "star"))}
  <div class="card stack"><div class="row"><span class="code" style="color:var(--muted)">/</span><input id="regexPattern" class="code" value="${escapeHtml(state.regexPattern || "")}" placeholder="([a-z]+)@([a-z]+)\\.com"><span class="code" style="color:var(--muted)">/</span><input id="regexFlags" class="code" style="width:65px" value="${escapeHtml(state.regexFlags || "gi")}" placeholder="gim"></div><label class="field"><span>Test text</span>${textArea("regexText", "Type or paste text to test…", state.regexText || "", 170)}</label><div class="row"><span class="tag ${state.regexError ? "danger" : "success"}">${state.regexError || `${state.regexMatches || 0} matches`}</span></div></div>
  <div class="card" style="margin-top:10px"><div class="card-header"><h2>Live matches</h2></div><div id="regexOutput" class="code-block">${state.regexOutput || "Matches will appear here."}</div></div></div>`;

const urlView = state => `<div class="page">${pageHead("URL Tools", "Encode, decode, parse, and edit query parameters.")}
  <div class="card stack"><label class="field"><span>URL or text</span>${textArea("urlInput", "https://example.com/path?query=devkit", state.urlInput || state.context?.url || "", 110)}</label><div class="row wrap"><button class="btn" data-action="url-encode">Encode</button><button class="btn" data-action="url-decode">Decode</button><button class="btn primary" data-action="url-parse">${icon("url")} Parse URL</button></div></div>
  ${state.urlOutput ? `<div class="grid two" style="margin-top:10px"><div class="card"><div class="card-header"><h2>Result</h2></div>${output("urlOutput", state.urlOutput)}</div><div class="card"><div class="card-header"><h2>Query parameters</h2></div>${state.urlParams?.length ? `<div class="data-table">${state.urlParams.map(([key, value]) => `<div class="table-row"><span class="code">${escapeHtml(key)}</span><span class="code">${escapeHtml(value)}</span><button class="icon-btn" data-copy="${escapeHtml(value)}">${icon("copy")}</button></div>`).join("")}</div>` : empty("No query parameters", "This URL has no query string.", "url")}</div></div>` : ""}</div>`;

const hexToRgb = hex => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map(character => character + character).join("") : value;
  const number = parseInt(full, 16);
  return [number >> 16, number >> 8 & 255, number & 255];
};

const rgbToHsl = ([red, green, blue]) => {
  const [r, g, b] = [red, green, blue].map(value => value / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), light = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(light * 100)];
  const delta = max - min;
  const saturation = light > .5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [Math.round(hue * 60), Math.round(saturation * 100), Math.round(light * 100)];
};

const colorView = state => {
  const color = state.color || "#8b5cf6";
  const rgb = hexToRgb(color), hsl = rgbToHsl(rgb), opacity = state.opacity ?? 100;
  const gradientEnd = state.gradientEnd || "#22d3ee";
  return `<div class="page">${pageHead("Color Tools", "Explore, convert, and compose production-ready colors.")}
    <div class="grid two"><div class="card stack"><div class="color-preview" id="colorPreview" style="background:${color}"></div><label class="field"><span>Color picker</span><input id="colorPicker" type="color" value="${color}" style="padding:4px"></label><label class="field"><span>Opacity · ${opacity}%</span><input id="colorOpacity" class="range" type="range" min="0" max="100" value="${opacity}"></label></div><div class="card stack"><label class="field"><span>HEX</span><div class="row"><input id="colorHex" class="code" value="${color}"><button class="icon-btn" data-copy="${color}">${icon("copy")}</button></div></label><label class="field"><span>RGB</span><input class="code" readonly value="rgb(${rgb.join(", ")})"></label><label class="field"><span>HSL</span><input class="code" readonly value="hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)"></label><label class="field"><span>CSS with opacity</span><input class="code" readonly value="rgba(${rgb.join(", ")}, ${(opacity / 100).toFixed(2)})"></label></div></div>
    <div class="card" style="margin-top:10px"><div class="card-header"><h2>Gradient generator</h2></div><div class="grid two"><label class="field"><span>Start</span><input id="gradientStart" type="color" value="${color}"></label><label class="field"><span>End</span><input id="gradientEnd" type="color" value="${gradientEnd}"></label></div><div class="color-preview" style="height:70px;margin-top:10px;background:linear-gradient(135deg,${color},${gradientEnd})"></div><div class="code-block" id="gradientCss" style="min-height:auto;margin-top:10px">background: linear-gradient(135deg, ${color}, ${gradientEnd});</div></div></div>`;
};

const base64View = state => `<div class="page">${pageHead("Base64", "Encode and decode text, files, and images locally.")}
  <div class="card"><div class="card-header">${tabButtons(["Encode", "Decode", "File"], state.base64Mode || "encode")}</div>${state.base64Mode === "file" ? `<div class="empty"><div><div class="empty-icon">${icon("upload")}</div><b>Choose a file</b><p>Files are processed locally and never uploaded.</p><button class="btn primary" data-action="base64-file" style="margin-top:12px">Select file</button></div></div>` : `<label class="field"><span>Input</span>${textArea("base64Input", state.base64Mode === "decode" ? "Paste Base64…" : "Type text to encode…", state.base64Input || "", 160)}</label><button class="btn primary" data-action="base64-run" style="margin-top:9px">${icon("zap")} ${state.base64Mode === "decode" ? "Decode" : "Encode"}</button>`}</div>
  ${state.base64Output ? `<div class="card" style="margin-top:10px"><div class="card-header"><h2>Output</h2></div>${output("base64Output", state.base64Output)}</div>` : ""}</div>`;

const hashView = state => `<div class="page">${pageHead("Hash Generator", "Generate deterministic cryptographic hashes in your browser.")}
  <div class="card stack"><label class="field"><span>Input</span>${textArea("hashInput", "Enter text to hash…", state.hashInput || "", 130)}</label><div class="row wrap">${["MD5", "SHA-1", "SHA-256", "SHA-512"].map(value => `<button class="btn ${state.hashType === value ? "primary" : ""}" data-hash="${value}">${value}</button>`).join("")}</div></div>
  ${state.hashOutput ? `<div class="card" style="margin-top:10px"><div class="card-header"><h2>${state.hashType}</h2></div>${output("hashOutput", state.hashOutput)}</div>` : ""}</div>`;

const timestampView = state => {
  const date = state.timestampDate ? new Date(state.timestampDate) : new Date();
  return `<div class="page">${pageHead("Timestamp Converter", "Convert Unix timestamps and human-readable dates in both directions.")}
    <div class="grid two"><div class="card stack"><label class="field"><span>Unix timestamp</span><input id="unixInput" class="code" value="${Math.floor(date.getTime() / 1000)}"></label><button class="btn primary" data-action="timestamp-unix">Convert from Unix</button></div><div class="card stack"><label class="field"><span>Date and time</span><input id="dateInput" type="datetime-local" value="${new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"></label><button class="btn primary" data-action="timestamp-date">Convert from date</button></div></div>
    <div class="card" style="margin-top:10px"><div class="data-table"><div class="table-row"><span>ISO</span><span class="code">${date.toISOString()}</span><button class="icon-btn" data-copy="${date.toISOString()}">${icon("copy")}</button></div><div class="table-row"><span>Local</span><span>${escapeHtml(date.toLocaleString())}</span><button class="icon-btn" data-copy="${escapeHtml(date.toLocaleString())}">${icon("copy")}</button></div><div class="table-row"><span>Relative</span><span>${date > new Date() ? "In the future" : "In the past"}</span><span class="tag">${Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div></div></div></div>`;
};

const uuidView = state => `<div class="page">${pageHead("UUID Generator", "Generate secure RFC 4122 version 4 identifiers.")}
  <div class="card stack"><div class="row"><label class="field" style="width:110px"><span>Quantity</span><input id="uuidCount" type="number" min="1" max="100" value="${state.uuidCount || 5}"></label><button class="btn primary" data-action="uuid-generate" style="margin-top:15px">${icon("refresh")} Generate</button><button class="btn" data-action="uuid-copy-all" style="margin-top:15px">${icon("copy")} Copy all</button></div><div class="data-table">${(state.uuids || [uuid(), uuid(), uuid(), uuid(), uuid()]).map(value => `<div class="table-row"><span class="tag">v4</span><span class="code">${value}</span><button class="icon-btn" data-copy="${value}">${icon("copy")}</button></div>`).join("")}</div></div></div>`;

const qrView = state => `<div class="page">${pageHead("QR Generator", "Turn text and URLs into a downloadable QR code.", action("qr-download", "Download PNG", "download"))}
  <div class="grid two"><div class="card stack"><label class="field"><span>Text or URL</span>${textArea("qrInput", "https://example.com", state.qrInput || "https://example.com", 130)}</label><button class="btn primary" data-action="qr-generate">${icon("qr")} Generate QR</button></div><div class="card qr-wrap"><canvas id="qrCanvas" width="220" height="220" aria-label="Generated QR code"></canvas></div></div></div>`;

const environmentView = state => {
  const variables = state.variables || [];
  const filtered = variables.filter(variable => `${variable.key} ${variable.value}`.toLowerCase().includes((state.filter || "").toLowerCase()));
  return `<div class="page">${pageHead("Environment Variables", "Store reusable values and substitute {{VARIABLES}} across DevKit.", `${action("env-import", "Import", "upload")}${action("env-export", "Export", "download")}${action("env-add", "Add variable", "plus", true)}`)}
    <div class="card"><div class="card-header"><span class="tag">${variables.length} variables</span><input data-filter style="width:170px" placeholder="Search variables…" value="${escapeHtml(state.filter || "")}"></div><div class="data-table"><div class="table-row header"><span>Name</span><span>Value</span><span>Actions</span></div>${filtered.map((variable, index) => `<div class="table-row"><span class="code">${escapeHtml(variable.key)}</span><span class="code" style="overflow:hidden;text-overflow:ellipsis">${variable.secret ? "••••••••••••" : escapeHtml(variable.value)}</span><div class="table-actions"><button class="icon-btn" data-copy="${escapeHtml(variable.value)}">${icon("copy")}</button><button class="icon-btn" data-delete-env="${index}">${icon("trash")}</button></div></div>`).join("") || empty("No variables yet", "Store API_URL, TOKEN, CLIENT_ID, and more.", "environment")}</div></div></div>`;
};

const snippetsView = state => {
  const snippets = (state.snippets || []).filter(snippet => `${snippet.title} ${snippet.code} ${snippet.language}`.toLowerCase().includes((state.filter || "").toLowerCase()));
  return `<div class="page">${pageHead("Snippets", "Keep reusable code organized, searchable, and close at hand.", action("snippet-add", "New snippet", "plus", true))}
    <div class="card"><div class="card-header"><div class="row"><span class="tag">${snippets.length} snippets</span><button class="btn ghost" data-action="snippet-favorites">${icon("star")} Favorites</button></div><input data-filter style="width:170px" placeholder="Search snippets…" value="${escapeHtml(state.filter || "")}"></div>${snippets.length ? `<div class="snippet-list">${snippets.map((snippet, index) => `<div class="list-card"><div class="row between"><div class="row"><span class="tag">${escapeHtml(snippet.language)}</span><b>${escapeHtml(snippet.title)}</b></div><div class="table-actions"><button class="icon-btn" data-copy="${escapeHtml(snippet.code)}">${icon("copy")}</button><button class="icon-btn" data-favorite-snippet="${index}" style="color:${snippet.favorite ? "var(--warning)" : ""}">${icon("star")}</button><button class="icon-btn" data-delete-snippet="${index}">${icon("trash")}</button></div></div><p class="code">${escapeHtml(snippet.code)}</p></div>`).join("")}</div>` : empty("Your snippet library is empty", "Save code you reach for every day.", "snippets")}</div></div>`;
};

const notesView = state => {
  const notes = (state.notes || []).filter(note => `${note.title} ${note.body} ${(note.tags || []).join(" ")}`.toLowerCase().includes((state.filter || "").toLowerCase()));
  const active = notes.find(note => note.id === state.activeNote) || notes[0];
  return `<div class="page">${pageHead("Notes", "Fast markdown notes with autosave, tags, and pinning.", action("note-add", "New note", "plus", true))}
    <div class="grid two" style="grid-template-columns:minmax(130px,.65fr) minmax(180px,1.35fr)"><div class="card"><div class="card-header"><input data-filter placeholder="Search notes…" value="${escapeHtml(state.filter || "")}"></div><div class="note-list">${notes.map(note => `<div class="list-card" data-note="${note.id}" style="border-color:${active?.id === note.id ? "rgba(var(--accent-rgb),.5)" : ""}"><div class="row between"><b>${note.pinned ? "★ " : ""}${escapeHtml(note.title)}</b><small style="color:var(--muted-2)">${new Date(note.updated).toLocaleDateString()}</small></div><p>${escapeHtml(note.body)}</p></div>`).join("") || empty("No notes", "Capture a thought before it disappears.", "notes")}</div></div><div class="card">${active ? `<div class="row between" style="margin-bottom:8px"><input id="noteTitle" value="${escapeHtml(active.title)}" style="font-weight:650"><button class="icon-btn" data-action="note-pin" style="color:${active.pinned ? "var(--warning)" : ""}">${icon("star")}</button><button class="icon-btn" data-action="note-delete">${icon("trash")}</button></div><textarea id="noteBody" placeholder="Write in markdown…" style="min-height:260px">${escapeHtml(active.body)}</textarea><input id="noteTags" value="${escapeHtml((active.tags || []).join(", "))}" placeholder="Tags, comma separated" style="margin-top:8px"><div class="row between" style="margin-top:7px"><small style="color:var(--muted-2)">Autosaved locally</small><span class="tag">Markdown</span></div>` : empty("Select a note", "Choose or create a note to start writing.", "notes")}</div></div></div>`;
};

const networkView = state => {
  const requests = (state.network || []).filter(request => `${request.method} ${request.url} ${request.status}`.toLowerCase().includes((state.filter || "").toLowerCase()) && (!state.networkType || state.networkType === "all" || request.type === state.networkType));
  return `<div class="page">${pageHead("Network Monitor", "Watch Fetch and XHR activity from the current page.", action("network-clear", "Clear", "trash"))}
    <div class="card"><div class="card-header">${tabButtons(["All", "Fetch", "XHR"], state.networkType || "all")}<div class="row"><span class="status-dot"></span><span style="color:var(--muted);font-size:9px">Recording</span><input data-filter style="width:150px" placeholder="Filter requests…" value="${escapeHtml(state.filter || "")}"></div></div>
    <div class="data-table"><div class="table-row header network-row"><span>Status</span><span>Method</span><span>URL</span><span>Time</span><span>Size</span></div>${requests.map(request => `<div class="table-row network-row"><span class="status-code ${request.status >= 200 && request.status < 400 ? "ok" : "bad"}">${request.status || "ERR"}</span><span class="tag">${escapeHtml(request.method)}</span><span class="code" title="${escapeHtml(request.url)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(request.url)}</span><span>${request.duration} ms</span><span>${formatBytes(request.size)}</span></div>`).join("") || empty("Listening for requests", "Fetch and XHR traffic will appear here in real time.", "network")}</div></div></div>`;
};

const settingsView = state => `<div class="page">${pageHead("Settings", "Make DevKit feel at home in your workflow.")}
  <div class="card stack"><div class="row between"><div><h2>Appearance</h2><p class="page-subtitle">Choose the interface theme.</p></div>${tabButtons(["Dark", "Light", "System"], state.theme || "dark")}</div><div class="divider"></div><div><h2 style="margin-bottom:9px">Accent color</h2><div class="row wrap">${[["Violet","#8b5cf6","139, 92, 246"],["Blue","#3b82f6","59, 130, 246"],["Cyan","#06b6d4","6, 182, 212"],["Emerald","#10b981","16, 185, 129"],["Rose","#f43f5e","244, 63, 94"]].map(([name, value, rgb]) => `<button class="btn" data-accent="${value}" data-rgb="${rgb}" style="border-color:${state.accent === value ? value : ""}"><span style="width:8px;height:8px;border-radius:50%;background:${value}"></span>${name}</button>`).join("")}</div></div></div>
  <div class="card" style="margin-top:10px"><div class="card-header"><div><h2>Keyboard shortcuts</h2><p class="page-subtitle">Keyboard-first by default.</p></div></div><div class="data-table"><div class="table-row"><span>Command palette</span><span>Search tools and actions</span><kbd>⌘ K</kbd></div><div class="table-row"><span>Toggle DevKit</span><span>Open from any webpage</span><kbd>⌘ ⇧ K</kbd></div><div class="table-row"><span>Close dialog</span><span>Dismiss current surface</span><kbd>Esc</kbd></div></div></div>
  <div class="card" style="margin-top:10px"><div class="card-header"><div><h2>Data & privacy</h2><p class="page-subtitle">All workspace data stays in chrome.storage.local.</p></div></div><div class="row wrap"><button class="btn" data-action="settings-export">${icon("download")} Export settings</button><button class="btn" data-action="settings-import">${icon("upload")} Import settings</button><button class="btn danger" data-action="settings-reset">${icon("trash")} Reset DevKit</button></div></div></div>`;

export const renderTool = (page, state) => ({
  dashboard, storage: storageView, cookies: cookiesView, headers: headersView,
  request: requestView, json: jsonView, jwt: jwtView, regex: regexView,
  url: urlView, color: colorView, base64: base64View, hash: hashView,
  timestamp: timestampView, uuid: uuidView, qr: qrView, environment: environmentView,
  snippets: snippetsView, notes: notesView, network: networkView, settings: settingsView
}[page] || dashboard)(state);
