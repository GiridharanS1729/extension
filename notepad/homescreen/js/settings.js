// Settings drawer: clock format, background/profile image swapping (via
// IndexedDB), background appearance sliders, shortcut count and custom
// shortcut visibility. Everything persists through storage.js.

import { saveSettings, resetSettings, setImageFlag, getImageFlags, DEFAULT_SETTINGS } from "./storage.js";
import { saveImage, deleteImage, getImageObjectUrl } from "./imageDb.js";

const DEFAULT_BACKGROUND_SRC = "assets/background.jpg";
const DEFAULT_PROFILE_SRC = "assets/me.png";

let currentBgObjectUrl = null;
let currentProfileObjectUrl = null;

function applyBackgroundVars(settings) {
  const root = document.documentElement.style;
  root.setProperty("--bg-brightness", String(settings.backgroundBrightness / 100));
  root.setProperty("--bg-blur", `${settings.backgroundBlur}px`);

  const d = settings.overlayDarkness / 100;
  root.setProperty("--overlay-strong", (0.15 + d * 0.8).toFixed(2));
  root.setProperty("--overlay-mid", (0.05 + d * 0.5).toFixed(2));
  root.setProperty("--overlay-soft", (d * 0.35).toFixed(2));
}

function getFocusable(container) {
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
  );
}

