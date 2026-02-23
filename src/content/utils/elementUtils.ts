function isScrollableStyle(value: string) {
  return /(auto|scroll|overlay)/i.test(value);
}

export function isElementScrollable(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const canScrollY =
    isScrollableStyle(style.overflowY) && element.scrollHeight > element.clientHeight;
  const canScrollX =
    isScrollableStyle(style.overflowX) && element.scrollWidth > element.clientWidth;
  return canScrollX || canScrollY;
}

function getElementIndexWithinType(element: HTMLElement) {
  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }
    sibling = sibling.previousElementSibling;
  }
  return index;
}

export function getElementTargetId(element: HTMLElement) {
  const segments: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;
  while (current && current !== document.body && depth < 8) {
    const tag = current.tagName.toLowerCase();
    const id = current.id.trim();
    if (id) {
      segments.unshift(`${tag}#${id}`);
      break;
    }
    const index = getElementIndexWithinType(current);
    segments.unshift(`${tag}:nth-of-type(${index})`);
    current = current.parentElement;
    depth += 1;
  }
  segments.unshift("body");
  return segments.join(">");
}

export function getElementTargetLabel(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  const id = element.id.trim();
  const role = element.getAttribute("role")?.trim();
  const className = element.className.trim().split(/\s+/).filter(Boolean)[0];
  const width = Math.round(element.clientWidth);
  const height = Math.round(element.clientHeight);

  if (ariaLabel) return `${ariaLabel} (${tag}, ${width}x${height})`;
  if (id) return `#${id} (${tag}, ${width}x${height})`;
  if (role) return `${role} (${tag}, ${width}x${height})`;
  if (className) return `.${className} (${tag}, ${width}x${height})`;
  return `${tag} (${width}x${height})`;
}

export function findNearestScrollableAncestor(target: EventTarget | null) {
  let node: Node | null = target instanceof Node ? target : null;

  while (node) {
    if (node instanceof HTMLElement && isElementScrollable(node)) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
}
