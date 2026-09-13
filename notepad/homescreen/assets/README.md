# Add your own images here

- `me.png` — the profile photo, already included, used as-is by `newtab.html`.
- `background.jpg` — **not included.** No real background photo could be sourced locally for this build. Until you add one, the page falls back to a mountain-sunset-toned CSS gradient instead of a broken image.

To use your own background, add:

```
homescreen/assets/background.jpg   (a landscape/scenic photo, e.g. mountain sunset)
```

To replace the profile photo, either overwrite `me.png` directly, or swap it
at runtime from the New Tab page (see below) without touching this folder.

No rebuild is needed — this is a plain-file extension, just reload it from `chrome://extensions`.

You can also change either image later, without editing files, from the New Tab page itself: use the picture icon (background) or pencil icon (profile) in the top-right floating controls, or the **Profile & background** section of Settings. Images picked that way are stored locally in the browser's IndexedDB, not written back to this folder.