export async function initSettings({ els, settings, onSettingsChange, onResetShortcuts }) {
  let current = settings;

  // ---- background / profile image loading ----
  async function loadBackgroundImage() {
    const { hasCustomBackground } = await getImageFlags();
    if (hasCustomBackground) {
      const url = await getImageObjectUrl("background");
      if (url) {
        if (currentBgObjectUrl) URL.revokeObjectURL(currentBgObjectUrl);
        currentBgObjectUrl = url;
        els.bgImage.style.display = "";
        els.bgImage.src = url;
        return;
      }
    }
    els.bgImage.style.display = "";
    els.bgImage.src = DEFAULT_BACKGROUND_SRC;
  }

  async function loadProfileImage() {
    if (!current.showProfilePhoto) {
      els.profileImage.hidden = true;
      els.profileAvatarFallback.hidden = false;
      return;
    }
    const { hasCustomProfile } = await getImageFlags();
    if (hasCustomProfile) {
      const url = await getImageObjectUrl("profile");
      if (url) {
        if (currentProfileObjectUrl) URL.revokeObjectURL(currentProfileObjectUrl);
        currentProfileObjectUrl = url;
        els.profileImage.hidden = false;
        els.profileAvatarFallback.hidden = true;
        els.profileImage.src = url;
        return;
      }
    }
    els.profileImage.hidden = false;
    els.profileAvatarFallback.hidden = true;
    els.profileImage.src = DEFAULT_PROFILE_SRC;
  }

  els.bgImage.addEventListener("error", () => {
    els.bgImage.style.display = "none";
  });

  els.profileImage.addEventListener("error", () => {
    els.profileImage.hidden = true;
    els.profileAvatarFallback.hidden = false;
  });

  // ---- drawer open/close ----
  let lastFocused = null;

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
      return;
    }
    if (e.key === "Tab") {
      const focusable = getFocusable(els.drawer);
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

  function openDrawer() {
    lastFocused = document.activeElement;
    els.overlay.hidden = false;
    els.drawer.hidden = false;
    els.drawer.setAttribute("aria-hidden", "false");
    els.closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeDrawer() {
    els.overlay.hidden = true;
    els.drawer.hidden = true;
    els.drawer.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  els.openBtn.addEventListener("click", openDrawer);
  els.closeBtn.addEventListener("click", closeDrawer);
  els.overlay.addEventListener("click", closeDrawer);

  // ---- form controls reflecting current settings ----
  function syncControls() {
    els.timeFormatButtons.forEach((btn) => {
      const active = btn.dataset.value === current.timeFormat;
      btn.setAttribute("aria-checked", String(active));
    });
    els.showSeconds.checked = current.showSeconds;
    els.brightness.value = String(current.backgroundBrightness);
    els.overlay2.value = String(current.overlayDarkness);
    els.blur.value = String(current.backgroundBlur);
    els.shortcutLimit.value = String(current.shortcutLimit);
    els.shortcutsToggle.checked = current.showShortcuts;
    els.notesToggle.checked = current.showNotes;
    els.meetingUrlInput.value = current.meetingUrl;
    els.profilePhotoToggle.checked = current.showProfilePhoto;
  }

  async function update(partial) {
    current = await saveSettings(partial);
    syncControls();
    applyBackgroundVars(current);
    onSettingsChange(current);
  }

  els.timeFormatButtons.forEach((btn) => {
    btn.addEventListener("click", () => update({ timeFormat: btn.dataset.value }));
  });

  els.showSeconds.addEventListener("change", () => update({ showSeconds: els.showSeconds.checked }));
  els.brightness.addEventListener("input", () => update({ backgroundBrightness: Number(els.brightness.value) }));
  els.overlay2.addEventListener("input", () => update({ overlayDarkness: Number(els.overlay2.value) }));
  els.blur.addEventListener("input", () => update({ backgroundBlur: Number(els.blur.value) }));
  els.shortcutLimit.addEventListener("input", () => update({ shortcutLimit: Number(els.shortcutLimit.value) }));
  els.shortcutsToggle.addEventListener("change", () => update({ showShortcuts: els.shortcutsToggle.checked }));
  els.notesToggle.addEventListener("change", () => update({ showNotes: els.notesToggle.checked }));

  els.meetingUrlInput.addEventListener("change", () => {
    const value = els.meetingUrlInput.value.trim() || DEFAULT_SETTINGS.meetingUrl;
    update({ meetingUrl: value });
  });
  els.resetMeetingUrlBtn.addEventListener("click", () => update({ meetingUrl: DEFAULT_SETTINGS.meetingUrl }));

  els.profilePhotoToggle.addEventListener("change", async () => {
    await update({ showProfilePhoto: els.profilePhotoToggle.checked });
    await loadProfileImage();
  });

  els.joinMeetingBtn.addEventListener("click", () => {
    window.location.href = current.meetingUrl;
  });

  const copyIconMarkup = els.copyMeetingBtn.innerHTML;
  const checkIconMarkup =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  let copyResetTimer = null;

  els.copyMeetingBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(current.meetingUrl);
    } catch (err) {
      return;
    }
    if (copyResetTimer !== null) window.clearTimeout(copyResetTimer);
    els.copyMeetingBtn.classList.add("is-copied");
    els.copyMeetingBtn.innerHTML = checkIconMarkup;
    copyResetTimer = window.setTimeout(() => {
      els.copyMeetingBtn.classList.remove("is-copied");
      els.copyMeetingBtn.innerHTML = copyIconMarkup;
      copyResetTimer = null;
    }, 1500);
  });

  els.resetShortcutsBtn.addEventListener("click", async () => {
    els.resetShortcutsBtn.disabled = true;
    const originalLabel = els.resetShortcutsBtn.textContent;
    const ok = await onResetShortcuts(current.shortcutLimit);
    els.resetShortcutsBtn.textContent = ok ? "Done" : "Couldn't load sites";
    window.setTimeout(() => {
      els.resetShortcutsBtn.textContent = originalLabel;
      els.resetShortcutsBtn.disabled = false;
    }, 1500);
  });

  els.resetAllBtn.addEventListener("click", async () => {
    current = await resetSettings();
    syncControls();
    applyBackgroundVars(current);
    onSettingsChange(current);
    await loadProfileImage();
  });

  // ---- image change / reset ----
  function pickFile(input) {
    return new Promise((resolve) => {
      const handler = () => {
        input.removeEventListener("change", handler);
        resolve(input.files && input.files[0] ? input.files[0] : null);
      };
      input.addEventListener("change", handler);
      input.click();
    });
  }

  async function changeBackground() {
    const file = await pickFile(els.fileBackground);
    if (!file) return;
    await saveImage("background", file);
    await setImageFlag("background", true);
    await loadBackgroundImage();
    els.fileBackground.value = "";
  }

  async function resetBackground() {
    await deleteImage("background");
    await setImageFlag("background", false);
    if (currentBgObjectUrl) {
      URL.revokeObjectURL(currentBgObjectUrl);
      currentBgObjectUrl = null;
    }
    await loadBackgroundImage();
  }

  async function changeProfile() {
    const file = await pickFile(els.fileProfile);
    if (!file) return;
    await saveImage("profile", file);
    await setImageFlag("profile", true);
    await loadProfileImage();
    els.fileProfile.value = "";
  }

  async function resetProfile() {
    await deleteImage("profile");
    await setImageFlag("profile", false);
    if (currentProfileObjectUrl) {
      URL.revokeObjectURL(currentProfileObjectUrl);
      currentProfileObjectUrl = null;
    }
    await loadProfileImage();
  }

  els.changeBackgroundBtn.addEventListener("click", changeBackground);
  els.resetBackgroundBtn.addEventListener("click", resetBackground);
  els.editBackgroundFloatingBtn.addEventListener("click", changeBackground);

  els.changeProfileBtn.addEventListener("click", changeProfile);
  els.resetProfileBtn.addEventListener("click", resetProfile);
  els.editProfileFloatingBtn.addEventListener("click", changeProfile);

  // ---- initial state ----
  syncControls();
  applyBackgroundVars(current);
  await loadBackgroundImage();
  await loadProfileImage();
}
