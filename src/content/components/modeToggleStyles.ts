import type { CSSProperties } from "react";

// shadcn-inspired tokens (neutral dark card)
const background = "hsl(240 10% 3.9%)";
const foreground = "hsl(0 0% 98%)";
const mutedForeground = "hsl(240 3.8% 46.1%)";
const border = "hsl(240 3.7% 15.9%)";
const primary = "hsl(240 5.9% 10%)";
const primaryForeground = "hsl(0 0% 98%)";
const secondary = "hsl(240 4.8% 95.9%)";
const secondaryForeground = "hsl(240 5.9% 10%)";
const destructive = "hsl(0 84.2% 60.2%)";
const destructiveForeground = "hsl(0 0% 98%)";
const ring = "hsl(240 4.9% 83.9%)";
const radius = "0.5rem"; // 8px

export const modeToggleContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  background,
  border: `1px solid ${border}`,
  padding: "8px 10px",
  borderRadius: radius,
  boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
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
  gap: "6px",
  color: mutedForeground,
  fontSize: "12px",
  paddingTop: "4px",
};

export const targetLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  color: mutedForeground,
  fontSize: "12px",
  paddingLeft: "8px",
  borderLeft: `1px solid ${border}`,
};

export const targetSelectStyle: CSSProperties = {
  fontSize: "12px",
  background: "hsl(240 4.8% 8%)",
  color: foreground,
  border: `1px solid ${border}`,
  borderRadius: "6px",
  padding: "4px 8px",
  maxWidth: "200px",
  outline: "none",
};

const buttonBaseStyle: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid transparent",
  borderRadius: "6px",
  color: primaryForeground,
  cursor: "pointer",
  fontSize: "12px",
  lineHeight: 1.2,
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
  minWidth: "64px",
};

export function getModeButtonStyle(isActive: boolean): CSSProperties {
  return {
    ...buttonBaseStyle,
    background: isActive ? primary : secondary,
    color: isActive ? primaryForeground : secondaryForeground,
    borderColor: isActive ? ring : "transparent",
  };
}

export const offButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: destructive,
  color: destructiveForeground,
};

export const dragHandleStyle: CSSProperties = {
  cursor: "grab",
  padding: "4px 6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: mutedForeground,
  borderRadius: "4px",
};

export const minimizeButtonStyle: CSSProperties = {
  cursor: "pointer",
  padding: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: mutedForeground,
  borderRadius: "4px",
};

export const minimizedIconButtonStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  padding: "4px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background,
  border: `1px solid ${border}`,
  borderRadius: radius,
  boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
};
