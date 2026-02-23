import type { Dispatch, SetStateAction } from "react";
import type {
  Mode,
  ScrollableTargetOption,
  SyncScrollTargetMode,
} from "../types";
import {
  checkboxLabelStyle,
  getModeButtonStyle,
  modeButtonRowStyle,
  modeControlsColumnStyle,
  modeToggleContainerStyle,
  offButtonStyle,
  targetLabelStyle,
  targetSelectStyle,
} from "./modeToggleStyles";

interface ModeToggleProps {
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  syncScrollEnabled: boolean;
  setSyncScrollEnabled: Dispatch<SetStateAction<boolean>>;
  syncScrollTargetMode: SyncScrollTargetMode;
  setSyncScrollTargetMode: Dispatch<SetStateAction<SyncScrollTargetMode>>;
  scrollableTargetOptions: ScrollableTargetOption[];
}

export default function ModeToggle({
  mode,
  setMode,
  syncScrollEnabled,
  setSyncScrollEnabled,
  syncScrollTargetMode,
  setSyncScrollTargetMode,
  scrollableTargetOptions,
}: ModeToggleProps) {
  const hasSelectedElementMode = syncScrollTargetMode.startsWith("element:");
  const selectedElementId = hasSelectedElementMode
    ? syncScrollTargetMode.slice("element:".length)
    : null;
  const hasSelectedElement = selectedElementId
    ? scrollableTargetOptions.some((option) => option.id === selectedElementId)
    : true;

  return (
    <div style={modeToggleContainerStyle}>
      <div style={modeButtonRowStyle}>
        <button
          type="button"
          onClick={() => setMode("browse")}
          style={getModeButtonStyle(mode === "browse")}
        >
          Browse
        </button>
        <button
          type="button"
          onClick={() => setMode("annotate")}
          style={getModeButtonStyle(mode === "annotate")}
        >
          Annotate
        </button>
        {(mode === "annotate" || mode === "capture") && (
          <button
            type="button"
            onClick={() => setMode("capture")}
            style={getModeButtonStyle(mode === "capture")}
          >
            Capture
          </button>
        )}
        <button type="button" onClick={() => setMode("off")} style={offButtonStyle}>
          Off
        </button>
      </div>
      <div style={modeControlsColumnStyle}>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={syncScrollEnabled}
            onChange={(event) => setSyncScrollEnabled(event.target.checked)}
            style={{ margin: 0 }}
          />
          Sync scroll
        </label>
        <label style={targetLabelStyle}>
          Target
          <select
            value={syncScrollTargetMode}
            onChange={(event) =>
              setSyncScrollTargetMode(
                event.target.value as SyncScrollTargetMode,
              )
            }
            style={targetSelectStyle}
          >
            <option value="auto">Auto</option>
            <option value="window">Window</option>
            {scrollableTargetOptions.map((option) => (
              <option key={option.id} value={`element:${option.id}`}>
                {option.label}
              </option>
            ))}
            {hasSelectedElementMode &&
              !hasSelectedElement &&
              selectedElementId && (
                <option value={syncScrollTargetMode}>
                  Unavailable target ({selectedElementId})
                </option>
              )}
          </select>
        </label>
      </div>
    </div>
  );
}
