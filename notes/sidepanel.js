// sidepanel.js
//
// Real-time cross-tab syncing has been removed. What used to happen
// automatically (broadcasting every keystroke through background.js) is now
// an explicit user action:
//
//   - Typing just edits the current in-memory session (autosaved locally as
//     a "draft" so you don't lose it if you close the panel, but nothing is
//     pushed anywhere else).
//   - Clicking the save icon snapshots the current session as a brand-new
//     file in history (chrome.storage.local), it never overwrites an
//     existing file.
//   - Clicking the "i" icon opens the saved-files panel: each row shows a
//     title, a delete button, and is clickable to reopen that file into the
//     editor.

import { renderMarkdown, serializeMarkdown } from "./markdown.js";

const DRAFT_KEY = "draft";
const HISTORY_KEY = "history";
const DRAFT_DEBOUNCE_MS = 300;

const titleEl = document.getElementById("title");
const editorEl = document.getElementById("editor");
const wordcountEl = document.getElementById("wordcount");
const saveHintEl = document.getElementById("saveHint");
const themeBtn = document.getElementById("themeBtn");
const themeIcon = document.getElementById("themeIcon");
const saveBtn = document.getElementById("saveBtn");
const newBtn = document.getElementById("newBtn");
const logoBtn = document.getElementById("logoBtn");
const previewEl = document.getElementById("preview");
const historyBtn = document.getElementById("historyBtn");
const historyOverlay = document.getElementById("historyOverlay");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const closeHistoryBtn = document.getElementById("closeHistory");

let draftTimer = null;
let previewSyncTimer = null;
let previewing = false;
const THEME_KEY = "theme";
const PREVIEW_SYNC_DEBOUNCE_MS = 300;

// ---- markdown preview (toggles the editor and preview pane in place; the
// preview pane is itself editable — see the sync logic below) ----

function showEditMode() {
  previewing = false;
  previewEl.classList.add("hidden");
  editorEl.classList.remove("hidden");
  logoBtn.title = "Toggle Markdown preview";
  logoBtn.setAttribute("aria-label", "Toggle Markdown preview");
  logoBtn.setAttribute("aria-pressed", "false");
}

function showPreviewMode() {
  previewing = true;
  previewEl.innerHTML = renderMarkdown(editorEl.value);
  editorEl.classList.add("hidden");
  previewEl.classList.remove("hidden");
  logoBtn.title = "Back to editing";
  logoBtn.setAttribute("aria-label", "Back to editing");
  logoBtn.setAttribute("aria-pressed", "true");
}

// Toggling explicitly (the logo click) must flush any pending edit made
// directly in the preview pane before switching away from it. Callers that
// replace the document wholesale (opening a history entry, starting a new
// file) call showEditMode() directly instead, since flushing there would
// clobber the just-set content with the stale preview DOM.
function togglePreview() {
  if (previewing) {
    syncPreviewToEditor();
    showEditMode();
  } else {
    showPreviewMode();
  }
}

// Pulls the (possibly hand-edited) rendered preview back into the plain
// Markdown source, without re-rendering it — re-rendering mid-edit would
// reset the cursor position inside the contenteditable pane.
function syncPreviewToEditor() {
  editorEl.value = serializeMarkdown(previewEl);
  updateWordCount();
  saveDraft();
}

function debouncedSyncPreviewToEditor() {
  clearTimeout(previewSyncTimer);
  previewSyncTimer = setTimeout(syncPreviewToEditor, PREVIEW_SYNC_DEBOUNCE_MS);
}

function getDefaultTitle() {
  return new Date().toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeIcon.innerHTML = theme === "dark"
    ? '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/>'
    : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5"/><path d="M12 19.5V22"/><path d="M4.9 4.9l1.8 1.8"/><path d="M17.3 17.3l1.8 1.8"/><path d="M2 12h2.5"/><path d="M19.5 12H22"/><path d="M4.9 19.1l1.8-1.8"/><path d="M17.3 6.7l1.8-1.8"/>';
}

async function loadTheme() {
  const data = await chrome.storage.local.get(THEME_KEY);
  const theme = data[THEME_KEY] || "system";
  applyTheme(theme === "system" ? getSystemTheme() : theme);
}

async function toggleTheme() {
  const current = document.documentElement.dataset.theme || getSystemTheme();
  const next = current === "dark" ? "light" : "dark";
  await chrome.storage.local.set({ [THEME_KEY]: next });
  applyTheme(next);
}

