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
