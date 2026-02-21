import { Excalidraw } from "@excalidraw/excalidraw";
import type { Mode } from "../hooks/useMode";

interface OverlayProps {
  mode: Mode;
}

export default function Overlay({ mode }: OverlayProps) {
  const isAnnotating = mode === "annotate";
  const isBrowseLikeMode = mode === "browse" || mode === "capture";

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
        

        .excalidraw-overlay--browse {
          display: none !important;
        }
      `}</style>
      <Excalidraw
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
