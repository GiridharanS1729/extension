# Slow Unfollow (Chrome extension)

Pick accounts, click once, they unfollow slowly: 1 every 2–4 min, max 1000/day.
Stops by itself if Instagram blocks, waits 24h.

Uses unofficial Instagram web endpoints. Against Instagram terms. Use at own risk.

## Install
1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** → pick this folder.
3. Log in at https://www.instagram.com in same Chrome.

## Use
1. Open instagram.com. Click floating logo (top right) or extension icon → overlay opens on top of Instagram. Esc closes.
2. Page 1 (newest 20 followings) loads by itself. **Next** fetches next 20 from Instagram. Max 10 pages = 200.
3. Optional: **Load followers** → enables "Not following back" filter.
4. Pick cards → **Unfollow selected**. Picks stay across pages.

Keys: arrows move · Enter/Space check · PgUp/PgDn (or arrow past edge) change page · `/` search · Esc close.
5. Keep Chrome open. One instagram.com tab must stay (extension opens pinned one if none).

## Settings
Top of `background.js`: `DAILY_CAP`, `PAGE_SIZE`, `MAX_PAGES`, `MIN_GAP_MS`, `MAX_GAP_MS`, `BLOCK_PAUSE_MS`.
`PAGE_SIZE` / `MAX_PAGES` also at top of `content.js` — keep same.
