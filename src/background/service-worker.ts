chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_EXTENSION" });
});

type CaptureRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CaptureViewport = {
  width: number;
  height: number;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CAPTURE_VISIBLE_TAB") {
    handleCaptureVisibleTab(
      message.region as CaptureRegion,
      message.viewport as CaptureViewport | undefined
    )
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown capture error.";
        sendResponse({ error: message });
      });
    return true;
  }

  if (message?.type === "GET_TAB_INFO") {
    sendResponse({
      url: sender.tab?.url ?? "",
      title: sender.tab?.title ?? "",
    });
  }

  return true;
});

async function handleCaptureVisibleTab(
  region: CaptureRegion,
  viewport: CaptureViewport | undefined
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      {
        format: "png",
      },
      (capturedDataUrl) => {
        const errorMessage = chrome.runtime.lastError?.message;
        if (errorMessage) {
          reject(new Error(errorMessage));
          return;
        }
        if (!capturedDataUrl) {
          reject(new Error("Capture returned no image."));
          return;
        }
        resolve(capturedDataUrl);
      }
    );
  });
  return cropDataUrl(dataUrl, region, viewport);
}

async function cropDataUrl(
  dataUrl: string,
  region: CaptureRegion,
  viewport: CaptureViewport | undefined
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const viewportWidth = Math.max(1, Math.floor(viewport?.width ?? bitmap.width));
  const viewportHeight = Math.max(1, Math.floor(viewport?.height ?? bitmap.height));

  const scaleX = bitmap.width / viewportWidth;
  const scaleY = bitmap.height / viewportHeight;

  const left = Math.max(0, Math.floor(region.left * scaleX));
  const top = Math.max(0, Math.floor(region.top * scaleY));
  const width = Math.max(1, Math.floor(region.width * scaleX));
  const height = Math.max(1, Math.floor(region.height * scaleY));

  const sourceWidth = Math.min(width, bitmap.width - left);
  const sourceHeight = Math.min(height, bitmap.height - top);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Capture area is out of bounds.");
  }

  const canvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to initialize capture canvas.");
  }

  context.drawImage(
    bitmap,
    left,
    top,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );

  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(croppedBlob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read cropped image."));
    reader.readAsDataURL(blob);
  });
}
