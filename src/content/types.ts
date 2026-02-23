export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CaptureResult {
  dataUrl: string;
  rect: SelectionRect;
}

export type Mode = "off" | "browse" | "annotate" | "capture";

export type SyncScrollTargetMode = "auto" | "window" | `element:${string}`;

export interface ScrollableTargetOption {
  id: string;
  label: string;
}

export type ScrollTarget = Window | HTMLElement;

export type ScrollPoint = {
  x: number;
  y: number;
};
