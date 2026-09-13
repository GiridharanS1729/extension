// Thin wrapper around chrome.storage.local so no other module talks to the
// storage API directly. Falls back to localStorage when chrome.storage is not
// available (e.g. previewing newtab.html as a plain file outside Chrome).

const KEYS = {
  settings: "gnt:settings",
  shortcuts: "gnt:shortcuts",
  shortcutsSeeded: "gnt:shortcutsSeeded",
  notes: "gnt:notes",
  hasCustomBackground: "gnt:hasCustomBackground",
  hasCustomProfile: "gnt:hasCustomProfile",
};

export const DEFAULT_SETTINGS = Object.freeze({
  timeFormat: "12", // "12" | "24"
  showSeconds: false,
  shortcutLimit: 10, // 4-10
  showShortcuts: true,
  showNotes: true,
  backgroundBrightness: 100, // 50-150 (%)
  overlayDarkness: 55, // 0-100
  backgroundBlur: 0, // 0-20 (px)
  meetingUrl: "https://meet.google.com/xik-ahfb-rxh",
  showProfilePhoto: true,
});

export function isChromeExtension() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime && chrome.runtime.id);
}

function chromeGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result || {}));
  });
}

function chromeSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

async function storageGet(key) {
  if (isChromeExtension()) {
    const result = await chromeGet(key);
    return result[key];
  }
  const raw = window.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : undefined;
}

async function storageSet(key, value) {
  if (isChromeExtension()) {
    await chromeSet({ [key]: value });
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function getSettings() {
  const stored = await storageGet(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function saveSettings(partialSettings) {
  const current = await getSettings();
  const next = { ...current, ...partialSettings };
  await storageSet(KEYS.settings, next);
  return next;
}

export async function resetSettings() {
  await storageSet(KEYS.settings, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

export async function getShortcuts() {
  const stored = await storageGet(KEYS.shortcuts);
  return Array.isArray(stored) ? stored : [];
}

export async function saveShortcuts(shortcuts) {
  await storageSet(KEYS.shortcuts, shortcuts);
  return shortcuts;
}

export async function getShortcutsSeeded() {
  return Boolean(await storageGet(KEYS.shortcutsSeeded));
}

export async function setShortcutsSeeded(value) {
  await storageSet(KEYS.shortcutsSeeded, value);
}

export async function getNotes() {
  const stored = await storageGet(KEYS.notes);
  return typeof stored === "string" ? stored : "";
}

export async function saveNotes(text) {
  await storageSet(KEYS.notes, text);
}

export async function getImageFlags() {
  const [hasCustomBackground, hasCustomProfile] = await Promise.all([
    storageGet(KEYS.hasCustomBackground),
    storageGet(KEYS.hasCustomProfile),
  ]);
  return {
    hasCustomBackground: Boolean(hasCustomBackground),
    hasCustomProfile: Boolean(hasCustomProfile),
  };
}

export async function setImageFlag(name, value) {
  const key = name === "background" ? KEYS.hasCustomBackground : KEYS.hasCustomProfile;
  await storageSet(key, value);
}
