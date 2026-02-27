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

const MODE_SHORTCUTS: Record<Exclude<Mode, "off">, string> = {
  browse: "Alt+B",
  annotate: "Alt+A",
  capture: "Alt+C",
};

interface ModeToggleProps {
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  syncScrollEnabled: boolean;
  setSyncScrollEnabled: Dispatch<SetStateAction<boolean>>;
  syncScrollTargetMode: SyncScrollTargetMode;
  setSyncScrollTargetMode: Dispatch<SetStateAction<SyncScrollTargetMode>>;
  scrollableTargetOptions: ScrollableTargetOption[];
  onSave?: () => void;
  onLoad?: () => void;
  isSaveLoadDisabled?: boolean;
}

export default function ModeToggle({
  mode,
  setMode,
  syncScrollEnabled,
  setSyncScrollEnabled,
  syncScrollTargetMode,
  setSyncScrollTargetMode,
  scrollableTargetOptions,
  onSave,
  onLoad,
  isSaveLoadDisabled = false,
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
          <span>Browse</span>
          <span style={{ fontSize: "10px", opacity: 0.85 }}>{MODE_SHORTCUTS.browse}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("annotate")}
          style={getModeButtonStyle(mode === "annotate")}
        >
          <span>Annotate</span>
          <span style={{ fontSize: "10px", opacity: 0.85 }}>{MODE_SHORTCUTS.annotate}</span>
        </button>
        {(mode === "annotate" || mode === "capture") && (
          <button
            type="button"
            onClick={() => setMode("capture")}
            style={getModeButtonStyle(mode === "capture")}
          >
            <span>Capture</span>
            <span style={{ fontSize: "10px", opacity: 0.85 }}>{MODE_SHORTCUTS.capture}</span>
          </button>
        )}
        <button type="button" onClick={() => setMode("off")} style={offButtonStyle}>
          <span>Off</span>
        </button>
      </div>
      {(onSave != null || onLoad != null) && (
        <div style={modeButtonRowStyle}>
          {onSave != null && (
            <button
              type="button"
              onClick={onSave}
              disabled={mode !== "annotate" || isSaveLoadDisabled}
              style={getModeButtonStyle(false)}
              title="Save scene"
            >
              Save
            </button>
          )}
          {onLoad != null && (
            <button
              type="button"
              onClick={onLoad}
              disabled={mode !== "annotate" || isSaveLoadDisabled}
              style={getModeButtonStyle(false)}
              title="Load scene (replaces current canvas)"
            >
              Load
            </button>
          )}
        </div>
      )}
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
