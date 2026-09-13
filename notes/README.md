# Notes Panel - Multi-File Side Panel (Chrome MV3 extension)

Author: Giridharan S

## Install (unpacked, for testing)
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this folder
4. Click the extension icon on any tab to open the panel

## What changed from v1

The old version auto-synced every keystroke live across every open copy of
the panel (via a `background.js` port relay). That's been removed. The panel
is now a manual save-as-file model:

| Old behavior | New behavior |
|---|---|
| Every edit broadcast instantly to other open panels | Editing only affects your current session (auto-persisted locally as a draft so it survives a reload, but not pushed anywhere) |
| Single note (`noteId: "default"`) | Unlimited saved files, each its own entry |
| Status dot / "synced" indicator | Removed — replaced by two header icons |

## The header icons

- **Save icon** (floppy disk, top right of the title bar) — snapshots your
  current title + content as a **brand-new** file in history. It never
  overwrites a previous save, but it also won't create a duplicate: if the
  title and content exactly match an entry already in history, saving again
  just shows "Already saved" instead of adding another row.
- **Logo ("G", top-left)** — click to toggle the editor between plain-text
  edit mode and a rendered Markdown preview, in place (no new tab/window).
  Click again to go back. The preview pane is itself editable: you can type
  directly into the rendered view (bold text, list items, etc.) and it's
  converted back into plain Markdown source as you go. Supports headings,
  bold/italic, inline and fenced code, links, blockquotes, and lists.
- **History icon** ("i" — a circled info glyph, next to the save icon) —
  opens the saved-files panel in the top-right corner, listing every file
  you've saved:
  - Each row shows the file's **title** and when it was saved.
  - Click a row (anywhere except the delete button) to **reopen** that file
    into the main editor.
  - Click the **delete button** on a row to remove that saved file
    permanently.
  - Click the ✕ in the panel header, click the dimmed backdrop, or press
    `Esc` to close the panel.

## Storage layout (`chrome.storage.local`)

- `draft` — `{ title, content }`, the note currently in the editor. Purely
  local persistence so a reload/reopen doesn't lose unsaved work; this is
  **not** broadcast or synced anywhere.
- `history` — an array of saved files, newest first:
  ```json
  { "id": "uuid", "title": "…", "content": "…", "savedAt": 1730000000000 }
  ```

## Files
- `manifest.json` — MV3 manifest (`sidePanel` + `storage` permissions only;
  the `tabs` permission and the port-based relay it supported are gone)
- `background.js` — now just opens the side panel on the toolbar click
- `sidepanel.html` / `sidepanel.css` / `sidepanel.js` — the panel UI and the
  save/history/preview logic described above
- `markdown.js` — small dependency-free Markdown <-> HTML converter used by
  the preview toggle: `renderMarkdown` for display (escapes all text before
  adding any markup) and `serializeMarkdown` to turn hand-edited preview
  HTML back into plain Markdown
