// Favicon loading with a single-attempt fallback to a neutral letter avatar.
// Never retries a failed favicon load.

import { getHostname } from "./url.js";

const FALLBACK_PALETTE = ["#3f7dff", "#8a5cf6", "#22b8b0", "#f2994a", "#ef6a8b", "#5a9c5a"];

function paletteColorFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export function buildFaviconUrl(pageUrl) {
  const hostname = getHostname(pageUrl);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
}

/**
 * Renders a favicon <img> into `circleEl`. On load failure, swaps in a
 * generated single-letter avatar instead (no repeated retries).
 */
export function mountFavicon(circleEl, { url, title }) {
  circleEl.innerHTML = "";

  const img = document.createElement("img");
  img.src = buildFaviconUrl(url);
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";

  img.addEventListener(
    "error",
    () => {
      img.remove();
      const fallback = document.createElement("span");
      fallback.className = "letter-fallback";
      fallback.textContent = (title || getHostname(url) || "?").trim().charAt(0).toUpperCase() || "?";
      fallback.style.background = paletteColorFor(title || url);
      circleEl.appendChild(fallback);
    },
    { once: true }
  );

  circleEl.appendChild(img);
}
