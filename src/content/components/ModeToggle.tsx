import type { Dispatch, SetStateAction } from "react";
import type { Mode } from "../hooks/useMode";

interface ModeToggleProps {
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
}

const buttonBaseStyle = {
  padding: "6px 10px",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  cursor: "pointer",
  fontSize: "12px",
  lineHeight: 1.1,
} as const;

export default function ModeToggle({ mode, setMode }: ModeToggleProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        background: "rgba(24, 24, 27, 0.96)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        padding: "6px",
        borderRadius: "10px",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
        pointerEvents: "auto",
        userSelect: "none",
      }}
    >
      <button
        type="button"
        onClick={() => setMode("browse")}
        style={{
          ...buttonBaseStyle,
          background: mode === "browse" ? "#4f46e5" : "#3f3f46",
        }}
      >
        Browse
      </button>
      <button
        type="button"
        onClick={() => setMode("annotate")}
        style={{
          ...buttonBaseStyle,
          background: mode === "annotate" ? "#4f46e5" : "#3f3f46",
        }}
      >
        Annotate
      </button>
      {(mode === "annotate" || mode === "capture") && (
        <button
          type="button"
          onClick={() => setMode("capture")}
          style={{
            ...buttonBaseStyle,
            background: mode === "capture" ? "#4f46e5" : "#3f3f46",
          }}
        >
          Capture
        </button>
      )}
      <button
        type="button"
        onClick={() => setMode("off")}
        style={{
          ...buttonBaseStyle,
          background: "#b91c1c",
        }}
      >
        Off
      </button>
    </div>
  );
}
