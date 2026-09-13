# AI Prompt Sidebar

A developer-focused Chrome Extension for AI-powered text processing with reusable prompt cards.

## Features

- **Multi-Model Support**: OpenAI, Gemini, Groq, DeepSeek
- **Reusable Prompt Cards**: Create, edit, clone, and organize prompts
- **Rephrase Tool**: Quick text rephrasing with tone and word controls
- **Streaming Responses**: Real-time token streaming
- **History**: Track all generations with full context
- **Context Menu**: Right-click to run prompts on selected text
- **Keyboard Shortcuts**: Ctrl+Shift+Y (toggle), Ctrl+Shift+C (copy)
- **100% Local**: No telemetry, no cloud storage, no tracking

## Setup

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
cd chrome-extension
npm install
# or
bun install
```

### Build

```bash
npm run build
# or
bun run build
```

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `chrome-extension/dist` folder

## Development

```bash
npm run dev
```

Then reload the extension in Chrome after changes.

## Configuration

1. Click the extension icon
2. Go to Settings tab
3. Add API keys for your preferred providers
4. Select a default model

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+Y` | Toggle sidebar |
| `Ctrl+Shift+C` | Copy last output |
| `Enter` | Send prompt |
| `Shift+Enter` | New line |

## Project Structure

```
chrome-extension/
├── manifest.json          # Extension manifest
├── popup.html             # Popup entry
├── sidepanel.html         # Side panel entry
├── src/
│   ├── background/        # Service worker
│   ├── content/           # Content scripts
│   ├── components/        # React components
│   ├── lib/               # Storage, providers, engine
│   ├── store/             # Zustand store
│   ├── styles/            # Global CSS
│   ├── types/             # TypeScript types
│   ├── popup/             # Popup React app
│   └── sidepanel/         # Sidepanel React app
└── icons/                 # Extension icons
```

## Security

- All API keys stored locally in `chrome.storage.local`
- No external servers contacted (except AI APIs)
- No logging or analytics
- No third-party scripts
