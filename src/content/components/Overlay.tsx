import {
  convertToExcalidrawElements,
  Excalidraw,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import { useEffect, useRef, useState } from "react";
import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { CaptureResult } from "../types";
import type { Mode } from "../hooks/useMode";
import type { SyncScrollTargetMode } from "../App";

interface OverlayProps {
  mode: Mode;
  syncScrollEnabled: boolean;
  syncScrollTargetMode: SyncScrollTargetMode;
  pendingCapture: CaptureResult | null;
  onCaptureInserted: () => void;
}

type ScrollTarget = Window | HTMLElement;
type ScrollPoint = { x: number; y: number };

function isWindowTarget(target: ScrollTarget): target is Window {
  return target === window;
}

function dataUrlToMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  return match?.[1] ?? "image/png";
}

function createFileId() {
  return `file-${crypto.randomUUID()}` as BinaryFileData["id"];
}

function isScrollableStyle(value: string) {
  return /(auto|scroll|overlay)/i.test(value);
}

function isElementScrollable(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const canScrollY =
    isScrollableStyle(style.overflowY) && element.scrollHeight > element.clientHeight;
  const canScrollX =
    isScrollableStyle(style.overflowX) && element.scrollWidth > element.clientWidth;
  return canScrollX || canScrollY;
}

