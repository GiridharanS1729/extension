// Entry point: wires DOM references to the feature modules and restores
// persisted state as soon as the New Tab page opens.

import { getSettings } from "./storage.js";
import { startClock, updateClockSettings } from "./clock.js";
import { initShortcuts } from "./shortcuts.js";
import { initNotes } from "./notes.js";
import { initSettings } from "./settings.js";

async function main() {
  const settings = await getSettings();

  // Clock
  startClock(settings);

  // Shortcuts: seeded on first run from chrome.topSites (see shortcuts.js),
  // then fully user-manageable (add / edit / delete).
  const shortcuts = await initShortcuts({
    gridEl: document.getElementById("shortcuts-grid"),
    emptyEl: document.getElementById("shortcuts-empty"),
    sectionEl: document.getElementById("shortcuts-section"),
    addBtn: document.getElementById("btn-add-shortcut"),
    dialogOverlay: document.getElementById("shortcut-dialog-overlay"),
    dialog: document.getElementById("shortcut-dialog"),
    form: document.getElementById("shortcut-form"),
    titleEl: document.getElementById("shortcut-dialog-title"),
    nameInput: document.getElementById("shortcut-name-input"),
    urlInput: document.getElementById("shortcut-url-input"),
    urlError: document.getElementById("shortcut-url-error"),
    deleteBtn: document.getElementById("btn-delete-shortcut"),
    cancelBtn: document.getElementById("btn-cancel-shortcut"),
    shortcutLimit: settings.shortcutLimit,
  });
  shortcuts.setVisible(settings.showShortcuts);

  // Notes: Markdown-capable scratchpad, autosaved to chrome.storage.local.
  const notes = await initNotes({
    sectionEl: document.getElementById("notes-section"),
    textarea: document.getElementById("notes-textarea"),
    preview: document.getElementById("notes-preview"),
    toggleBtn: document.getElementById("btn-notes-toggle"),
  });
  notes.setVisible(settings.showNotes);

  // Settings drawer (clock format, background/profile images, sliders, shortcut count)
  await initSettings({
    settings,
    els: {
      openBtn: document.getElementById("btn-settings"),
      closeBtn: document.getElementById("btn-close-settings"),
      overlay: document.getElementById("settings-overlay"),
      drawer: document.getElementById("settings-drawer"),
      timeFormatButtons: Array.from(document.querySelectorAll("#setting-time-format .segmented-btn")),
      showSeconds: document.getElementById("setting-show-seconds"),
      brightness: document.getElementById("setting-brightness"),
      overlay2: document.getElementById("setting-overlay"),
      blur: document.getElementById("setting-blur"),
      shortcutLimit: document.getElementById("setting-shortcut-limit"),
      shortcutsToggle: document.getElementById("setting-shortcuts-visible"),
      resetShortcutsBtn: document.getElementById("btn-reset-shortcuts"),
      notesToggle: document.getElementById("setting-notes-visible"),
      meetingUrlInput: document.getElementById("setting-meeting-url"),
      resetMeetingUrlBtn: document.getElementById("btn-reset-meeting-url"),
      joinMeetingBtn: document.getElementById("btn-join-meeting"),
      copyMeetingBtn: document.getElementById("btn-copy-meeting"),
      resetAllBtn: document.getElementById("btn-reset-all"),
      changeBackgroundBtn: document.getElementById("btn-change-background"),
      resetBackgroundBtn: document.getElementById("btn-reset-background"),
      changeProfileBtn: document.getElementById("btn-change-profile"),
      resetProfileBtn: document.getElementById("btn-reset-profile"),
      profilePhotoToggle: document.getElementById("setting-show-profile-photo"),
      editBackgroundFloatingBtn: document.getElementById("btn-edit-background"),
      editProfileFloatingBtn: document.getElementById("btn-edit-profile"),
      fileBackground: document.getElementById("file-background"),
      fileProfile: document.getElementById("file-profile"),
      bgImage: document.getElementById("bg-image"),
      profileImage: document.getElementById("profile-image"),
      profileAvatarFallback: document.getElementById("profile-avatar-fallback"),
    },
    onSettingsChange: (nextSettings) => {
      updateClockSettings(nextSettings);
      shortcuts.setVisible(nextSettings.showShortcuts);
      notes.setVisible(nextSettings.showNotes);
    },
    onResetShortcuts: (limit) => shortcuts.resetFromTopSites(limit),
  });
}

main();
