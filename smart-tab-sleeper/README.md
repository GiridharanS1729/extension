# Smart Tab Sleeper Pro

Smart Tab Sleeper Pro is a Chrome extension that keeps your browser fast by putting truly idle tabs to sleep, while protecting the ones you are likely to return to.

## Key Features

- 🔄 Auto-sleep idle tabs after a configurable time
- 🧠 Per-site idle rules (e.g. YouTube sleeps later than static blogs)
- 🧮 Per-tab RAM usage *estimate* (Low / Medium / High) based on site type
- 🤖 Simple ML-style “likely to return” score to protect important tabs
- 📊 Heatmap view of your tab usage (top domains and active hours)
- 🧾 Live list of tabs, sorted by idle time (highest → lowest)
- 🔔 Optional notifications when a tab is put to sleep
- 👆 One-click Sleep and Open buttons from the popup
- ⚙️ Auto-refresh of the tab list every N seconds

## How It Works

- The extension tracks when each tab was last active.
- For each tab, it calculates idle duration and applies:
  - A global idle timeout, or
  - A per-site rule, if configured.
- Tabs that are idle beyond their threshold, not pinned, not playing audio, and not “protected” by the ML score are put to sleep using Chrome’s built-in discard mechanism.
- When you open a sleeping tab again, Chrome reloads the page automatically. The extension never forces a manual reload.

> Note: Chrome’s discard behavior is controlled by the browser. Extensions cannot prevent the reload of a discarded tab.

## Per-Site Idle Rules

You can configure per-site timeouts in the popup, using lines like:

```text
youtube.com = 300s
mail.google.com = 10m
