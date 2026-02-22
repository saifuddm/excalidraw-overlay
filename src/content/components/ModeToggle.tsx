import type { Dispatch, SetStateAction } from "react";
import type { Mode } from "../hooks/useMode";
import type { SyncScrollTargetMode } from "../App";

interface ModeToggleProps {
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  syncScrollEnabled: boolean;
  setSyncScrollEnabled: Dispatch<SetStateAction<boolean>>;
  syncScrollTargetMode: SyncScrollTargetMode;
  setSyncScrollTargetMode: Dispatch<SetStateAction<SyncScrollTargetMode>>;
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

export default function ModeToggle({
  mode,
  setMode,
  syncScrollEnabled,
  setSyncScrollEnabled,
  syncScrollTargetMode,
  setSyncScrollTargetMode,
}: ModeToggleProps) {
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
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          color: "#e4e4e7",
          fontSize: "12px",
          paddingLeft: "6px",
          borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        <input
          type="checkbox"
          checked={syncScrollEnabled}
          onChange={(event) => setSyncScrollEnabled(event.target.checked)}
          style={{ margin: 0 }}
        />
        Sync scroll
      </label>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          color: "#e4e4e7",
          fontSize: "12px",
          paddingLeft: "6px",
          borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        Target
        <select
          value={syncScrollTargetMode}
          onChange={(event) =>
            setSyncScrollTargetMode(event.target.value as SyncScrollTargetMode)
          }
          style={{
            fontSize: "12px",
            background: "#27272a",
            color: "#e4e4e7",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "4px",
            padding: "2px 4px",
          }}
        >
          <option value="auto">Auto</option>
          <option value="window">Window</option>
        </select>
      </label>
    </div>
  );
}
