// Reads Chrome's own most-visited list via chrome.topSites.get(). This is
// the same data the native New Tab page shows without any extension
// installed — used here to seed the shortcuts grid so it starts out
// identical to what the user would see without this extension.

import { isChromeExtension } from "./storage.js";

// Only used outside the packaged extension (e.g. opening newtab.html
// directly in a normal browser tab during development), since
// chrome.topSites does not exist there. The production build always uses
// the real chrome.topSites.get() result.
const DEV_FALLBACK_SITES = [
  { title: "Google", url: "https://www.google.com" },
  { title: "YouTube", url: "https://www.youtube.com" },
  { title: "GitHub", url: "https://github.com" },
  { title: "Wikipedia", url: "https://www.wikipedia.org" },
];

export function fetchTopSites() {
  if (!isChromeExtension() || !chrome.topSites) {
    return Promise.resolve(DEV_FALLBACK_SITES);
  }
  return new Promise((resolve, reject) => {
    try {
      chrome.topSites.get((sites) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(sites || []);
      });
    } catch (err) {
      reject(err);
    }
  });
}
