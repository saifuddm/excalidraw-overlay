# Excalidraw Annotate (Chrome Extension)

Draw and annotate directly on top of any webpage using an Excalidraw-powered overlay.

![Excalidraw Annotate icon](icons/icon128.png)

## What This Project Does

This extension injects a full-page Excalidraw canvas into the active tab so you can:

- sketch over websites in place
- temporarily browse the page without closing the annotation session
- capture a selected on-screen region and insert it into the canvas
- keep page scrolling and canvas panning synchronized while annotating

## High-Level Features

- **In-page Excalidraw overlay**: launches on top of any URL and supports normal Excalidraw drawing/editing actions.
- **Mode-based workflow**: switch between browsing, annotating, and capture flow using quick toggles.
- **Region capture to canvas**: drag-select a rectangular area of the visible tab and insert it as an image element with a border.
- **Scroll sync option**: links page scroll and Excalidraw viewport movement for smoother context tracking.
- **Keyboard accessibility**: includes quick toggle shortcut and escape handling for fast transitions.

## Toggle Buttons Explained

The floating toolbar appears at the top-right when the extension is active.

- **Browse**: hides the annotation layer so you can interact with the webpage normally while preserving your current drawing session.
- **Annotate**: enables full interaction with Excalidraw (draw, move, edit, select).
- **Capture**: starts region-selection mode; after you drag to select an area, the screenshot is inserted into the Excalidraw scene and mode returns to Annotate.
- **Off**: closes the overlay completely.
- **Sync scroll (checkbox)**: when enabled, scrolling the webpage and panning the Excalidraw viewport stay in sync (active during browse/annotate behavior).
- **Scroll target (Auto/Window)**:
  - `Auto` (recommended) syncs with the active scroll surface, including nested containers such as full-height chat panes using `overflow-y: auto`.
  - `Window` forces legacy behavior and syncs only with document/window scrolling.

## Keyboard Shortcuts

- `Alt + Shift + A`: toggle extension on/off (from any page).
- `Esc` in Annotate mode: switch to Browse mode.
- `Esc` in Capture mode: cancel capture and return to Annotate mode.

## Tech Stack

- React + TypeScript
- Vite
- CRXJS (`@crxjs/vite-plugin`) for Chrome extension build/integration
- Excalidraw (`@excalidraw/excalidraw`)
- Manifest V3 service worker + content script architecture

## Project Structure (Key Parts)

- `src/content/`: injected UI (toolbar, overlay, mode logic, capture selection)
- `src/background/service-worker.ts`: extension action and tab capture handling
- `src/popup/`: lightweight popup UI with shortcut hint
- `src/manifest.json`: extension permissions, icons, and entry points

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Build extension

```bash
npm run build
```

### 3) Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project's build output directory (typically `dist/`)

## Development Commands

- `npm run dev` - Vite development mode
- `npm run build` - type-check and production build
- `npm run lint` - ESLint checks
- `npm run preview` - preview production build

## Permissions (Why They Exist)

- `activeTab`: interact with the current tab when the user activates the extension.
- `storage`: persist extension state/config as needed.
- `<all_urls>` host permission: allow content script injection across webpages.
