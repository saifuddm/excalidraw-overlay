import { useEffect, useState } from "react";
import CaptureSelection from "./components/CaptureSelection";
import Overlay from "./components/Overlay";
import ModeToggle from "./components/ModeToggle";
import { useMode } from "./hooks/useMode";
import type { CaptureResult } from "./types";

export type SyncScrollTargetMode = "auto" | "window" | `element:${string}`;

export interface ScrollableTargetOption {
  id: string;
  label: string;
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

  return (
    <>
      <ModeToggle
        mode={mode}
        setMode={setMode}
        syncScrollEnabled={syncScrollEnabled}
        setSyncScrollEnabled={setSyncScrollEnabled}
        syncScrollTargetMode={syncScrollTargetMode}
        setSyncScrollTargetMode={setSyncScrollTargetMode}
        scrollableTargetOptions={scrollableTargetOptions}
      />
      <Overlay
        mode={mode}
        syncScrollEnabled={syncScrollEnabled}
        syncScrollTargetMode={syncScrollTargetMode}
        onScrollableTargetsChange={setScrollableTargetOptions}
        pendingCapture={pendingCapture}
        onCaptureInserted={() => setPendingCapture(null)}
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
