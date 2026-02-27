import { useEffect, useRef, useState } from "react";
import CaptureSelection from "./components/CaptureSelection";
import FloatingToolbar, { type ToolbarPosition } from "./components/FloatingToolbar";
import Overlay from "./components/Overlay";
import ModeToggle from "./components/ModeToggle";
import { useMode } from "./hooks/useMode";
import type {
  CaptureResult,
  ScrollableTargetOption,
  SyncScrollTargetMode,
} from "./types";
import { saveScene, loadScene } from "./utils/sceneStorage";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const STORAGE_KEY_POSITION = "excalidraw-annotate-toolbar-position";
const STORAGE_KEY_MINIMIZED = "excalidraw-annotate-toolbar-minimized";

function getDefaultPosition(): ToolbarPosition {
  if (typeof window === "undefined")
    return { x: 12, y: 12 };
  return {
    x: Math.max(0, window.innerWidth - 340),
    y: 12,
  };
}

export default function App() {
  const { mode, setMode } = useMode();
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(true);
  const [syncScrollTargetMode, setSyncScrollTargetMode] =
    useState<SyncScrollTargetMode>("auto");
  const [scrollableTargetOptions, setScrollableTargetOptions] = useState<
    ScrollableTargetOption[]
  >([]);
  const [pendingCapture, setPendingCapture] = useState<CaptureResult | null>(
    null,
  );
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>(getDefaultPosition);
  const [toolbarMinimized, setToolbarMinimized] = useState(false);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [excalidrawApiReady, setExcalidrawApiReady] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY_POSITION, STORAGE_KEY_MINIMIZED], (result) => {
      if (result[STORAGE_KEY_POSITION] != null) {
        const pos = result[STORAGE_KEY_POSITION] as ToolbarPosition;
        if (typeof pos.x === "number" && typeof pos.y === "number")
          setToolbarPosition(pos);
      }
      if (result[STORAGE_KEY_MINIMIZED] != null)
        setToolbarMinimized(Boolean(result[STORAGE_KEY_MINIMIZED]));
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ [STORAGE_KEY_POSITION]: toolbarPosition });
  }, [toolbarPosition]);

  useEffect(() => {
    chrome.storage.local.set({ [STORAGE_KEY_MINIMIZED]: toolbarMinimized });
  }, [toolbarMinimized]);

  useEffect(() => {
    const listener: Parameters<
      typeof chrome.runtime.onMessage.addListener
    >[0] = (message) => {
      if (message?.type !== "TOGGLE_EXTENSION") return;
      setMode((prev) => (prev === "off" ? "annotate" : "off"));
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setMode]);

  if (mode === "off") return null;

  const extensionIconUrl = chrome.runtime.getURL("icons/icon48.png");

  return (
    <>
      <FloatingToolbar
        position={toolbarPosition}
        onPositionChange={setToolbarPosition}
        isMinimized={toolbarMinimized}
        onMinimizedChange={setToolbarMinimized}
        extensionIconUrl={extensionIconUrl}
      >
        <ModeToggle
          mode={mode}
          setMode={setMode}
          syncScrollEnabled={syncScrollEnabled}
          setSyncScrollEnabled={setSyncScrollEnabled}
          syncScrollTargetMode={syncScrollTargetMode}
          setSyncScrollTargetMode={setSyncScrollTargetMode}
          scrollableTargetOptions={scrollableTargetOptions}
          onSave={() => saveScene(excalidrawApiRef.current)}
          onLoad={() => loadScene(excalidrawApiRef.current)}
          isSaveLoadDisabled={!excalidrawApiReady}
        />
      </FloatingToolbar>
      <Overlay
        mode={mode}
        syncScrollEnabled={syncScrollEnabled}
        syncScrollTargetMode={syncScrollTargetMode}
        onScrollableTargetsChange={setScrollableTargetOptions}
        pendingCapture={pendingCapture}
        onCaptureInserted={() => setPendingCapture(null)}
        excalidrawApiRef={excalidrawApiRef}
        onApiReady={setExcalidrawApiReady}
      />
      {mode === "capture" && (
        <CaptureSelection
          onDone={(result) => {
            if (result) {
              setPendingCapture(result);
            }
            setMode("annotate");
          }}
        />
      )}
    </>
  );
}
