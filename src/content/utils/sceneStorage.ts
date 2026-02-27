import {
  serializeAsJSON,
  restore,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  BinaryFileData,
} from "@excalidraw/excalidraw/types";

type ElementWithFileId = { type: string; fileId?: string | null };

const STORAGE_KEY_SCENE = "excalidraw-annotate-scene";

function getFileIdsFromElements(
  elements: readonly ElementWithFileId[],
): string[] {
  const ids = new Set<string>();
  for (const el of elements) {
    if (el.type === "image" && el.fileId) ids.add(el.fileId);
  }
  return Array.from(ids);
}

export async function saveScene(
  api: ExcalidrawImperativeAPI | null,
): Promise<void> {
  if (!api) return;
  try {
    const elements = api.getSceneElementsIncludingDeleted();
    const appState = api.getAppState();
    const files = api.getFiles();
    const fileIds = getFileIdsFromElements(elements);
    const filesToSave = fileIds
      .map((id) => files[id])
      .filter((f): f is BinaryFileData => f != null);

    const sceneJson = serializeAsJSON(elements, appState, {}, "local");
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY_SCENE]: sceneJson }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "EXCALIDRAW_SAVE_FILES", files: filesToSave },
        (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else if (response?.success === false) reject(new Error(response?.error));
          else resolve();
        },
      );
    });
    api.setToast({ message: "Saved" });
  } catch (err) {
    console.error("Failed to save scene:", err);
    api.setToast({ message: "Failed to save" });
  }
}

export async function loadScene(
  api: ExcalidrawImperativeAPI | null,
): Promise<void> {
  if (!api) return;
  try {
    const result = await new Promise<{ [key: string]: unknown }>(
      (resolve, reject) => {
        chrome.storage.local.get([STORAGE_KEY_SCENE], (res) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(res);
        });
      },
    );
    const sceneJson = result[STORAGE_KEY_SCENE];
    if (typeof sceneJson !== "string") return;

    const parsed = JSON.parse(sceneJson) as Parameters<typeof restore>[0];
    const restored = restore(parsed, null, null);

    api.resetScene();

    const fileIds = getFileIdsFromElements(restored.elements);
    if (fileIds.length > 0) {
      const files = await new Promise<BinaryFileData[]>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "EXCALIDRAW_LOAD_FILES", fileIds },
          (response) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(Array.isArray(response?.files) ? response.files : []);
          },
        );
      });
      if (files.length > 0) api.addFiles(files);
    }

    api.updateScene({
      elements: restored.elements,
      appState: restored.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    api.setToast({ message: "Loaded" });
  } catch (err) {
    console.error("Failed to load scene:", err);
    api.setToast({ message: "Failed to load" });
  }
}
