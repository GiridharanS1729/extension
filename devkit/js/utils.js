import { icon } from "./icons.js";

export const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
export const formatBytes = bytes => {
  if (!Number(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export const store = {
  async get(key, fallback) {
    try {
      const value = (await chrome.storage.local.get(key))[key];
      return value === undefined ? fallback : value;
    } catch {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    }
  },
  async set(key, value) {
    try { await chrome.storage.local.set({ [key]: value }); }
    catch { localStorage.setItem(key, JSON.stringify(value)); }
  },
  async all() {
    try { return await chrome.storage.local.get(null); }
    catch { return { ...localStorage }; }
  },
  async clear() {
    try { await chrome.storage.local.clear(); }
    catch { localStorage.clear(); }
  }
};

export const copy = async (value, label = "Copied to clipboard") => {
  await navigator.clipboard.writeText(String(value));
  window.dispatchEvent(new CustomEvent("devkit:toast", { detail: label }));
};

export const download = (name, content, type = "application/json") => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

export const pageHead = (title, subtitle, actions = "") => `
  <div class="page-head">
    <div><p class="eyebrow">Developer utility</p><h1>${escapeHtml(title)}</h1><p class="page-subtitle">${escapeHtml(subtitle)}</p></div>
    ${actions ? `<div class="row">${actions}</div>` : ""}
  </div>`;

export const empty = (title, description, iconName = "info") => `
  <div class="empty"><div><div class="empty-icon">${icon(iconName)}</div><b>${escapeHtml(title)}</b><p>${escapeHtml(description)}</p></div></div>`;

export const copyButton = (target, label = "Copy") => `<button class="btn" data-copy-target="${target}">${icon("copy")} ${label}</button>`;

let requestIndex = 0;
const pending = new Map();
window.addEventListener("message", event => {
  if (event.data?.type !== "DEVKIT_RESPONSE") return;
  pending.get(event.data.requestId)?.(event.data.payload);
  pending.delete(event.data.requestId);
});

export const bridge = (type, payload = {}) => new Promise(resolve => {
  const requestId = `request-${++requestIndex}`;
  pending.set(requestId, resolve);
  parent.postMessage({ type, payload, requestId }, "*");
  setTimeout(() => {
    if (!pending.has(requestId)) return;
    pending.delete(requestId);
    resolve(null);
  }, 15000);
});

export const debounce = (fn, delay = 180) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const uuid = () => crypto.randomUUID();

export const dialog = ({ title, description = "", fields = [], confirm = "Save", danger = false }) => new Promise(resolve => {
  const backdrop = document.querySelector("#dialogBackdrop");
  backdrop.innerHTML = `<form class="dialog">
    <h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}
    <div class="stack">${fields.map(field => `<label class="field"><span>${escapeHtml(field.label)}</span>${field.type === "textarea" ? `<textarea name="${field.name}" placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(field.value || "")}</textarea>` : `<input name="${field.name}" type="${field.type || "text"}" value="${escapeHtml(field.value || "")}" placeholder="${escapeHtml(field.placeholder || "")}" ${field.required ? "required" : ""}>`}</label>`).join("")}</div>
    <div class="dialog-actions"><button type="button" class="btn" data-cancel>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" type="submit">${escapeHtml(confirm)}</button></div>
  </form>`;
  backdrop.hidden = false;
  const close = result => { backdrop.hidden = true; backdrop.innerHTML = ""; resolve(result); };
  backdrop.querySelector("[data-cancel]").onclick = () => close(null);
  backdrop.onclick = event => { if (event.target === backdrop) close(null); };
  const form = backdrop.querySelector("form");
  form.onsubmit = event => {
    event.preventDefault();
    close(Object.fromEntries(new FormData(form)));
  };
  form.querySelector("input,textarea")?.focus();
});
