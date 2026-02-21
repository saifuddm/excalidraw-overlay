# Excalidraw Web Annotation Overlay

## Application Context

### What We're Building

A Chrome extension that overlays an Excalidraw canvas on any webpage, allowing users to draw annotations directly on web content. Annotations persist, anchor to page elements, and export as standalone `.excalidraw` files with embedded screenshots for offline context.

### Core User Flow

```text
1. User browses to any webpage (e.g., T3 Chat conversation)
2. User activates extension → Excalidraw overlay appears
3. User toggles between Browse mode (interact with page) and Annotate mode (draw)
4. Annotations anchor to nearby DOM elements
5. Screenshots capture automatically for offline viewing
6. User exports/saves → opens in Excalidraw.com with full context
7. User returns to page later → extension reloads annotations, repositions if needed
```

### Tech Stack

| Component           | Technology                                                   |
| ------------------- | ------------------------------------------------------------ |
| Extension framework | Chrome Manifest V3                                           |
| Drawing canvas      | `@excalidraw/excalidraw` (React component)                   |
| UI framework        | React 18 + TypeScript                                        |
| Bundler             | Vite with CRXJS plugin (or Plasmo)                           |
| Storage             | `chrome.storage.local` for annotations, IndexedDB for images |
| Screenshot capture  | `chrome.tabs.captureVisibleTab()`                            |

### File Structure

