import { Excalidraw } from "@excalidraw/excalidraw";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useScrollableTargets } from "../hooks/useScrollableTargets";
import { useScrollSync } from "../hooks/useScrollSync";
import type {
  CaptureResult,
  Mode,
  ScrollableTargetOption,
  SyncScrollTargetMode,
} from "../types";
import {
  buildCaptureGroupElements,
  createCaptureFileData,
} from "../utils/captureUtils";

interface OverlayProps {
  mode: Mode;
  syncScrollEnabled: boolean;
  syncScrollTargetMode: SyncScrollTargetMode;
  onScrollableTargetsChange: (targets: ScrollableTargetOption[]) => void;
  pendingCapture: CaptureResult | null;
  onCaptureInserted: () => void;
  excalidrawApiRef?: MutableRefObject<ExcalidrawImperativeAPI | null>;
  onApiReady?: (ready: boolean) => void;
}

export default function Overlay({
  mode,
  syncScrollEnabled,
  syncScrollTargetMode,
  onScrollableTargetsChange,
  pendingCapture,
  onCaptureInserted,
  excalidrawApiRef: externalApiRef,
  onApiReady,
}: OverlayProps) {
  const isAnnotating = mode === "annotate";
  const isBrowseLikeMode = mode === "browse" || mode === "capture";
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);

  const { selectableTargetsRef } = useScrollableTargets({
    overlayContainerRef,
    onScrollableTargetsChange,
  });

  useEffect(() => {
    return () => {
      if (externalApiRef) externalApiRef.current = null;
      onApiReady?.(false);
    };
  }, [externalApiRef, onApiReady]);

  // Scroll sync keeps separate refs and guards inside the hook to avoid
  // canvas<->page feedback loops while preserving the existing behavior.
  useScrollSync({
    apiRef: excalidrawApiRef,
    isApiReady,
    mode,
    syncScrollEnabled,
    syncScrollTargetMode,
    overlayContainerRef,
    selectableTargetsRef,
  });

  useEffect(() => {
    if (mode !== "annotate" || !pendingCapture) return;
    const api = excalidrawApiRef.current;
    if (!api) return;

    try {
      const fileData = createCaptureFileData(pendingCapture.dataUrl);
      const { groupedImageElement, groupedBorderElement } = buildCaptureGroupElements(
        pendingCapture,
        fileData.id,
        api.getAppState(),
      );

      api.addFiles([fileData]);

      const existingElements = api.getSceneElementsIncludingDeleted();
      api.updateScene({
        elements: [...existingElements, groupedImageElement, groupedBorderElement],
        appState: {
          selectedElementIds: {
            [groupedImageElement.id]: true,
            [groupedBorderElement.id]: true,
          },
        },
      });
    } catch (error) {
      console.error("Failed to insert capture into scene:", error);
    } finally {
      onCaptureInserted();
    }
  }, [mode, onCaptureInserted, pendingCapture]);

  return (
    <div
      ref={overlayContainerRef}
      className={isBrowseLikeMode ? "excalidraw-overlay--browse" : undefined}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: isAnnotating ? "auto" : "none",
        opacity: isBrowseLikeMode ? 0.45 : 1,
        transition: "opacity 150ms ease",
      }}
    >
      <style>{`
        .excalidraw.excalidraw-modal-container {
          z-index: 2147483647 !important;
        }
        .excalidraw-overlay--browse {
          display: none !important;
        }
      `}</style>
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawApiRef.current = api;
          if (externalApiRef) externalApiRef.current = api;
          const ready = Boolean(api);
          setIsApiReady(ready);
          onApiReady?.(ready);
        }}
        initialData={{
          appState: {
            viewBackgroundColor: "transparent",
          },
          elements: [],
        }}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            export: { saveFileToDisk: true },
          },
        }}
      />
    </div>
  );
}
