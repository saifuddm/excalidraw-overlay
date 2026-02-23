import {
  convertToExcalidrawElements,
  viewportCoordsToSceneCoords,
} from "@excalidraw/excalidraw";
import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import type { CaptureResult } from "../types";

function dataUrlToMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  return match?.[1] ?? "image/png";
}

function createFileId() {
  return `file-${crypto.randomUUID()}` as BinaryFileData["id"];
}

type CaptureViewportState = Parameters<typeof viewportCoordsToSceneCoords>[1];

export function createCaptureFileData(dataUrl: string): BinaryFileData {
  return {
    id: createFileId(),
    dataURL: dataUrl as BinaryFileData["dataURL"],
    mimeType: dataUrlToMimeType(dataUrl) as BinaryFileData["mimeType"],
    created: Date.now(),
  };
}

export function buildCaptureGroupElements(
  capture: CaptureResult,
  fileId: BinaryFileData["id"],
  appState: CaptureViewportState,
) {
  const viewportPoint = {
    zoom: appState.zoom,
    offsetLeft: appState.offsetLeft,
    offsetTop: appState.offsetTop,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
  };

  const topLeft = viewportCoordsToSceneCoords(
    {
      clientX: capture.rect.left,
      clientY: capture.rect.top,
    },
    viewportPoint,
  );
  const bottomRight = viewportCoordsToSceneCoords(
    {
      clientX: capture.rect.left + capture.rect.width,
      clientY: capture.rect.top + capture.rect.height,
    },
    viewportPoint,
  );

  const width = Math.max(1, bottomRight.x - topLeft.x);
  const height = Math.max(1, bottomRight.y - topLeft.y);

  const [imageElement] = convertToExcalidrawElements([
    {
      type: "image",
      fileId,
      x: topLeft.x,
      y: topLeft.y,
      width,
      height,
    },
  ]);
  const [borderElement] = convertToExcalidrawElements([
    {
      type: "rectangle",
      x: topLeft.x,
      y: topLeft.y,
      width,
      height,
      strokeColor: "#e03131",
      backgroundColor: "transparent",
      strokeWidth: 2,
      opacity: 50,
      roughness: 0,
    },
  ]);
  const captureGroupId = `group-${crypto.randomUUID()}`;

  return {
    groupedImageElement: {
      ...imageElement,
      groupIds: [captureGroupId],
    },
    groupedBorderElement: {
      ...borderElement,
      groupIds: [captureGroupId],
    },
  };
}