```text
excalidraw-annotate/
├── src/
│   ├── manifest.json
│   ├── background/
│   │   └── service-worker.ts       # Screenshot capture, storage coordination
│   ├── content/
│   │   ├── index.tsx               # Entry point, mounts React app
│   │   ├── App.tsx                 # Main component, mode management
│   │   ├── components/
│   │   │   ├── Overlay.tsx         # The Excalidraw wrapper
│   │   │   ├── ModeToggle.tsx      # Browse/Annotate/View toggle UI
│   │   │   └── Toolbar.tsx         # Save, export, settings
│   │   ├── hooks/
│   │   │   ├── useMode.ts          # Mode state management
│   │   │   ├── useAnchoring.ts     # DOM anchor resolution (L2)
│   │   │   ├── useScrollSync.ts    # Page ↔ canvas sync (L2)
│   │   │   └── useScreenshots.ts   # Context capture (L3)
│   │   ├── lib/
│   │   │   ├── anchoring.ts        # Anchor creation, resolution, fallbacks
│   │   │   ├── storage.ts          # Save/load annotations
│   │   │   ├── capture.ts          # Screenshot utilities
│   │   │   └── messaging.ts        # Content ↔ background communication
│   │   └── styles/
│   │       └── overlay.css
│   ├── popup/
│   │   ├── Popup.tsx               # Extension popup (settings, quick actions)
│   │   └── popup.html
│   └── types/
│       └── index.ts                # Shared type definitions
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Level 1: Basic Overlay

**Goal:** Excalidraw overlays the page. User can toggle between Browse and Annotate modes. Page is frozen during annotation. No persistence, no scrolling sync, no anchoring.

### Step 1.1: Extension Scaffolding

Create the Chrome extension structure with Vite + CRXJS.

**Files to create:**
- `package.json` with dependencies
- `vite.config.ts` with CRXJS plugin
- `src/manifest.json` (Manifest V3)
- `tsconfig.json`

**manifest.json outline:**
```json
{
  "manifest_version": 3,
  "name": "Excalidraw Annotate",
  "version": "0.1.0",
  "description": "Annotate any webpage with Excalidraw",
  "permissions": ["activeTab", "storage"],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": "icons/icon48.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.tsx"],
      "css": ["src/content/styles/overlay.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "icons": {
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Dependencies:**
```json
{
  "dependencies": {
    "@excalidraw/excalidraw": "^0.17.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.21",
    "@types/chrome": "^0.0.260",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

### Step 1.2: Content Script Entry Point

Mount a React app into the page via a shadow DOM container (isolates styles).

**src/content/index.tsx:**
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

function init() {
  // Create isolated container
  const container = document.createElement("div");
  container.id = "excalidraw-annotate-root";
  document.body.appendChild(container);

  // Use shadow DOM to isolate styles
  const shadow = container.attachShadow({ mode: "open" });

  // Create mount point inside shadow
  const mountPoint = document.createElement("div");
  mountPoint.id = "excalidraw-annotate-mount";
  shadow.appendChild(mountPoint);

  // Inject styles into shadow DOM
  const style = document.createElement("style");
  style.textContent = `
    #excalidraw-annotate-mount {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      pointer-events: none;
    }
    .overlay-active {
      pointer-events: auto;
    }
  `;
  shadow.appendChild(style);

  createRoot(mountPoint).render(<App shadowRoot={shadow} />);
}

// Wait for page to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

### Step 1.3: Mode Management Hook

**src/content/hooks/useMode.ts:**
```ts
import { useState, useEffect, useCallback } from "react";

export type Mode = "off" | "browse" | "annotate";

export function useMode() {
  const [mode, setMode] = useState<Mode>("off");

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+Shift+A to toggle extension on/off
      if (e.altKey && e.shiftKey && e.key === "A") {
        setMode((prev) => (prev === "off" ? "annotate" : "off"));
        return;
      }

      // Only handle other shortcuts when extension is active
      if (mode === "off") return;

      // Hold Alt to temporarily switch to browse mode
      if (e.key === "Alt" && mode === "annotate") {
        setMode("browse");
      }

      // Escape to switch to browse mode
      if (e.key === "Escape" && mode === "annotate") {
        setMode("browse");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Release Alt to return to annotate mode
      if (e.key === "Alt" && mode === "browse") {
        setMode("annotate");
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [mode]);

  return { mode, setMode };
}
```

### Step 1.4: Main App Component

**src/content/App.tsx:**
```tsx
import React from "react";
import { useMode } from "./hooks/useMode";
import Overlay from "./components/Overlay";
import ModeToggle from "./components/ModeToggle";

interface AppProps {
  shadowRoot: ShadowRoot;
}

export default function App({ shadowRoot }: AppProps) {
  const { mode, setMode } = useMode();

  if (mode === "off") return null;

  return (
    <>
      <ModeToggle mode={mode} setMode={setMode} />
      <Overlay mode={mode} shadowRoot={shadowRoot} />
    </>
  );
}
```

### Step 1.5: Mode Toggle UI

**src/content/components/ModeToggle.tsx:**
```tsx
import React from "react";
import type { Mode } from "../hooks/useMode";

interface ModeToggleProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export default function ModeToggle({ mode, setMode }: ModeToggleProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: 2147483647,
        display: "flex",
        gap: "4px",
        background: "#1e1e1e",
        padding: "6px",
        borderRadius: "8px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        pointerEvents: "auto",
      }}
    >
      <button
        onClick={() => setMode("browse")}
        style={{
          padding: "6px 12px",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          background: mode === "browse" ? "#4f46e5" : "#333",
          color: "#fff",
        }}
      >
        🔍 Browse
      </button>
      <button
        onClick={() => setMode("annotate")}
        style={{
          padding: "6px 12px",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          background: mode === "annotate" ? "#4f46e5" : "#333",
          color: "#fff",
        }}
      >
        ✏️ Annotate
      </button>
      <button
        onClick={() => setMode("off")}
        style={{
          padding: "6px 12px",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          background: "#333",
          color: "#fff",
        }}
      >
        ✕
      </button>
    </div>
  );
}
```

### Step 1.6: Excalidraw Overlay Component

**src/content/components/Overlay.tsx:**
```tsx
import React, { useState, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";
import type { Mode } from "../hooks/useMode";

interface OverlayProps {
  mode: Mode;
  shadowRoot: ShadowRoot;
}

export default function Overlay({ mode, shadowRoot }: OverlayProps) {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);

  const handleChange = useCallback(
    (newElements: readonly ExcalidrawElement[], appState: AppState) => {
      setElements(newElements);
    },
    []
  );

  const isAnnotating = mode === "annotate";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: isAnnotating ? "auto" : "none",
        opacity: mode === "browse" ? 0.4 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        initialData={{
          elements: [],
          appState: {
            viewBackgroundColor: "transparent",
            gridSize: null,
          },
        }}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            export: { saveFileToDisk: true },
            loadScene: true,
            saveToActiveFile: false,
            toggleTheme: true,
          },
        }}
        theme="dark"
      />
    </div>
  );
}
```

### Step 1.7: Background Service Worker (Minimal)

**src/background/service-worker.ts:**
```ts
// Level 1: Minimal background script
// Just handles extension icon click to send message to content script

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_EXTENSION" });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_INFO") {
    sendResponse({
      url: sender.tab?.url,
      title: sender.tab?.title,
    });
  }
  return true; // Keep channel open for async response
});
```

### Level 1 Acceptance Criteria

- [ ] Extension loads on any webpage
- [ ] `Alt+Shift+A` toggles the overlay on/off
- [ ] Mode toggle UI visible in top-right corner
- [ ] Annotate mode: can draw shapes, lines, text on the overlay
- [ ] Browse mode: overlay becomes transparent and click-through
- [ ] Hold `Alt` in annotate mode temporarily switches to browse
- [ ] Excalidraw canvas has transparent background
- [ ] Page content visible beneath annotations
- [ ] No errors in console

---

## Level 2: Anchoring & Scroll Sync

**Goal:** Annotations anchor to DOM elements. Scrolling the page moves annotations. Panning the canvas extends page margins. Annotations persist and reposition on page revisit.

### Step 2.1: Type Definitions

**src/types/index.ts:**
```ts
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

