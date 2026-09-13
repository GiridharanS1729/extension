# Giridharan New Tab

A personalized Chrome New Tab replacement: a full-screen scenic background, a
glassmorphism profile card, a live clock/date, and a shortcuts grid that
starts out seeded from your actual Chrome most-visited sites, then is fully
yours to add to, edit, or delete from.

This is a **plain HTML / CSS / JavaScript** Manifest V3 extension — no
Node.js, no npm, no bundler, no build step. You load the `homescreen` folder
directly into Chrome and it just runs.

## 1. Overview

Every time you open a new tab, the page:
- Restores your saved settings, background/profile image and custom
  shortcuts from local browser storage.
- Reads your real most-visited sites via `chrome.topSites.get()` and renders
  them as a shortcut grid.
- Runs a live, locally-driven clock and date (no network calls, no
  hardcoded values).

Nothing is sent anywhere. There is no backend, no analytics, no remote
script of any kind.

## 2. Features

- Full-screen background image with brightness / overlay-darkness / blur
  controls, swappable from Settings, stored in IndexedDB.
- Glassmorphism profile card (name, role, description, location, email,
  phone, portfolio link — nothing else).
- Live 12h/24h clock with optional seconds, driven by `Intl.DateTimeFormat`
  and the system clock.
- A single shortcuts grid, compact-sized, that seeds itself from
  `chrome.topSites.get()` the first time you open a new tab (see
  [§11](#11-why-the-topsites-permission) for exactly what that does and
  doesn't include) — then behaves like any shortcut you added yourself:
  add / edit / delete, opens in the current tab, persisted in
  `chrome.storage.local`, with URL validation. Shown by default; re-seed it
  at any time from Settings → Shortcuts → "Reset to Chrome's most-visited".
- A Markdown-capable notes card below the shortcuts: type freely (headings,
  **bold**, *italic*, `code`, ```code blocks```, lists, `>` quotes,
  `[text](url)` links), autosaved (debounced) to `chrome.storage.local`, with
  an Edit/Preview toggle. Shown by default; hide it from Settings → Notes →
  "Show notes".
- Settings drawer: clock format, seconds toggle, image management,
  background sliders, shortcut count, shortcuts visibility, notes
  visibility, reset all.
- The picture/pencil/gear icon cluster in the top-right is always visible.
- Fully keyboard accessible: tab order, visible focus rings, `Escape` closes
  dialogs/drawers, focus trapping inside modals, `aria-label`s on icon-only
  buttons, `prefers-reduced-motion` respected.
- Responsive: two-column desktop layout collapses to a scrollable
  single-column layout on small screens.

## 3. Technology stack

- HTML5, CSS3 (custom properties, no framework)
- Vanilla JavaScript (ES modules, no build tool, no transpilation)
- Chrome Extension Manifest V3
- `chrome.storage.local` for settings and shortcuts
- `chrome.topSites` for the most-visited grid
- `IndexedDB` for locally storing user-uploaded images (kept out of
  `chrome.storage` because of its per-item size limits)

No React, no Vite, no Tailwind, no CDN scripts, no external fonts, no
Firebase, no backend.

## 4. Folder structure

```
homescreen/
├── manifest.json
├── newtab.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js               entry point, wires everything together
│   ├── storage.js           chrome.storage.local wrapper + typed defaults
│   ├── imageDb.js           IndexedDB wrapper for background/profile images
│   ├── url.js                normalizeAndValidateUrl() + hostname helper
│   ├── favicon.js            favicon <img> with single-attempt fallback avatar
│   ├── clock.js               isolated live clock (own setInterval)
│   ├── topSites.js           chrome.topSites.get() fetch (used to seed/reset)
│   ├── shortcuts.js          unified grid: seeding + add/edit/delete dialog
│   ├── markdown.js           dependency-free Markdown -> HTML renderer
│   ├── notes.js               notes card: load/save (debounced) + Edit/Preview
│   └── settings.js           settings drawer + background/profile image swap
├── assets/
│   └── README.md             instructions for background.jpg / profile.jpg
└── README.md
```

## 5. Install dependencies

None. There is nothing to `npm install` — open the folder and load it.

## 6. Run locally (development)

Two options while you're editing:

- **Preview in a normal browser tab**: open `homescreen/newtab.html` directly
  (e.g. via a local static server, or `file://`). `chrome.storage` and
  `chrome.topSites` don't exist outside the extension context, so the app
  automatically falls back to `localStorage` and a small fixed preview list
  of sites (see `DEV_FALLBACK_SITES` in `js/topSites.js`) so the UI is still
  usable for layout/styling work.
- **Load as an unpacked extension** (recommended, see next section) — this
  is the only way to see your *real* `chrome.topSites` results.

## 7. Build

Not applicable — there is no build step. Editing any file under `homescreen/`
and reloading the extension (or the tab) is enough.

## 8. Load the extension into Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `homescreen` folder (the one containing `manifest.json`).
5. Open a new tab — you should see the dashboard.

After editing files, go back to `chrome://extensions` and click the reload
icon on the extension's card (or just reload the new tab page for CSS/JS-only
changes that don't touch `manifest.json`).

## 9. Where to place the profile photo

The profile card defaults to `homescreen/assets/me.png` (already included).
To change it, either replace that file, or use the pencil icon in the
top-right controls (hover/focus that corner to reveal it) or Settings →
Profile & background → Change — replacements made that way are stored in
IndexedDB, not written back to `me.png`. If `me.png` is ever removed, a
neutral "G" letter avatar is shown instead of a broken image.

## 10. Where to place `background.jpg`

`homescreen/assets/background.jpg` — same folder. Until you add it, a
mountain-sunset-toned CSS gradient is shown so the page never shows a broken
image. Replaceable at runtime via the picture icon in the top-right controls
or Settings.

## 11. Why the `topSites` permission

The shortcuts grid is seeded from `chrome.topSites.get()`, which returns an
algorithmically-computed "frequently + recently visited" list from your
browsing history. The `topSites` permission is what allows an extension to
read that list at all. Without it, the grid would have to be manually
curated or hardcoded, which this project deliberately avoids.

**Important limitation, by Chrome's design, not this project's:**
`chrome.topSites` is *not* the same data as the tiles you see (and may have
manually pinned, reordered, or removed) on Chrome's own native New Tab page.
That customized list lives in Chrome's private internal preferences and is
**not exposed through any extension API** — no extension, from any
developer, on any Chrome version, can read or write it. `topSites` is the
closest available signal, and it's what every third-party "custom New Tab"
extension is built on for exactly this reason. If a site you rely on doesn't
show up after installing, that's this platform boundary, not a bug — add it
manually (it's a normal shortcut from then on) or use Settings → Shortcuts →
"Reset to Chrome's most-visited" once you've browsed to it a few times.

## 12. Why the native Chrome shortcut UI isn't reused

Chrome does not expose its built-in New Tab shortcut component for
extensions to embed or restyle directly — it's internal browser UI, not a
web component or API surface. There is no supported way to "reuse" it, and
(per §11) there's no supported way to read its underlying data either.

## 13. How this project recreates it instead

The shortcuts grid here is a from-scratch reimplementation. On first run it
calls `chrome.topSites.get()` once and saves the result into this
extension's own `chrome.storage.local` as regular shortcuts — from that
point on they're indistinguishable from ones you add yourself: same
rendering, same edit/delete controls, same storage. Each shortcut renders as
a circular favicon tile (favicon via Google's public favicon service, with a
generated single-letter fallback if it fails to load). Visually similar to
Chrome's own grid, but entirely custom code — no Chrome-proprietary assets
are used.

## 14. Troubleshooting

- **New tab still shows the default Chrome page** — make sure the extension
  is enabled in `chrome://extensions` and that no other extension is also
  overriding the New Tab page (Chrome only allows one active override; if
  several are installed, check `chrome://extensions` for a conflict notice).
- **Shortcuts grid is empty on first run** — `chrome.topSites` needs some
  browsing history in *this* Chrome profile to have anything to return. It
  will seed itself next time you open a new tab once you've browsed a bit,
  or you can add shortcuts manually via "+ Add" in the meantime.
- **A site I have pinned on Chrome's native New Tab page doesn't show up
  here** — expected, not a bug; see [§11](#11-why-the-topsites-permission).
  `chrome.topSites` (the only data any extension can read) isn't the same
  list as your manually-customized native NTP tiles. Add it manually, or
  browse to it a few times and use Settings → Shortcuts → "Reset to Chrome's
  most-visited".
- **Favicon shows a plain letter instead of the site's icon** — the favicon
  service didn't have an icon for that domain; this is the intended
  fallback, not a bug, and it won't keep retrying.
- **Shortcut won't save** — check the inline error under the URL field; only
  `http://` and `https://` links are accepted (typing a bare domain like
  `example.com` is fine, `https://` is added automatically).
- **Uploaded background/profile image disappeared** — images live in this
  browser profile's IndexedDB. Clearing site data / browsing data for the
  extension, or using a different Chrome profile, will lose them; re-upload
  from Settings.
- **Settings didn't persist** — confirm the `storage` permission is present
  in `manifest.json` and that you're testing as a loaded extension (not the
  plain-browser-tab preview, which uses `localStorage` instead and is
  per-origin).

## 15. Packaging as a ZIP

From inside the `homescreen` folder:

```bash
cd homescreen
zip -r ../giridharan-new-tab.zip . -x ".*"
```

(Or, in `chrome://extensions`, use **Pack extension** and point it at the
`homescreen` folder — this produces a `.crx` and a `.pem` key instead of a
`.zip`, useful for self-distribution outside the Web Store.)

## 16. Chrome Web Store preparation notes

- Add real `assets/background.jpg` and `assets/profile.jpg` (or your own
  content) before publishing — ship something other than the gradient
  fallback.
- Add real icon files and reference them from `manifest.json`'s `icons` key
  (omitted in this scaffold) — 16/32/48/128px PNGs are the Store's
  requirement.
- Update `manifest.json`'s `name`, `description` and `version` if you're
  publishing this for yourself rather than as-is.
- Double-check the personal contact details baked into the profile card
  (`newtab.html`) are ones you're comfortable publishing to anyone who
  installs the extension.
- The Store review process checks for exactly the things this project
  already avoids: remote code execution, unnecessary permissions, and
  undisclosed data collection — this extension requests only `storage` and
  `topSites`, and both are used exactly as declared.
