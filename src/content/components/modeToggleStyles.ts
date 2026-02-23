import type { CSSProperties } from "react";

const ACTIVE_BUTTON_BG = "#4f46e5";
const INACTIVE_BUTTON_BG = "#3f3f46";

export const modeToggleContainerStyle: CSSProperties = {
  position: "fixed",
  top: "12px",
  right: "12px",
  zIndex: 2147483647,
  gap: "6px",
  background: "rgba(24, 24, 27, 0.96)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  padding: "6px",
  borderRadius: "10px",
  pointerEvents: "auto",
  userSelect: "none",
};

export const modeButtonRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "6px",
};

export const modeControlsColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

export const checkboxLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  color: "#e4e4e7",
  fontSize: "12px",
  paddingTop: "6px",
};

export const targetLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  color: "#e4e4e7",
  fontSize: "12px",
  paddingLeft: "6px",
  borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
};

export const targetSelectStyle: CSSProperties = {
  fontSize: "12px",
  background: "#27272a",
  color: "#e4e4e7",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: "4px",
  padding: "2px 4px",
  maxWidth: "200px",
};

const buttonBaseStyle: CSSProperties = {
  padding: "6px 10px",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  cursor: "pointer",
  fontSize: "12px",
  lineHeight: 1.1,
};

export function getModeButtonStyle(isActive: boolean): CSSProperties {
  return {
    ...buttonBaseStyle,
    background: isActive ? ACTIVE_BUTTON_BG : INACTIVE_BUTTON_BG,
  };
}

export const offButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: "#b91c1c",
};
