import type { ScrollPoint, ScrollTarget } from "../types";
import { findNearestScrollableAncestor, isElementScrollable } from "./elementUtils";

export function isWindowTarget(target: ScrollTarget): target is Window {
  return target === window;
}

export function toScrollTarget(target: EventTarget | null): ScrollTarget {
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

export function getScrollPosition(target: ScrollTarget): ScrollPoint {
  if (isWindowTarget(target)) {
    return { x: window.scrollX, y: window.scrollY };
  }

  return { x: target.scrollLeft, y: target.scrollTop };
}

export function scrollTargetBy(target: ScrollTarget, deltaX: number, deltaY: number) {
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

export function isWindowScrollable() {
  const scrollingElement = document.scrollingElement;
  if (!scrollingElement) return false;
  return (
    scrollingElement.scrollHeight > scrollingElement.clientHeight ||
    scrollingElement.scrollWidth > scrollingElement.clientWidth
  );
}

export function findBestScrollableElement() {
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
