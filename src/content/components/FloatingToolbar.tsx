import { useCallback, useEffect, useRef, useState } from "react";
import { dragHandleStyle, minimizeButtonStyle, minimizedIconButtonStyle } from "./modeToggleStyles";

const Z_INDEX = 2147483647;

export interface ToolbarPosition {
  x: number;
  y: number;
}

interface FloatingToolbarProps {
  position: ToolbarPosition;
  onPositionChange: (pos: ToolbarPosition) => void;
  isMinimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  extensionIconUrl: string;
  children: React.ReactNode;
}

export default function FloatingToolbar({
  position,
  onPositionChange,
  isMinimized,
  onMinimizedChange,
  extensionIconUrl,
  children,
}: FloatingToolbarProps) {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, x: 0, y: 0 });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      setDragging(true);
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: position.x,
        y: position.y,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [position.x, position.y],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      const newX = Math.max(0, dragStart.current.x + dx);
      const newY = Math.max(0, dragStart.current.y + dy);
      onPositionChange({ x: newX, y: newY });
    },
    [dragging, onPositionChange],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  if (isMinimized) {
    return (
      <div
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          zIndex: Z_INDEX,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          gap: "0",
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          style={{
            ...dragHandleStyle,
            cursor: dragging ? "grabbing" : "grab",
          }}
          title="Drag to move"
          aria-label="Drag to move"
        >
          <span style={{ fontSize: "12px", lineHeight: 1 }}>⋮⋮</span>
        </div>
        <button
          type="button"
          onClick={() => onMinimizedChange(false)}
          style={minimizedIconButtonStyle}
          title="Open mode selector"
        >
          <img src={extensionIconUrl} alt="" width={24} height={24} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: Z_INDEX,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: "0",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.preventDefault();
        }}
        style={{
          ...dragHandleStyle,
          cursor: dragging ? "grabbing" : "grab",
        }}
        title="Drag to move"
        aria-label="Drag to move toolbar"
      >
        <span style={{ fontSize: "14px", lineHeight: 1 }}>⋮⋮</span>
      </div>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", minWidth: 0 }}>
        {children}
        <button
          type="button"
          onClick={() => onMinimizedChange(true)}
          style={minimizeButtonStyle}
          title="Minimize"
          aria-label="Minimize toolbar"
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>−</span>
        </button>
      </div>
    </div>
  );
}
