import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { Mode, ScrollPoint, ScrollTarget, SyncScrollTargetMode } from "../types";
import { isElementScrollable } from "../utils/elementUtils";
import {
  findBestScrollableElement,
  getScrollPosition,
  isWindowScrollable,
  isWindowTarget,
  scrollTargetBy,
  toScrollTarget,
} from "../utils/scrollUtils";

function isElementTargetMode(mode: SyncScrollTargetMode): mode is `element:${string}` {
  return mode.startsWith("element:");
}

function getElementModeId(mode: `element:${string}`) {
  return mode.slice("element:".length);
}

interface UseScrollSyncOptions {
  apiRef: MutableRefObject<ExcalidrawImperativeAPI | null>;
  isApiReady: boolean;
  mode: Mode;
  syncScrollEnabled: boolean;
  syncScrollTargetMode: SyncScrollTargetMode;
  overlayContainerRef: MutableRefObject<HTMLDivElement | null>;
  selectableTargetsRef: MutableRefObject<Map<string, HTMLElement>>;
}

export function useScrollSync({
  apiRef,
  isApiReady,
  mode,
  syncScrollEnabled,
  syncScrollTargetMode,
  overlayContainerRef,
  selectableTargetsRef,
}: UseScrollSyncOptions) {
  const isSyncingFromCanvasRef = useRef(false);
  const isSyncingFromPageRef = useRef(false);
  const previousCanvasScrollRef = useRef<{ x: number; y: number } | null>(null);
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

    const api = apiRef.current;
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
    const getExplicitTarget = () => {
      if (!isElementTargetMode(syncScrollTargetMode)) return null;
      const elementId = getElementModeId(syncScrollTargetMode);
      const target = selectableTargetsRef.current.get(elementId);
      if (!target || !target.isConnected || !isElementScrollable(target)) return null;
      return target;
    };
    const getConfiguredTarget = () => {
      if (syncScrollTargetMode === "auto") return getAutoPreferredTarget();
      if (syncScrollTargetMode === "window") return window;
      return getExplicitTarget() ?? window;
    };
    const resolveTarget = (eventTarget: EventTarget | null) => {
      if (syncScrollTargetMode === "auto") return toScrollTarget(eventTarget);
      return getConfiguredTarget();
    };
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
      if (syncScrollTargetMode !== "auto") {
        const configuredTarget = getConfiguredTarget();
        activeScrollTargetRef.current = configuredTarget;
        return configuredTarget;
      }

      if (isEventInsideOverlay(eventTarget)) {
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
          : getConfiguredTarget();
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

      if (isElementTargetMode(syncScrollTargetMode)) {
        const explicitTarget = getExplicitTarget();
        if (explicitTarget && event.target !== explicitTarget) return;
        if (
          !explicitTarget &&
          event.target !== window &&
          event.target !== document &&
          event.target !== document.documentElement &&
          event.target !== document.body
        ) {
          return;
        }
      }

      const target =
        syncScrollTargetMode === "auto" ? resolveTarget(event.target) : getConfiguredTarget();
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
    }
    if (syncScrollTargetMode !== "window") {
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
      }
      if (syncScrollTargetMode !== "window") {
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
  }, [
    apiRef,
    isApiReady,
    mode,
    overlayContainerRef,
    selectableTargetsRef,
    syncScrollEnabled,
    syncScrollTargetMode,
  ]);
}
