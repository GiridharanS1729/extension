// The shortcuts grid: seeded on first run from chrome.topSites (so it
// starts out matching what the user would see on Chrome's own New Tab page
// without this extension), then fully user-manageable — add / edit /
// delete, current-tab navigation, persisted through chrome.storage.local.

import {
  getShortcuts,
  saveShortcuts,
  getShortcutsSeeded,
  setShortcutsSeeded,
} from "./storage.js";
import { fetchTopSites } from "./topSites.js";
import { normalizeAndValidateUrl, getHostname } from "./url.js";
import { mountFavicon } from "./favicon.js";

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `shortcut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getFocusable(container) {
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function sitesToShortcuts(sites, limit) {
  return sites.slice(0, limit).map((site) => ({
    id: createId(),
    title: site.title || getHostname(site.url) || site.url,
    url: site.url,
    createdAt: Date.now(),
  }));
}

function createShortcutCard(shortcut, onEditRequest) {
  const card = document.createElement("div");
  card.className = "shortcut-card";
  card.setAttribute("role", "listitem");

  const open = document.createElement("a");
  open.className = "shortcut-open";
  open.href = shortcut.url;
  open.setAttribute("aria-label", `${shortcut.title} – ${shortcut.url}`);
  open.title = `${shortcut.title}\n${shortcut.url}`;

  const circle = document.createElement("span");
  circle.className = "shortcut-circle";
  mountFavicon(circle, { url: shortcut.url, title: shortcut.title });

  const label = document.createElement("span");
  label.className = "shortcut-title";
  label.textContent = shortcut.title;

  open.appendChild(circle);
  open.appendChild(label);

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "shortcut-edit-btn";
  editBtn.setAttribute("aria-label", `Edit ${shortcut.title} shortcut`);
  editBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onEditRequest(shortcut);
  });

  card.appendChild(open);
  card.appendChild(editBtn);
  return card;
}

export async function initShortcuts(refs) {
  const {
    gridEl,
    emptyEl,
    sectionEl,
    addBtn,
    dialogOverlay,
    dialog,
    form,
    titleEl,
    nameInput,
    urlInput,
    urlError,
    deleteBtn,
    cancelBtn,
    shortcutLimit,
  } = refs;

  let shortcuts = await getShortcuts();
  let editingId = null;
  let lastFocused = null;

  // First run: seed from Chrome's own most-visited list, so the grid starts
  // out identical to what's shown without this extension installed.
  if (shortcuts.length === 0 && !(await getShortcutsSeeded())) {
    try {
      const sites = await fetchTopSites();
      shortcuts = sitesToShortcuts(sites, shortcutLimit);
      await saveShortcuts(shortcuts);
      await setShortcutsSeeded(true);
    } catch {
      // Leave the list empty; getShortcutsSeeded() stays false so the next
      // load tries again instead of permanently giving up.
    }
  }

  function render() {
    gridEl.innerHTML = "";
    if (shortcuts.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    const fragment = document.createDocumentFragment();
    shortcuts.forEach((shortcut) => fragment.appendChild(createShortcutCard(shortcut, openEditDialog)));
    gridEl.appendChild(fragment);
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (e.key === "Tab") {
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function openDialog() {
    lastFocused = document.activeElement;
    dialogOverlay.hidden = false;
    dialog.hidden = false;
    dialog.setAttribute("aria-hidden", "false");
    nameInput.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeDialog() {
    dialogOverlay.hidden = true;
    dialog.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function openAddDialog() {
    editingId = null;
    titleEl.textContent = "Add shortcut";
    nameInput.value = "";
    urlInput.value = "";
    urlError.hidden = true;
    deleteBtn.hidden = true;
    openDialog();
  }

  function openEditDialog(shortcut) {
    editingId = shortcut.id;
    titleEl.textContent = "Edit shortcut";
    nameInput.value = shortcut.title;
    urlInput.value = shortcut.url;
    urlError.hidden = true;
    deleteBtn.hidden = false;
    openDialog();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    let normalized;
    try {
      normalized = normalizeAndValidateUrl(urlInput.value);
    } catch (err) {
      urlError.textContent = err.message;
      urlError.hidden = false;
      urlInput.focus();
      return;
    }
    urlError.hidden = true;

    const title = nameInput.value.trim() || getHostname(normalized);

    if (editingId) {
      shortcuts = shortcuts.map((s) => (s.id === editingId ? { ...s, title, url: normalized } : s));
    } else {
      shortcuts = [...shortcuts, { id: createId(), title, url: normalized, createdAt: Date.now() }];
    }

    await saveShortcuts(shortcuts);
    render();
    closeDialog();
  }

  async function handleDelete() {
    if (!editingId) return;
    shortcuts = shortcuts.filter((s) => s.id !== editingId);
    await saveShortcuts(shortcuts);
    render();
    closeDialog();
  }

  addBtn.addEventListener("click", openAddDialog);
  cancelBtn.addEventListener("click", closeDialog);
  dialogOverlay.addEventListener("click", closeDialog);
  form.addEventListener("submit", handleSubmit);
  deleteBtn.addEventListener("click", handleDelete);

  render();

  return {
    setVisible(visible) {
      sectionEl.hidden = !visible;
    },
    async resetFromTopSites(limit) {
      try {
        const sites = await fetchTopSites();
        shortcuts = sitesToShortcuts(sites, limit);
        await saveShortcuts(shortcuts);
        await setShortcutsSeeded(true);
        render();
        return true;
      } catch {
        return false;
      }
    },
  };
}
