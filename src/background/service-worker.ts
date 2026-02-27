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

const IDB_DATABASE_NAME = "excalidraw-annotate";
const IDB_OBJECT_STORE_FILES = "files";

type ExcalidrawFileRecord = {
  id: string;
  mimeType: string;
  dataURL: string;
  created: number;
};

function openExcalidrawIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DATABASE_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_OBJECT_STORE_FILES)) {
        db.createObjectStore(IDB_OBJECT_STORE_FILES, { keyPath: "id" });
      }
    };
  });
}

async function saveExcalidrawFiles(
  files: ExcalidrawFileRecord[],
): Promise<void> {
  const db = await openExcalidrawIDB();
  const tx = db.transaction(IDB_OBJECT_STORE_FILES, "readwrite");
  const store = tx.objectStore(IDB_OBJECT_STORE_FILES);
  store.clear();
  for (const file of files) {
    store.put(file);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadExcalidrawFiles(
  fileIds: string[],
): Promise<ExcalidrawFileRecord[]> {
  const db = await openExcalidrawIDB();
  const tx = db.transaction(IDB_OBJECT_STORE_FILES, "readonly");
  const store = tx.objectStore(IDB_OBJECT_STORE_FILES);
  const files: ExcalidrawFileRecord[] = [];
  for (const id of fileIds) {
    const file = await new Promise<ExcalidrawFileRecord | undefined>(
      (resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );
    if (file) files.push(file);
  }
  db.close();
  return files;
}

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

  if (message?.type === "EXCALIDRAW_SAVE_FILES") {
    const files = message.files as ExcalidrawFileRecord[];
    saveExcalidrawFiles(files ?? [])
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error("Excalidraw save files failed:", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true;
  }

  if (message?.type === "EXCALIDRAW_LOAD_FILES") {
    const fileIds = (message.fileIds as string[]) ?? [];
    loadExcalidrawFiles(fileIds)
      .then((files) => sendResponse({ files }))
      .catch((err) => {
        console.error("Excalidraw load files failed:", err);
        sendResponse({ files: [] });
      });
    return true;
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