export type Mode = "off" | "browse" | "annotate" | "view";

export interface Anchor {
  // Level 1: Stable DOM selector (best)
  selector?: string;
  messageId?: string;

  // Level 2: Content hash (survives DOM reconstruction)
  contentHash?: string;

  // Level 3: Absolute position (fallback)
  position: {
    pageX: number;
    pageY: number;
    scrollY: number;
    pageHeight: number;
    viewportHeight: number;
  };
}

export interface AnnotationGroup {
  id: string;
  anchor: Anchor;
  elementIds: string[]; // Excalidraw element IDs belonging to this group
  createdAt: number;
  updatedAt: number;
  lastKnownY: number; // For drift detection
}

export interface PageAnnotations {
  url: string;
  urlPattern: string; // For matching similar URLs
  title: string;
  groups: AnnotationGroup[];
  elements: ExcalidrawElement[];
  createdAt: number;
  updatedAt: number;
}

export interface CanvasViewport {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}
```

### Step 2.2: Anchoring Library

**src/content/lib/anchoring.ts:**
```ts
import type { Anchor, AnnotationGroup } from "../../types";

// Create an anchor from a page coordinate
export function createAnchor(pageX: number, pageY: number): Anchor {
  // Convert page coordinates to viewport coordinates for elementFromPoint
  const viewportX = pageX - window.scrollX;
  const viewportY = pageY - window.scrollY;

  // Find element at this position
  const element = document.elementFromPoint(viewportX, viewportY);

  // Try to find a meaningful parent with an ID or data attribute
  const anchorEl = findAnchorableElement(element);

  return {
    selector: anchorEl ? buildSelector(anchorEl) : undefined,
    messageId: anchorEl?.getAttribute("data-message-id") ?? undefined,
    contentHash: anchorEl ? hashContent(anchorEl.textContent ?? "") : undefined,
    position: {
      pageX,
      pageY,
      scrollY: window.scrollY,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    },
  };
}

