import { useMemo, useState } from "react";
import type { CaptureResult, SelectionRect } from "../types";

interface CaptureSelectionProps {
  onDone: (result?: CaptureResult) => void;
}

function normalizeRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): SelectionRect {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  return { left, top, width, height };
}

export default function CaptureSelection({ onDone }: CaptureSelectionProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const selectionRect = useMemo(() => {
    if (!start || !current) return null;
    return normalizeRect(start.x, start.y, current.x, current.y);
  }, [start, current]);

  const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setStart({ x: event.clientX, y: event.clientY });
    setCurrent({ x: event.clientX, y: event.clientY });
  };

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!start) return;
    event.preventDefault();
    setCurrent({ x: event.clientX, y: event.clientY });
  };

  const handleMouseUp: React.MouseEventHandler<HTMLDivElement> = async (
    event,
  ) => {
    if (!start) return;
    event.preventDefault();

    const rect = normalizeRect(start.x, start.y, event.clientX, event.clientY);
    setStart(null);
    setCurrent(null);

    if (rect.width < 4 || rect.height < 4) {
      onDone();
      return;
    }

    let captureResult: CaptureResult | undefined;

    try {
      setIsCapturing(true);
      const response = (await chrome.runtime.sendMessage({
        type: "CAPTURE_VISIBLE_TAB",
        region: rect,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      })) as { dataUrl?: string; error?: string };

      if (response?.error || !response?.dataUrl) {
        throw new Error(response?.error ?? "Capture failed.");
      }
      captureResult = {
        dataUrl: response.dataUrl,
        rect,
      };
    } catch (error) {
      console.error("Capture selection failed:", error);
    } finally {
      setIsCapturing(false);
      onDone(captureResult);
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        cursor: "crosshair",
        pointerEvents: "auto",
        background: "rgba(17, 24, 39, 0.08)",
      }}
    >
      {selectionRect && (
        <div
          style={{
            position: "fixed",
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
            border: "2px solid #4f46e5",
            background: "rgba(79, 70, 229, 0.18)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
      )}
      {isCapturing && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: "16px",
            transform: "translateX(-50%)",
            padding: "6px 10px",
            borderRadius: "8px",
            background: "rgba(17, 24, 39, 0.9)",
            color: "#fff",
            fontSize: "12px",
            fontFamily: "system-ui, sans-serif",
            pointerEvents: "none",
          }}
        >
          Capturing...
        </div>
      )}
    </div>
  );
}
