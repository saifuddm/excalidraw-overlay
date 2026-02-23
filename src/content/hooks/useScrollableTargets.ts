import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { ScrollableTargetOption } from "../types";
import {
  getElementTargetId,
  getElementTargetLabel,
  isElementScrollable,
} from "../utils/elementUtils";

interface UseScrollableTargetsOptions {
  overlayContainerRef: MutableRefObject<HTMLDivElement | null>;
  onScrollableTargetsChange: (targets: ScrollableTargetOption[]) => void;
}

export function useScrollableTargets({
  overlayContainerRef,
  onScrollableTargetsChange,
}: UseScrollableTargetsOptions) {
  const selectableTargetsRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const scheduleRef = { timeoutId: null as number | null };

    const scanScrollableTargets = () => {
      const overlayNode = overlayContainerRef.current;
      const allElements = document.body.querySelectorAll<HTMLElement>("*");
      const nextMap = new Map<string, HTMLElement>();
      const nextOptions: ScrollableTargetOption[] = [];

      for (const element of allElements) {
        if (overlayNode?.contains(element)) continue;
        if (!isElementScrollable(element)) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const id = getElementTargetId(element);
        if (nextMap.has(id)) continue;

        nextMap.set(id, element);
        nextOptions.push({
          id,
          label: getElementTargetLabel(element),
        });
      }

      selectableTargetsRef.current = nextMap;
      onScrollableTargetsChange(nextOptions);
    };

    const scheduleScan = () => {
      if (scheduleRef.timeoutId !== null) {
        window.clearTimeout(scheduleRef.timeoutId);
      }
      scheduleRef.timeoutId = window.setTimeout(() => {
        scheduleRef.timeoutId = null;
        scanScrollableTargets();
      }, 150);
    };

    scanScrollableTargets();

    const observer = new MutationObserver(() => {
      scheduleScan();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "id", "aria-label", "role"],
    });
    window.addEventListener("resize", scheduleScan);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleScan);
      if (scheduleRef.timeoutId !== null) {
        window.clearTimeout(scheduleRef.timeoutId);
      }
      selectableTargetsRef.current = new Map();
      onScrollableTargetsChange([]);
    };
  }, [onScrollableTargetsChange, overlayContainerRef]);

  return { selectableTargetsRef };
}
