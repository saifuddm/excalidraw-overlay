import {
  convertToExcalidrawElements,
  Excalidraw,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import { useEffect, useRef } from "react";
import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { CaptureResult } from "../types";
import type { Mode } from "../hooks/useMode";

interface OverlayProps {
  mode: Mode;
  syncScrollEnabled: boolean;
  pendingCapture: CaptureResult | null;
  onCaptureInserted: () => void;
}

function dataUrlToMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  return match?.[1] ?? "image/png";
}

function createFileId() {
  return `file-${crypto.randomUUID()}` as BinaryFileData["id"];
}

export default function Overlay({
  mode,
  syncScrollEnabled,
  pendingCapture,
  onCaptureInserted,
}: OverlayProps) {
  const isAnnotating = mode === "annotate";
  const isBrowseLikeMode = mode === "browse" || mode === "capture";
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isSyncingFromCanvasRef = useRef(false);
  const isSyncingFromPageRef = useRef(false);
  const previousCanvasScrollRef = useRef<{ x: number; y: number } | null>(null);
  const previousWindowScrollRef = useRef<{ x: number; y: number } | null>(null);
  const canvasReconcileRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!syncScrollEnabled || (mode !== "annotate" && mode !== "browse")) {
      previousCanvasScrollRef.current = null;
      previousWindowScrollRef.current = null;
      return;
    }

    const api = excalidrawApiRef.current;
    if (!api) return;

    const initialAppState = api.getAppState();
    previousCanvasScrollRef.current = {
      x: initialAppState.scrollX,
      y: initialAppState.scrollY,
    };
    previousWindowScrollRef.current = {
      x: window.scrollX,
      y: window.scrollY,
    };

    const clearCanvasSyncFlag = () => {
      isSyncingFromCanvasRef.current = false;
    };
    const clearPageSyncFlag = () => {
      isSyncingFromPageRef.current = false;
    };

    const unsubscribeScroll = api.onScrollChange((scrollX, scrollY, zoom) => {
      const previousCanvasScroll = previousCanvasScrollRef.current;
      previousCanvasScrollRef.current = { x: scrollX, y: scrollY };

      if (!previousCanvasScroll) return;
      if (isSyncingFromPageRef.current) return;

      const deltaSceneX = scrollX - previousCanvasScroll.x;
      const deltaSceneY = scrollY - previousCanvasScroll.y;

      if (deltaSceneX === 0 && deltaSceneY === 0) return;

      const requestedPageDeltaX = -(deltaSceneX * zoom.value);
      const requestedPageDeltaY = -(deltaSceneY * zoom.value);
      const pageScrollBefore = { x: window.scrollX, y: window.scrollY };

      isSyncingFromCanvasRef.current = true;
      window.scrollBy({
        left: requestedPageDeltaX,
        top: requestedPageDeltaY,
        behavior: "auto",
      });

      if (canvasReconcileRafRef.current !== null) {
        window.cancelAnimationFrame(canvasReconcileRafRef.current);
      }
      canvasReconcileRafRef.current = window.requestAnimationFrame(() => {
        canvasReconcileRafRef.current = null;
        const actualPageDeltaX = window.scrollX - pageScrollBefore.x;
        const actualPageDeltaY = window.scrollY - pageScrollBefore.y;

        const unappliedPageDeltaX = requestedPageDeltaX - actualPageDeltaX;
        const unappliedPageDeltaY = requestedPageDeltaY - actualPageDeltaY;

        if (unappliedPageDeltaX !== 0 || unappliedPageDeltaY !== 0) {
          const correctionSceneDeltaX = -(unappliedPageDeltaX / zoom.value);
          const correctionSceneDeltaY = -(unappliedPageDeltaY / zoom.value);
          const correctedScrollX = scrollX - correctionSceneDeltaX;
          const correctedScrollY = scrollY - correctionSceneDeltaY;

          isSyncingFromPageRef.current = true;
          api.updateScene({
            appState: {
              scrollX: correctedScrollX,
              scrollY: correctedScrollY,
            },
          });
          previousCanvasScrollRef.current = {
            x: correctedScrollX,
            y: correctedScrollY,
          };
          window.setTimeout(clearPageSyncFlag, 0);
        }

        previousWindowScrollRef.current = {
          x: window.scrollX,
          y: window.scrollY,
        };
        clearCanvasSyncFlag();
      });
    });

    const handleWindowScroll = () => {
      const previousWindowScroll = previousWindowScrollRef.current;
      const currentWindowScroll = { x: window.scrollX, y: window.scrollY };
      previousWindowScrollRef.current = currentWindowScroll;

      if (!previousWindowScroll) return;
      if (isSyncingFromCanvasRef.current) return;

      const deltaX = currentWindowScroll.x - previousWindowScroll.x;
      const deltaY = currentWindowScroll.y - previousWindowScroll.y;
      if (deltaX === 0 && deltaY === 0) return;

      const appState = api.getAppState();
      const zoom = appState.zoom.value || 1;
      const nextScrollX = appState.scrollX - deltaX / zoom;
      const nextScrollY = appState.scrollY - deltaY / zoom;

      isSyncingFromPageRef.current = true;
      api.updateScene({
        appState: {
          scrollX: nextScrollX,
          scrollY: nextScrollY,
        },
      });
      previousCanvasScrollRef.current = { x: nextScrollX, y: nextScrollY };
      window.setTimeout(clearPageSyncFlag, 0);
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      if (canvasReconcileRafRef.current !== null) {
        window.cancelAnimationFrame(canvasReconcileRafRef.current);
        canvasReconcileRafRef.current = null;
      }
      unsubscribeScroll();
      window.removeEventListener("scroll", handleWindowScroll);
      isSyncingFromCanvasRef.current = false;
      isSyncingFromPageRef.current = false;
    };
  }, [mode, syncScrollEnabled]);

  useEffect(() => {
    if (mode !== "annotate" || !pendingCapture) return;
    const api = excalidrawApiRef.current;
    if (!api) return;

    try {
      const fileId = createFileId();
      const fileData: BinaryFileData = {
        id: fileId,
        dataURL: pendingCapture.dataUrl as BinaryFileData["dataURL"],
        mimeType: dataUrlToMimeType(pendingCapture.dataUrl) as BinaryFileData["mimeType"],
        created: Date.now(),
      };

      api.addFiles([fileData]);

      const appState = api.getAppState();
      const viewportPoint = {
        zoom: appState.zoom,
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      };

      const topLeft = viewportCoordsToSceneCoords(
        {
          clientX: pendingCapture.rect.left,
          clientY: pendingCapture.rect.top,
        },
        viewportPoint
      );
      const bottomRight = viewportCoordsToSceneCoords(
        {
          clientX: pendingCapture.rect.left + pendingCapture.rect.width,
          clientY: pendingCapture.rect.top + pendingCapture.rect.height,
        },
        viewportPoint
      );

      const width = Math.max(1, bottomRight.x - topLeft.x);
      const height = Math.max(1, bottomRight.y - topLeft.y);

      const [imageElement] = convertToExcalidrawElements([
        {
          type: "image",
          fileId,
          x: topLeft.x,
          y: topLeft.y,
          width,
          height,
        },
      ]);
      const [borderElement] = convertToExcalidrawElements([
        {
          type: "rectangle",
          x: topLeft.x,
          y: topLeft.y,
          width,
          height,
          strokeColor: "#e03131",
          backgroundColor: "transparent",
          strokeWidth: 2,
          opacity: 50,
          roughness: 0,
        },
      ]);
      const captureGroupId = `group-${crypto.randomUUID()}`;
      const groupedImageElement = {
        ...imageElement,
        groupIds: [captureGroupId],
      };
      const groupedBorderElement = {
        ...borderElement,
        groupIds: [captureGroupId],
      };

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
