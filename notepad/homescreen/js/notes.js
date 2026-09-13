// Notes card: a free-form Markdown-capable scratchpad, autosaved (debounced)
// to chrome.storage.local, with an Edit/Preview toggle.

import { getNotes, saveNotes } from "./storage.js";
import { renderMarkdown } from "./markdown.js";

const SAVE_DEBOUNCE_MS = 400;

export async function initNotes({ sectionEl, textarea, preview, toggleBtn }) {
  let saveTimer = null;
  let previewing = false;

  textarea.value = await getNotes();

  function scheduleSave() {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveNotes(textarea.value);
      saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
  }

  function showEdit() {
    previewing = false;
    preview.hidden = true;
    textarea.hidden = false;
    toggleBtn.textContent = "Preview";
    toggleBtn.setAttribute("aria-pressed", "false");
    textarea.focus();
  }

  function showPreview() {
    previewing = true;
    preview.innerHTML = renderMarkdown(textarea.value);
    textarea.hidden = true;
    preview.hidden = false;
    toggleBtn.textContent = "Edit";
    toggleBtn.setAttribute("aria-pressed", "true");
  }

  textarea.addEventListener("input", scheduleSave);
  toggleBtn.addEventListener("click", () => (previewing ? showEdit() : showPreview()));

  return {
    setVisible(visible) {
      sectionEl.hidden = !visible;
    },
  };
}