function findNearestScrollableAncestor(target: EventTarget | null) {
  let node: Node | null = target instanceof Node ? target : null;

  while (node) {
    if (node instanceof HTMLElement && isElementScrollable(node)) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
}

function toScrollTarget(target: EventTarget | null): ScrollTarget {
  if (
    target === window ||
    target === document ||
    target === document.documentElement ||
    target === document.body
  ) {
    return window;
  }

  if (target instanceof HTMLElement) {
    if (isElementScrollable(target)) return target;
    return findNearestScrollableAncestor(target) ?? window;
  }

  return window;
}

function getScrollPosition(target: ScrollTarget): ScrollPoint {
  if (isWindowTarget(target)) {
    return { x: window.scrollX, y: window.scrollY };
  }

  return { x: target.scrollLeft, y: target.scrollTop };
}

function scrollTargetBy(target: ScrollTarget, deltaX: number, deltaY: number) {
  if (isWindowTarget(target)) {
    window.scrollBy({
      left: deltaX,
      top: deltaY,
      behavior: "auto",
    });
    return;
  }

  target.scrollBy({
    left: deltaX,
    top: deltaY,
    behavior: "auto",
  });
}

function isWindowScrollable() {
  const scrollingElement = document.scrollingElement;
  if (!scrollingElement) return false;
  return (
    scrollingElement.scrollHeight > scrollingElement.clientHeight ||
    scrollingElement.scrollWidth > scrollingElement.clientWidth
  );
}

function findBestScrollableElement() {
  const elements = document.body.querySelectorAll<HTMLElement>("*");
  let bestElement: HTMLElement | null = null;
  let bestScore = 0;

  for (const element of elements) {
    if (!isElementScrollable(element)) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const verticalRange = Math.max(0, element.scrollHeight - element.clientHeight);
    const horizontalRange = Math.max(0, element.scrollWidth - element.clientWidth);
    const score = verticalRange + horizontalRange;

    if (score > bestScore) {
      bestScore = score;
      bestElement = element;
    }
  }

  return bestElement;
}

export default function Overlay({
  mode,
  syncScrollEnabled,
  syncScrollTargetMode,
  pendingCapture,
  onCaptureInserted,
}: OverlayProps) {
  const isAnnotating = mode === "annotate";
  const isBrowseLikeMode = mode === "browse" || mode === "capture";
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const isSyncingFromCanvasRef = useRef(false);
  const isSyncingFromPageRef = useRef(false);
  const previousCanvasScrollRef = useRef<{ x: number; y: number } | null>(null);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);
  const activeScrollTargetRef = useRef<ScrollTarget>(window);
  const detectedScrollableTargetRef = useRef<HTMLElement | null>(null);
  const previousWindowScrollRef = useRef<ScrollPoint | null>(null);
  const previousElementScrollRef = useRef<WeakMap<HTMLElement, ScrollPoint>>(new WeakMap());
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
    activeScrollTargetRef.current = window;
    previousWindowScrollRef.current = getScrollPosition(window);

    const clearCanvasSyncFlag = () => {
      isSyncingFromCanvasRef.current = false;
    };
    const clearPageSyncFlag = () => {
      isSyncingFromPageRef.current = false;
    };
    const isEventInsideOverlay = (eventTarget: EventTarget | null) => {
      const overlayNode = overlayContainerRef.current;
      if (!overlayNode || !(eventTarget instanceof Node)) return false;
      return overlayNode.contains(eventTarget);
    };
    const getAutoPreferredTarget = () => {
      const cached = detectedScrollableTargetRef.current;
      if (cached && cached.isConnected && isElementScrollable(cached)) return cached;
      if (isWindowScrollable()) return window;

      const detected = findBestScrollableElement();
      detectedScrollableTargetRef.current = detected;
      return detected ?? window;
    };
    const resolveTarget = (eventTarget: EventTarget | null) =>
      syncScrollTargetMode === "auto" ? toScrollTarget(eventTarget) : window;
    const getPreviousScroll = (target: ScrollTarget) => {
      if (isWindowTarget(target)) return previousWindowScrollRef.current;
      return previousElementScrollRef.current.get(target) ?? null;
    };
    const setPreviousScroll = (target: ScrollTarget, scroll: ScrollPoint) => {
      if (isWindowTarget(target)) {
        previousWindowScrollRef.current = scroll;
        return;
      }
      previousElementScrollRef.current.set(target, scroll);
    };
    const updateActiveTargetFromInteraction = (eventTarget: EventTarget | null) => {
      if (syncScrollTargetMode === "auto" && isEventInsideOverlay(eventTarget)) {
        const preferredTarget = getAutoPreferredTarget();
        activeScrollTargetRef.current = preferredTarget;
        return preferredTarget;
      }

      const nextTarget = resolveTarget(eventTarget);
      activeScrollTargetRef.current = nextTarget;
      const previous = getPreviousScroll(nextTarget);
      if (!previous) {
        setPreviousScroll(nextTarget, getScrollPosition(nextTarget));
      }
      return nextTarget;
    };

    const unsubscribeScroll = api.onScrollChange((scrollX, scrollY, zoom) => {
      const previousCanvasScroll = previousCanvasScrollRef.current;
      previousCanvasScrollRef.current = { x: scrollX, y: scrollY };

      if (!previousCanvasScroll) return;
      if (isSyncingFromPageRef.current) return;

      const deltaSceneX = scrollX - previousCanvasScroll.x;
      const deltaSceneY = scrollY - previousCanvasScroll.y;

      if (deltaSceneX === 0 && deltaSceneY === 0) return;

      const target =
        syncScrollTargetMode === "auto"
          ? isWindowTarget(activeScrollTargetRef.current)
            ? getAutoPreferredTarget()
            : activeScrollTargetRef.current
          : window;
      activeScrollTargetRef.current = target;
      const requestedPageDeltaX = -(deltaSceneX * zoom.value);
      const requestedPageDeltaY = -(deltaSceneY * zoom.value);
      const pageScrollBefore = getScrollPosition(target);

      isSyncingFromCanvasRef.current = true;
      scrollTargetBy(target, requestedPageDeltaX, requestedPageDeltaY);

      if (canvasReconcileRafRef.current !== null) {
        window.cancelAnimationFrame(canvasReconcileRafRef.current);
      }
      canvasReconcileRafRef.current = window.requestAnimationFrame(() => {
        canvasReconcileRafRef.current = null;
        const pageScrollAfter = getScrollPosition(target);
        const actualPageDeltaX = pageScrollAfter.x - pageScrollBefore.x;
        const actualPageDeltaY = pageScrollAfter.y - pageScrollBefore.y;

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

        setPreviousScroll(target, pageScrollAfter);
        clearCanvasSyncFlag();
      });
    });

    const handleInteraction = (event: Event) => {
      updateActiveTargetFromInteraction(event.target);
    };

    const handleScroll = (event: Event) => {
      if (syncScrollTargetMode === "auto" && isEventInsideOverlay(event.target)) return;

      const target = resolveTarget(event.target);
      activeScrollTargetRef.current = target;
      if (!isWindowTarget(target)) {
        detectedScrollableTargetRef.current = target;
      }
      const previousTargetScroll = getPreviousScroll(target);
      const currentTargetScroll = getScrollPosition(target);
      setPreviousScroll(target, currentTargetScroll);

      if (!previousTargetScroll) return;
      if (isSyncingFromCanvasRef.current) return;

      const deltaX = currentTargetScroll.x - previousTargetScroll.x;
      const deltaY = currentTargetScroll.y - previousTargetScroll.y;
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

    document.addEventListener("pointerdown", handleInteraction, {
      capture: true,
      passive: true,
    });
    if (syncScrollTargetMode === "auto") {
      document.addEventListener("wheel", handleInteraction, {
        capture: true,
        passive: true,
      });
      document.addEventListener("scroll", handleScroll, {
        capture: true,
        passive: true,
      });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (canvasReconcileRafRef.current !== null) {
        window.cancelAnimationFrame(canvasReconcileRafRef.current);
        canvasReconcileRafRef.current = null;
      }
      unsubscribeScroll();
      document.removeEventListener("pointerdown", handleInteraction, true);
      if (syncScrollTargetMode === "auto") {
        document.removeEventListener("wheel", handleInteraction, true);
        document.removeEventListener("scroll", handleScroll, true);
      }
      window.removeEventListener("scroll", handleScroll);
      isSyncingFromCanvasRef.current = false;
      isSyncingFromPageRef.current = false;
      activeScrollTargetRef.current = window;
      detectedScrollableTargetRef.current = null;
      previousWindowScrollRef.current = null;
      previousElementScrollRef.current = new WeakMap();
    };
  }, [isApiReady, mode, syncScrollEnabled, syncScrollTargetMode]);

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
          setIsApiReady(Boolean(api));
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