function updateWordCount() {
  const words = editorEl.value.trim().split(/\s+/).filter(Boolean).length;
  wordcountEl.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function flashSaveHint(text) {
  saveHintEl.textContent = text;
  saveHintEl.classList.add("show");
  setTimeout(() => saveHintEl.classList.remove("show"), 1400);
}

// ---- draft persistence (local only, not synced anywhere) ----

async function loadDraft() {
  const data = await chrome.storage.local.get(DRAFT_KEY);
  const draft = data[DRAFT_KEY];
  if (draft) {
    titleEl.value = draft.title?.trim() || getDefaultTitle();
    editorEl.value = draft.content ?? "";
  } else {
    titleEl.value = getDefaultTitle();
  }
  updateWordCount();
}

async function applySelectionText(text) {
  if (!text) return;

  if (!titleEl.value.trim()) {
    titleEl.value = getDefaultTitle();
  }

  const current = editorEl.value.trimEnd();
  editorEl.value = current ? `${current}\n${text}` : text;
  updateWordCount();
  saveDraft();
  showEditMode();
}

function saveDraft() {
  const draft = { title: titleEl.value, content: editorEl.value };
  chrome.storage.local.set({ [DRAFT_KEY]: draft });
}

function debouncedSaveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, DRAFT_DEBOUNCE_MS);
}

// ---- history (saved files) ----

async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return data[HISTORY_KEY] || [];
}

async function setHistory(list) {
  await chrome.storage.local.set({ [HISTORY_KEY]: list });
}

async function saveCurrentSessionToHistory() {
  if (previewing) syncPreviewToEditor();

  const title = titleEl.value.trim() || getDefaultTitle();
  const content = editorEl.value;
  const history = await getHistory();

  // Skip creating a new entry if this exact title+content was already saved,
  // so re-clicking save (or saving right after reopening a file, unedited)
  // doesn't pile up duplicate history rows.
  const alreadySaved = history.some((h) => h.title === title && h.content === content);
  if (alreadySaved) {
    flashSaveHint("Already saved");
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    title,
    content,
    savedAt: Date.now(),
  };
  history.unshift(entry); // newest first
  await setHistory(history);
  flashSaveHint("Saved");
  saveBtn.classList.add("flash");
  setTimeout(() => saveBtn.classList.remove("flash"), 500);
}

async function saveAndStartNewFile() {
  await saveCurrentSessionToHistory();
  titleEl.value = getDefaultTitle();
  editorEl.value = "";
  updateWordCount();
  saveDraft();
  showEditMode();
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

async function renderHistoryList() {
  const history = await getHistory();
  historyList.innerHTML = "";

  if (history.length === 0) {
    historyEmpty.classList.remove("hidden");
    return;
  }
  historyEmpty.classList.add("hidden");

  for (const entry of history) {
    const li = document.createElement("li");
    li.className = "historyRow";
    li.dataset.id = entry.id;

    const info = document.createElement("div");
    info.className = "historyRowInfo";

    const titleDiv = document.createElement("div");
    titleDiv.className = "historyRowTitle";
    titleDiv.textContent = entry.title || "Untitled note";

    const metaDiv = document.createElement("div");
    metaDiv.className = "historyRowMeta";
    metaDiv.textContent = formatTimestamp(entry.savedAt);

    info.appendChild(titleDiv);
    info.appendChild(metaDiv);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "historyDeleteBtn";
    deleteBtn.setAttribute("aria-label", "Delete saved file");
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>`;

    li.appendChild(info);
    li.appendChild(deleteBtn);
    historyList.appendChild(li);

    // Reopen this file into the editor (clicking anywhere except delete).
    li.addEventListener("click", () => openHistoryEntry(entry));

    // Delete just this row, without triggering the open action above.
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const updated = (await getHistory()).filter((h) => h.id !== entry.id);
      await setHistory(updated);
      renderHistoryList();
    });
  }
}

function openHistoryEntry(entry) {
  titleEl.value = entry.title || getDefaultTitle();
  editorEl.value = entry.content;
  updateWordCount();
  saveDraft();
  showEditMode();
  closeHistoryPanel();
}

function openHistoryPanel() {
  historyOverlay.classList.remove("hidden");
  renderHistoryList();
}

function closeHistoryPanel() {
  historyOverlay.classList.add("hidden");
}

// ---- wiring ----

editorEl.addEventListener("input", () => {
  updateWordCount();
  debouncedSaveDraft();
});
titleEl.addEventListener("input", debouncedSaveDraft);
previewEl.addEventListener("input", debouncedSyncPreviewToEditor);

saveBtn.addEventListener("click", saveCurrentSessionToHistory);
newBtn.addEventListener("click", saveAndStartNewFile);
logoBtn.addEventListener("click", togglePreview);
themeBtn.addEventListener("click", toggleTheme);
historyBtn.addEventListener("click", openHistoryPanel);
closeHistoryBtn.addEventListener("click", closeHistoryPanel);

// Click on the dimmed backdrop (not the panel itself) closes it.
historyOverlay.addEventListener("click", (e) => {
  if (e.target === historyOverlay) closeHistoryPanel();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !historyOverlay.classList.contains("hidden")) {
    closeHistoryPanel();
  }
});

loadDraft();
loadTheme();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "selection-text") {
    applySelectionText(message.content);
  }
});