// Find the nearest element suitable for anchoring
function findAnchorableElement(el: Element | null): Element | null {
  if (!el) return null;

  // Walk up the tree looking for good anchor candidates
  let current: Element | null = el;
  while (current && current !== document.body) {
    // Has a stable ID
    if (current.id && !current.id.startsWith("radix-")) {
      return current;
    }
    // Has a data attribute that looks like an ID
    if (
      current.getAttribute("data-message-id") ||
      current.getAttribute("data-id") ||
      current.getAttribute("data-testid")
    ) {
      return current;
    }
    current = current.parentElement;
  }

  // Fallback: return the original element's nearest block-level parent
  current = el;
  while (current && current !== document.body) {
    const display = getComputedStyle(current).display;
    if (display === "block" || display === "flex" || display === "grid") {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

// Build a CSS selector for an element
function buildSelector(el: Element): string {
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  const messageId = el.getAttribute("data-message-id");
  if (messageId) {
    return `[data-message-id="${CSS.escape(messageId)}"]`;
  }

  const dataId = el.getAttribute("data-id");
  if (dataId) {
    return `[data-id="${CSS.escape(dataId)}"]`;
  }

  // Fallback: build a path-based selector
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body && path.length < 5) {
    let selector = current.tagName.toLowerCase();
    if (current.className) {
      const classes = current.className
        .split(" ")
        .filter((c) => c && !c.startsWith("_"))
        .slice(0, 2);
      if (classes.length) {
        selector += "." + classes.map((c) => CSS.escape(c)).join(".");
      }
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(" > ");
}

// Simple content hash for matching
export function hashContent(text: string): string {
  const snippet = text.trim().slice(0, 150).toLowerCase();
  let hash = 0;
  for (let i = 0; i < snippet.length; i++) {
    hash = (hash << 5) - hash + snippet.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

// Resolve an anchor to current page coordinates
export function resolveAnchor(
  anchor: Anchor
): { x: number; y: number; element?: Element } | null {
  // Try selector first
  if (anchor.selector) {
    try {
      const el = document.querySelector(anchor.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          element: el,
        };
      }
    } catch (e) {
      // Invalid selector, continue to fallbacks
    }
  }

  // Try message ID
  if (anchor.messageId) {
    const el = document.querySelector(
      `[data-message-id="${anchor.messageId}"]`
    );
    if (el) {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        element: el,
      };
    }
  }

  // Try content hash
  if (anchor.contentHash) {
    const match = findElementByContentHash(anchor.contentHash);
    if (match) {
      const rect = match.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        element: match,
      };
    }
  }

  // Fallback to absolute position
  // Adjust for page height changes
  const heightRatio =
    document.documentElement.scrollHeight / anchor.position.pageHeight;
  return {
    x: anchor.position.pageX,
    y: anchor.position.pageY * heightRatio,
  };
}

function findElementByContentHash(hash: string): Element | null {
  // Search through likely content containers
  const candidates = document.querySelectorAll(
    "p, div, article, section, [data-message-id]"
  );

  for (const el of candidates) {
    if (hashContent(el.textContent ?? "") === hash) {
      return el;
    }
  }
  return null;
}
```

### Step 2.3: Scroll Sync Hook

**src/content/hooks/useScrollSync.ts:**
```ts
import { useEffect, useRef, useCallback } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import type { Mode, CanvasViewport } from "../../types";

interface UseScrollSyncOptions {
  mode: Mode;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export function useScrollSync({ mode, excalidrawAPI }: UseScrollSyncOptions) {
  const lastScrollY = useRef(window.scrollY);
  const lastScrollX = useRef(window.scrollX);

  // Sync page scroll to canvas when in browse/view mode
  useEffect(() => {
    if (!excalidrawAPI) return;
    if (mode !== "browse" && mode !== "view") return;

    const handleScroll = () => {
      const deltaY = window.scrollY - lastScrollY.current;
      const deltaX = window.scrollX - lastScrollX.current;

      lastScrollY.current = window.scrollY;
      lastScrollX.current = window.scrollX;

      // Move the Excalidraw viewport to match page scroll
      const appState = excalidrawAPI.getAppState();
      excalidrawAPI.updateScene({
        appState: {
          scrollX: appState.scrollX - deltaX,
          scrollY: appState.scrollY - deltaY,
        },
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mode, excalidrawAPI]);

  // Sync canvas pan to page margins when in annotate mode
  const syncPageMargins = useCallback(
    (viewport: CanvasViewport) => {
      if (mode !== "annotate") return;

      const { scrollX, scrollY, zoom, width, height } = viewport;

      // Calculate canvas bounds in page coordinates
      const canvasLeft = -scrollX;
      const canvasTop = -scrollY;
      const canvasRight = -scrollX + width / zoom;
      const canvasBottom = -scrollY + height / zoom;

      const pageWidth = document.documentElement.scrollWidth;
      const pageHeight = document.documentElement.scrollHeight;

      // Get or create wrapper for margin control
      let wrapper = document.getElementById(
        "excalidraw-annotate-page-wrapper"
      ) as HTMLElement;

      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = "excalidraw-annotate-page-wrapper";
        wrapper.style.minWidth = "100%";
        wrapper.style.minHeight = "100%";

        // Wrap body contents
        while (document.body.firstChild) {
          if (
            document.body.firstChild instanceof HTMLElement &&
            document.body.firstChild.id === "excalidraw-annotate-root"
          ) {
            // Don't wrap our own container
            break;
          }
          wrapper.appendChild(document.body.firstChild);
        }
        document.body.insertBefore(wrapper, document.body.firstChild);
      }

      // Extend margins to cover canvas overflow
      const extraRight = Math.max(0, canvasRight - pageWidth);
      const extraBottom = Math.max(0, canvasBottom - pageHeight);
      const extraLeft = Math.max(0, -canvasLeft);
      const extraTop = Math.max(0, -canvasTop);

      wrapper.style.marginRight = `${extraRight}px`;
      wrapper.style.marginBottom = `${extraBottom}px`;
      wrapper.style.marginLeft = `${extraLeft}px`;
      wrapper.style.marginTop = `${extraTop}px`;
    },
    [mode]
  );

  return { syncPageMargins };
}
```

### Step 2.4: Anchoring Hook

**src/content/hooks/useAnchoring.ts:**
```ts
import { useEffect, useRef, useCallback } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type { AnnotationGroup, Anchor } from "../../types";
import { createAnchor, resolveAnchor } from "../lib/anchoring";

interface UseAnchoringOptions {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  enabled: boolean;
}

export function useAnchoring({ excalidrawAPI, enabled }: UseAnchoringOptions) {
  const groups = useRef<Map<string, AnnotationGroup>>(new Map());
  const elementToGroup = useRef<Map<string, string>>(new Map());

  // Assign new elements to anchor groups
  const assignElementToGroup = useCallback(
    (element: ExcalidrawElement) => {
      if (elementToGroup.current.has(element.id)) return;

      // Create anchor at element's position
      const anchor = createAnchor(element.x, element.y);

      // Find or create a group near this anchor
      let group = findNearbyGroup(element, groups.current);

      if (!group) {
        group = {
          id: crypto.randomUUID(),
          anchor,
          elementIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastKnownY: element.y,
        };
        groups.current.set(group.id, group);
      }

      group.elementIds.push(element.id);
      group.updatedAt = Date.now();
      elementToGroup.current.set(element.id, group.id);
    },
    []
  );

  // Recalibrate all groups based on current DOM
  const recalibrateGroups = useCallback(() => {
    if (!excalidrawAPI) return;

    const elements = excalidrawAPI.getSceneElements();
    const updates: ExcalidrawElement[] = [];

    for (const group of groups.current.values()) {
      const resolved = resolveAnchor(group.anchor);
      if (!resolved) continue;

      const drift = resolved.y - group.lastKnownY;
      if (Math.abs(drift) < 2) continue; // No significant drift

      // Move all elements in this group
      for (const elementId of group.elementIds) {
        const el = elements.find((e) => e.id === elementId);
        if (el) {
          updates.push({
            ...el,
            y: el.y + drift,
          } as ExcalidrawElement);
        }
      }

      group.lastKnownY = resolved.y;
    }

    if (updates.length > 0) {
      const unchangedElements = elements.filter(
        (el) => !updates.some((u) => u.id === el.id)
      );
      excalidrawAPI.updateScene({
        elements: [...unchangedElements, ...updates],
      });
    }
  }, [excalidrawAPI]);

  // Watch for DOM changes (virtualized list re-rendering)
  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver(() => {
      // Debounce recalibration
      requestAnimationFrame(recalibrateGroups);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [enabled, recalibrateGroups]);

  // Watch for resize
  useEffect(() => {
    if (!enabled) return;

    const observer = new ResizeObserver(() => {
      recalibrateGroups();
    });

    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [enabled, recalibrateGroups]);

  return {
    assignElementToGroup,
    recalibrateGroups,
    groups: groups.current,
  };
}

// Find a group whose anchor is close to this element
function findNearbyGroup(
  element: ExcalidrawElement,
  groups: Map<string, AnnotationGroup>,
  threshold = 150
): AnnotationGroup | null {
  for (const group of groups.values()) {
    const resolved = resolveAnchor(group.anchor);
    if (!resolved) continue;

    const distance = Math.hypot(
      element.x - resolved.x,
      element.y - resolved.y
    );

    if (distance < threshold) {
      return group;
    }
  }
  return null;
}
```

### Step 2.5: Storage Library

**src/content/lib/storage.ts:**
```ts
import type { PageAnnotations, AnnotationGroup } from "../../types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

const STORAGE_KEY_PREFIX = "excalidraw-annotate:";

function getStorageKey(url: string): string {
  // Normalize URL (remove hash, normalize trailing slashes)
  const normalized = new URL(url);
  normalized.hash = "";
  return STORAGE_KEY_PREFIX + normalized.toString();
}

export async function saveAnnotations(
  url: string,
  title: string,
  groups: Map<string, AnnotationGroup>,
  elements: readonly ExcalidrawElement[]
): Promise<void> {
  const key = getStorageKey(url);

  const data: PageAnnotations = {
    url,
    urlPattern: new URL(url).pathname,
    title,
    groups: Array.from(groups.values()),
    elements: elements as ExcalidrawElement[],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await chrome.storage.local.set({ [key]: data });
}

export async function loadAnnotations(
  url: string
): Promise<PageAnnotations | null> {
  const key = getStorageKey(url);
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

export async function deleteAnnotations(url: string): Promise<void> {
  const key = getStorageKey(url);
  await chrome.storage.local.remove(key);
}

export async function listAllAnnotations(): Promise<PageAnnotations[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith(STORAGE_KEY_PREFIX))
    .map(([, value]) => value as PageAnnotations);
}
```

### Step 2.6: Update Overlay Component

Update `Overlay.tsx` to integrate anchoring and scroll sync. Add auto-save and load functionality.

### Level 2 Acceptance Criteria

- [ ] Annotations anchor to nearby DOM elements automatically
- [ ] Scrolling in browse mode moves annotations with the page
- [ ] Panning the canvas in annotate mode extends page margins
- [ ] Annotations persist across page refreshes
- [ ] Annotations reposition correctly when DOM elements move
- [ ] Works with virtualized lists (elements appearing/disappearing)
- [ ] `ResizeObserver` recalibrates on window resize
- [ ] Zoom locks to 1x in browse/view modes

---

## Level 3: Screenshot Context

**Goal:** Automatically capture screenshots as context for annotations. Screenshots show in standalone Excalidraw but hide in overlay mode. Support export to `.excalidraw` files.

### Step 3.1: Screenshot Capture Service

**src/background/service-worker.ts** (expanded):
```ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_VISIBLE_TAB") {
    handleCapture(sender.tab?.id, message.region, message.padding)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // Async response
  }

  // ... other handlers
});

async function handleCapture(
  tabId: number | undefined,
  region: { top: number; left: number; width: number; height: number },
  padding: number
): Promise<{ dataUrl: string }> {
  if (!tabId) throw new Error("No tab ID");

  // Capture the visible tab
  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: "png",
    quality: 90,
  });

  // If a specific region is requested, crop it
  if (region) {
    const cropped = await cropImage(dataUrl, region, padding);
    return { dataUrl: cropped };
  }

  return { dataUrl };
}

async function cropImage(
  dataUrl: string,
  region: { top: number; left: number; width: number; height: number },
  padding: number
): Promise<string> {
  // Use OffscreenCanvas for cropping in service worker
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(
    region.width,
    region.height + padding * 2
  );

  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    bitmap,
    region.left,
    Math.max(0, region.top - padding),
    region.width,
    region.height + padding * 2,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(croppedBlob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### Step 3.2: Screenshot Hook

**src/content/hooks/useScreenshots.ts:**
```ts
import { useCallback, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import type { AnnotationGroup } from "../../types";

interface UseScreenshotsOptions {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  groups: Map<string, AnnotationGroup>;
}

export function useScreenshots({
  excalidrawAPI,
  groups,
}: UseScreenshotsOptions) {
  const capturedGroups = useRef<Set<string>>(new Set());

  const captureContextForGroup = useCallback(
    async (group: AnnotationGroup, padding = 60) => {
      if (!excalidrawAPI) return;
      if (capturedGroups.current.has(group.id)) return;

      // Get bounds of all elements in this group
      const elements = excalidrawAPI.getSceneElements();
      const groupElements = elements.filter((el) =>
        group.elementIds.includes(el.id)
      );

      if (groupElements.length === 0) return;

      const bounds = getElementsBounds(groupElements);

      // Request screenshot from background script
      const response = await chrome.runtime.sendMessage({
        type: "CAPTURE_VISIBLE_TAB",
        region: {
          top: bounds.top - window.scrollY,
          left: 0,
          width: window.innerWidth,
          height: bounds.height,
        },
        padding,
      });

      if (response.error) {
        console.error("Screenshot failed:", response.error);
        return;
      }

      // Add image to Excalidraw
      const fileId = crypto.randomUUID();

      excalidrawAPI.addFiles([
        {
          id: fileId,
          dataURL: response.dataUrl,
          mimeType: "image/png",
          created: Date.now(),
        },
      ]);

      // Create image element behind annotations
      const imageElement = {
        type: "image" as const,
        id: crypto.randomUUID(),
        fileId,
        x: 0,
        y: bounds.top - padding,
        width: window.innerWidth,
        height: bounds.height + padding * 2,
        locked: true,
        opacity: 100,
        customData: {
          role: "context",
          groupId: group.id,
          sourceUrl: window.location.href,
          capturedAt: Date.now(),
        },
      };

      // Insert at the beginning (behind everything)
      excalidrawAPI.updateScene({
        elements: [imageElement, ...elements],
      });

      capturedGroups.current.add(group.id);
    },
    [excalidrawAPI]
  );

  const captureAllGroups = useCallback(async () => {
    for (const group of groups.values()) {
      await captureContextForGroup(group);
    }
  }, [groups, captureContextForGroup]);

  const setContextVisibility = useCallback(
    (visible: boolean) => {
      if (!excalidrawAPI) return;

      const elements = excalidrawAPI.getSceneElements();
      const updated = elements.map((el) => {
        if ((el as any).customData?.role !== "context") return el;
        return { ...el, opacity: visible ? 100 : 0 };
      });

      excalidrawAPI.updateScene({ elements: updated });
    },
    [excalidrawAPI]
  );

  return {
    captureContextForGroup,
    captureAllGroups,
    setContextVisibility,
  };
}

function getElementsBounds(elements: any[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width ?? 0));
    maxY = Math.max(maxY, el.y + (el.height ?? 0));
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
```

### Step 3.3: Export Functionality

**src/content/lib/export.ts:**
```ts
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

export async function exportToFile(
  excalidrawAPI: ExcalidrawImperativeAPI,
  filename: string
) {
  const elements = excalidrawAPI.getSceneElements();
  const appState = excalidrawAPI.getAppState();
  const files = excalidrawAPI.getFiles();

  const data = {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-annotate-extension",
    elements,
    appState: {
      gridSize: appState.gridSize,
      viewBackgroundColor: "#ffffff", // Use white for export
    },
    files,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.excalidraw`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Step 3.4: Integrate into Overlay

Update `Overlay.tsx` to:
- Toggle context visibility based on mode (`overlay` vs `standalone`)
- Auto-capture screenshots after annotation activity (debounced)
- Add export button to toolbar

### Level 3 Acceptance Criteria

- [ ] Screenshots auto-capture after drawing activity settles (2s debounce)
- [ ] Screenshots are tagged with `customData.role: "context"`
- [ ] Context images hidden (opacity: 0) when overlay is active
- [ ] Context images visible when viewing exported `.excalidraw` file
- [ ] Export button downloads valid `.excalidraw` file
- [ ] Exported file opens correctly in Excalidraw.com
- [ ] Images included in export as embedded files
- [ ] Manual "Capture Context" button for on-demand screenshots

---

## Questions & Concerns

### Technical Concerns

| Concern                                         | Risk Level | Mitigation                                                                                                                         |
| ----------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Shadow DOM + React portals**                  | Medium     | Excalidraw may expect access to `document.body` for modals/popovers. May need to patch or configure portal containers. Test early. |
| **Excalidraw bundle size**                      | Medium     | The library is ~800KB gzipped. Content script will be heavy. Consider lazy-loading only when user activates.                       |
| **`chrome.tabs.captureVisibleTab` permissions** | Low        | Requires `activeTab` permission, but user must explicitly invoke. Some enterprise environments block this.                         |
| **Virtualized list detection**                  | Medium     | Different chat apps use different virtualization libraries. May need site-specific adapters for T3 Chat, ChatGPT, etc.             |
| **Cross-origin iframes**                        | High       | If the page has iframes (ads, embeds), you cannot capture or annotate inside them. Accept this limitation.                         |
| **Performance on long pages**                   | Medium     | MutationObserver on `document.body` with `subtree: true` can be expensive. Debounce aggressively.                                  |

### UX Concerns

| Concern                  | Question                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mode confusion**       | Will users understand when they're in Browse vs Annotate? Consider a strong visual indicator (border color, cursor change).                             |
| **Accidental drawings**  | If user forgets they're in annotate mode, they might draw when trying to scroll. The hold-Alt-to-browse pattern helps but needs discoverability.        |
| **Screenshot staleness** | If the page updates after screenshots are taken, the context becomes misleading. Worth showing a "stale" indicator?                                     |
| **Storage limits**       | `chrome.storage.local` has a 10MB limit (or higher with `unlimitedStorage` permission). Many screenshots could hit this. Consider IndexedDB for images. |

### Scope Questions

1. **Multi-page annotations?** Should annotations work across navigation (e.g., annotate page 1, click a link, annotate page 2, have them in the same file)? Answer: NO they should not

2. **Collaboration?** Any plans to sync annotations between users? (Probably not for v1, but affects architecture.) Answer: NO collaboration features

3. **Which sites to support?** Should this work on *any* site, or optimize specifically for T3 Chat / ChatGPT / Claude? Site-specific adapters could improve anchoring reliability. Answer: this should work on any website

4. **Offline viewing?** If user exports and opens in Excalidraw offline, do we need the screenshots to be self-contained? (Current design: yes, embedded in file.)

5. **Annotation types?** Just freeform Excalidraw, or also structured annotations (comments, highlights, bookmarks)? Answer: freeform Excalidraw with their tools and UI

