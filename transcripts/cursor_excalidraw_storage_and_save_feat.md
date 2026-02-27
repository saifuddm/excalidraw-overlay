# Excalidraw storage and save feature
_Exported on 2/27/2026 at 01:34:50 EST from Cursor (2.5.25)_

---

**User**

Okay now my app is running great. I want to add a save feature to it.
I know that extensions have some sort of storage. How is that accessed and used show me a simple example.

For the data to be stored since we are working with excalidraw we need to get that data. When I am using the excalidraw website I see it saves in browser localstorage with two keys. one key `excalidraw-state` is about the UI state of excalidraw and `excalidraw` which is the elements on the page.
An example of a single rectangle is @documents/excalidraw-localStorage-RectangleElement-example.json 


If I wanted to store the scene (elements) in extension storage, I think I can use an excalidraw utils such as serializeAsJSON to get scene data to json or some export  utility. and then to restore it we can use something a restore utility




---

**Cursor**


Exploring the codebase and Excalidraw docs to show how extension storage works and how to save/restore Excalidraw scene data.



Checking Excalidraw utils and existing storage usage in the app:



Checking Excalidraw package exports and the restore/serialize API:



Checking what `updateScene` expects and whether `restore` returns a compatible shape:



Here’s a concise way to do it with your current setup.

---

## 1. Extension storage (how it’s used)

You already have the **`storage`** permission in `manifest.json` and usage in `App.tsx`. Summary:

- **API:** `chrome.storage.local` (or `chrome.storage.sync` for smaller, synced data).
- **Read:** `chrome.storage.local.get(keys, callback)` — `keys` can be a string, array of keys, or `null` for everything.
- **Write:** `chrome.storage.local.set(object)` — keys and values you want to store.

**Minimal example:**

```js
// Save
chrome.storage.local.set({
  "my-key": { elements: [...], appState: {...} },
  "another-key": "string or any JSON-serializable value"
});

// Load
chrome.storage.local.get(["my-key"], (result) => {
  const data = result["my-key"];
  if (data) {
    // use data
  }
});
```

Promise-based (e.g. in async code):

```js
const result = await chrome.storage.local.get(["my-key"]);
const data = result["my-key"];
```

So: **extension storage is key/value; you choose the keys and store whatever JSON-serializable data you want** (e.g. scene JSON string or parsed `{ elements, appState }`).

---

## 2. Excalidraw: save scene with `serializeAsJSON`

From the [Excalidraw utils docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils):

- **`serializeAsJSON({ elements, appState })`** returns a **single JSON string** that includes both elements and app state (deleted elements and most app state are trimmed). That’s a good format to store in extension storage.

**Save (in your overlay, when you have the API):**

```js
import { serializeAsJSON } from "@excalidraw/excalidraw";

// When user clicks Save (e.g. from toolbar or overlay)
function saveScene(api) {
  const elements = api.getSceneElementsIncludingDeleted();
  const appState = api.getAppState();
  const json = serializeAsJSON({ elements, appState });
  chrome.storage.local.set({ "excalidraw-scene": json });
}
```

So you’re **not** replicating the two localStorage keys (`excalidraw` and `excalidraw-state`) in storage — you store one key, e.g. `excalidraw-scene`, whose value is the string returned by `serializeAsJSON`. That string is the “scene” (elements + state) in one blob.

---

## 3. Excalidraw: restore with `restore` + `updateScene`

From the [restore utils](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/restore):

- **`restore(data, localAppState, localElements)`** takes parsed import data and returns a full **`DataState`** (elements + appState normalized). You then pass that to the API.

**Restore (after loading from extension storage):**

```js
import { restore } from "@excalidraw/excalidraw";

// On load / "Load" button
async function loadScene(api) {
  const result = await chrome.storage.local.get(["excalidraw-scene"]);
  const json = result["excalidraw-scene"];
  if (!json) return;
  const parsed = JSON.parse(json);
  const restored = restore(parsed, null, null);
  api.updateScene(restored);
}
```

So: **get the string from extension storage → `JSON.parse` → `restore(...)` → `api.updateScene(restored)`.**

If you want to keep the current overlay UI state (e.g. transparent background) and only restore elements + minimal state, you can pass your current app state as the second argument:

```js
const currentAppState = api.getAppState();
const restored = restore(parsed, currentAppState, null);
api.updateScene(restored);
```

---

## 4. How this relates to the website’s localStorage

- **excalidraw.com** uses two keys:
  - `excalidraw` → raw **elements** array (like your `excalidraw-localStorage-RectangleElement-example.json`).
  - `excalidraw-state` → **app state** (theme, zoom, scroll, tool, etc. — like your `excalidraw-localStorage-state-example.json`).

- **Your extension** can use a **single** key (e.g. `excalidraw-scene`) and store the **`serializeAsJSON`** string. That string, when parsed, has both elements and a reduced app state; **`restore()`** turns it into a full `DataState` for **`updateScene()`**. So you don’t need to mirror the two-key scheme unless you want to (e.g. one key for elements, one for state); one key with `serializeAsJSON` is the usual export/restore path.

---

## 5. Where to hook Save/Load in your app

- **Overlay:** You already have `excalidrawApiRef.current` in `Overlay.tsx`. You can pass a ref or callbacks from `App.tsx` so the toolbar (or overlay) can call:
  - Save: `serializeAsJSON` + `chrome.storage.local.set({ "excalidraw-scene": json })`
  - Load: `chrome.storage.local.get(["excalidraw-scene"])` → `JSON.parse` → `restore(...)` → `api.updateScene(restored)`.
- **Initial load:** If you want the scene to restore when the overlay opens, run the same “load” logic in `Overlay` once `excalidrawAPI` is ready and (optionally) merge with `initialData` or call `updateScene` after mount.

---

## 6. Optional: images / files

If the scene has **embedded images** (e.g. from your capture feature), the serialized JSON may reference **files** by id. The full export format can include a `files` map. If you need to persist those too, you’d store the parsed object (or a second key) that includes `files` and pass the restored state (elements + appState + files) to `updateScene`; the same `restore`/`updateScene` flow applies, with the restored state including files where applicable.

In short: **extension storage = `chrome.storage.local.get/set`; save = `serializeAsJSON` + one storage key; restore = get that key → parse → `restore(...)` → `api.updateScene(restored)`.**

---

**User**

Before I convert this to a plan are there any big concerns or pitfalls that need to be discussed?

---

**Cursor**


Checking a few implementation details that could cause problems:



Here are the main concerns and pitfalls to sort out before you lock the plan:

---

## 1. **Scenes with captures (images) – files must be saved and restored**

Your capture flow uses **image elements** and **`api.addFiles()`**. The Excalidraw format has a separate **`files`** map (id → `BinaryFileData` with base64 `dataURL`).

- **`serializeAsJSON({ elements, appState })`** only takes elements and appState; it does **not** include the `files` object.
- If you only save/restore that JSON, image elements will keep their `fileId`s but the file cache will be empty, so **captures will show as broken/missing** after restore.

So you need to:

- **Save:** Also call **`api.getFiles()`** and store the **files** map (e.g. alongside the serialized scene or in the same JSON object). Filter to only the files that are referenced by the current elements if you want to avoid storing unused files.
- **Restore:** After `restore(parsed, null, null)` and `updateScene(restored)`, pass the stored files into the scene, e.g. with **`api.addFiles(Object.values(storedFiles))`** (or the structure your API expects). The docs note that file IDs must match what the elements reference, so keep the same id → file mapping when saving.

So the big pitfall here is: **treat “scene” as elements + appState + files**, not just `serializeAsJSON` output.

---

## 2. **Storage quota and size**

- **`chrome.storage.local`**: about **5 MB** per extension.
- Base64 image data is ~33% larger than binary; a few full-page screenshots can be several MB.
- One big scene with many captures can hit the quota; `chrome.storage.local.set` can fail with a quota error.

Worth deciding:

- Whether you’re okay with a single global “last saved scene” that might fail when very large, or you want to avoid storing big images (e.g. save only elements + appState and drop images, or store images elsewhere).
- Whether to use **`chrome.storage.local.setBytesInUse()`** (or try/catch on `set`) to detect quota and show a “scene too large” or “save without images” path.

---

## 3. **Storage key strategy: one scene vs per-page**

Right now the mental model is “one key” (e.g. `excalidraw-scene`).

- **Single key:** Every save overwrites the same scene. If the user annotates Site A, then annotates Site B and saves, the Site A scene is gone unless you add something like “multiple named scenes” later.
- **Per-origin (or per-URL) key:** e.g. `excalidraw-scene-${origin}` or `excalidraw-scene-${origin}-${pathname}`. Each page (or site) has its own saved scene. That matches the idea of “annotations for this page.”

So the pitfall is: **if you don’t scope the key, you effectively have one global scene and can overwrite previous work when switching sites.**

---

## 4. **When to load: API ready vs `initialData`**

You currently pass **`initialData={{ elements: [], appState: { viewBackgroundColor: "transparent" } }}`**. If you load from storage and call **`api.updateScene(restored)`** only after the API is ready, that’s correct. If you instead try to merge stored data into `initialData` before mount, you have to be careful:

- **Files** can’t be passed in `initialData` the same way as in `updateScene` + `addFiles`; the API expects to receive files via the API after mount.
- So **restore should run after the API is ready**: read from storage → `restore()` → `updateScene(restored)` then `addFiles(...)` for any stored files. Don’t assume you can fully “preload” a scene with images via `initialData` only.

---

## 5. **Undo/history when restoring**

The Excalidraw API’s **`updateScene`** can take a **`captureUpdate`** (e.g. `CaptureUpdateAction.NEVER`) so that a restore doesn’t create one giant undo step. If you don’t set it, restoring a full scene might make “Undo” try to undo the entire load. So when restoring, pass the equivalent of “don’t record this as one user action” (e.g. `CaptureUpdateAction.NEVER`) so history stays sane.

---

## 6. **Schema/versioning (minor)**

Excalidraw elements have a **`version`** field; the library may evolve. **`restore()`** is there to normalize imported data. So for the first version you can rely on `restore()` and not add your own version field. If later you support multiple saved files or long-term storage, you might add a simple schema version or “saved with Excalidraw X” so you can migrate later.

---

## Summary table

| Area | Pitfall | Suggestion |
|------|--------|------------|
| **Images/captures** | `serializeAsJSON` doesn’t include files; image elements break on restore | Also persist `getFiles()` and restore with `updateScene` + `addFiles()` |
| **Quota** | 5 MB limit; base64 images are large | Consider size checks, or “save without images” / separate image handling |
| **Key strategy** | One key ⇒ one global scene, overwritten per save | Consider keying by origin (or URL) so each page has its own scene |
| **When to restore** | Files can’t be fully preloaded via `initialData` | Restore after API ready: `updateScene` then `addFiles` |
| **Undo** | Full-scene restore can create one huge undo step | Use `captureUpdate: CaptureUpdateAction.NEVER` (or equivalent) on restore |

If you want, next step can be a short “plan” section that turns this into concrete tasks (e.g. “define storage key (per-origin)”, “save: serializeAsJSON + getFiles”, “restore: restore() + updateScene + addFiles”, “handle quota errors”, “wire Save/Load in UI”).

---

**User**

For storage of images can we use indexedDB to store the images I believe that is what excalidraw website is also doing?

Let not complicate the plan and say its a global screne and that save will write the scene and we will have a load button that will clear the users canvas and add the scene data from storage. does this reduce the concerns and pitfalls above



---

**Cursor**


Checking whether Excalidraw uses IndexedDB for file/image storage:



Yes on both.

---

## 1. Using IndexedDB for images

You can store image/file data in **IndexedDB** and keep the scene JSON in **chrome.storage**:

- **chrome.storage:** scene payload only (elements + appState from `serializeAsJSON`), plus a list of file IDs if you want to know what to load from IndexedDB.
- **IndexedDB:** one store (e.g. `excalidraw-files`) keyed by fileId, value = the file object (e.g. `{ id, mimeType, dataURL, created }` or similar).

On **save:** get scene + `getFiles()`, write scene JSON to chrome.storage, write each file (by fileId) to IndexedDB.  
On **load:** read scene from chrome.storage, clear canvas, `restore()` + `updateScene()`, then read files from IndexedDB and `addFiles()`.

That way images don’t count against the 5 MB limit of `chrome.storage.local`. Excalidraw’s own site may use localStorage (and size limits there are a concern for big images); for your extension, IndexedDB is a better fit for binary/base64 image data.

---

## 2. How “global scene + Save writes + Load clears and loads” simplifies things

| Earlier concern | With your simplified plan |
|-----------------|----------------------------|
| **Per-URL vs global key** | Dropped. One global scene, one key (e.g. scene in chrome.storage, files in IndexedDB). No URL/origin logic. |
| **When to load** | Only on “Load” button. No restore-on-mount, no fighting with `initialData`. Load = clear + read from storage + restore + add files. |
| **Undo** | Load explicitly “replaces” the canvas, so using `captureUpdate: NEVER` (or equivalent) on that single `updateScene` is clear and keeps history sane. |
| **Storage quota** | Images in IndexedDB instead of chrome.storage largely removes the 5 MB pitfall for the scene. |
| **Images must be saved/restored** | Still required, but design is clear: scene JSON in chrome.storage, files in IndexedDB, and Load = scene + files both applied after clear. |

So yes: using IndexedDB for images and a single global scene with an explicit Save (writes scene + files) and Load (clear canvas then load scene + files from storage) reduces the earlier concerns and keeps the plan simple.

---

**User**

Create a plan for the above

---

**Cursor**


Reviewing the codebase to draft a concrete plan.



Checking how to clear the scene and use CaptureUpdateAction:



Creating the plan:


---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**


Implementing the Save/Load scene plan. Checking existing todos and the codebase state.



Implementing the scene storage module:



Checking how the Excalidraw package exports these APIs:



Updating sceneStorage: fixing serializeAsJSON (pass elements, appState, files, and type) and correcting the restore type.



Checking package exports for data types and fixing the ImportedDataState reference.



Wiring the API ref in App and Overlay:



Setting API ready to false when Overlay unmounts:



Verifying compilation:



Summary of what was implemented:

## 1. **Scene storage** – [src/content/utils/sceneStorage.ts](src/content/utils/sceneStorage.ts)

- **saveScene(api):** Uses `serializeAsJSON(elements, appState, files, "local")`, writes the JSON to `chrome.storage.local` under `excalidraw-annotate-scene`, opens IndexedDB (`excalidraw-annotate`, store `files`), clears the store, and writes only files referenced by image elements. Shows “Saved” or “Failed to save” toasts.
- **loadScene(api):** Reads the scene from chrome.storage, parses and runs `restore()`, calls `api.resetScene()`, collects image `fileId`s from restored elements, loads those files from IndexedDB, calls `api.addFiles(files)`, then `api.updateScene({ elements, appState, captureUpdate: CaptureUpdateAction.NEVER })`. Shows “Loaded” or “Failed to load” toasts. No-op if nothing is saved.

## 2. **API ref and Save/Load wiring** – [App.tsx](src/content/App.tsx) and [Overlay.tsx](src/content/components/Overlay.tsx)

- **App:** Defines `excalidrawApiRef` and `excalidrawApiReady`, passes `excalidrawApiRef` to `Overlay`, passes `onApiReady={setExcalidrawApiReady}` to `Overlay`, and passes `onSave`, `onLoad`, and `isSaveLoadDisabled={!excalidrawApiReady}` to `ModeToggle`.
- **Overlay:** Accepts optional `excalidrawApiRef` and `onApiReady`. In the `excalidrawAPI` callback it assigns the API to the internal ref and to `excalidrawApiRef`, then calls `onApiReady(ready)`. On unmount it sets `externalApiRef.current = null` and `onApiReady(false)`.

## 3. **Save/Load UI** – [ModeToggle.tsx](src/content/components/ModeToggle.tsx)

- Optional props: `onSave`, `onLoad`, `isSaveLoadDisabled` (default `false`).
- When `onSave` or `onLoad` is set, a second row of **Save** and **Load** buttons is rendered.
- Buttons are disabled when `mode !== "annotate"` or `isSaveLoadDisabled` is true.

## 4. **Optional: disable until API ready**

- Implemented via `excalidrawApiReady` in App and `isSaveLoadDisabled={!excalidrawApiReady}` so Save/Load stay disabled until the Excalidraw API is ready.

Type-check (`tsc --noEmit`) passes. Lint was started and can be confirmed in your environment. All planned todos are done.

---

**User**

There is some issue I am facing. So I can see the image dataUrl in the indexedDB and confirmed its correct.
When I go to a different website an open the developer tools to see the indexedDB I do not see that image anymore. Is indeexedDB not share between websites.

Also I see the dataURL in `excalidraw-annotate-scene` why is that the case when we are not pulling the image data from the local extension storage?

---

**Cursor**


Checking how the code uses IndexedDB and what gets stored in the scene JSON:



There are two separate things going on:

---

## 1. Why IndexedDB “disappears” on another website

**IndexedDB is origin-bound.** The origin is determined by **who opens the database**.

Your Save/Load logic runs in the **content script**. Content scripts execute in the context of the **page**, so the origin used for `indexedDB.open(...)` is the **page’s origin** (e.g. `https://site-a.com` or `https://site-b.com`), not the extension’s.

So:

- On **site A**: you open `excalidraw-annotate` → DB is created under **site A’s origin**. You see it in DevTools when you’re on site A.
- On **site B**: DevTools shows **site B’s origin**. That origin has its own IndexedDB; the DB you created on site A is under a different origin, so you don’t see it there.

So the image isn’t “gone” — it’s in a **different origin’s** IndexedDB (the first site). Each site has its own DB.

To have **one** shared store for images across all sites, the DB must be opened from a context that has a **single origin**: the extension. That means:

- Open IndexedDB in the **extension background** (service worker) or in an extension page (e.g. popup/options), **or**
- Have the content script send messages to the background and let the background open IndexedDB and do all file read/write.

In the background, `indexedDB.open("excalidraw-annotate", 1)` runs under the extension origin (`chrome-extension://<your-extension-id>/`), so the same DB is used on every page. So the fix is: **move IndexedDB file read/write into the background script** and have the content script call it via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`.

---

## 2. Why you see dataURL in `excalidraw-annotate-scene`

In your code you do:

```ts
const sceneJson = serializeAsJSON(elements, appState, files, "local");
```

So you pass the **full `files`** object (with dataURLs) into `serializeAsJSON`. The Excalidraw API is designed so that when you pass `files` and use `"local"`, the **serialized JSON includes the file data** (including dataURLs) so that a single blob can be stored (e.g. in localStorage) and restored without a separate store.

So:

- The scene in **chrome.storage.local** is that full serialization, which **does** include image data.
- You’re **also** writing the same file data into IndexedDB.

So images are stored twice, and the scene in extension storage is still large. That’s why you see dataURL in `excalidraw-annotate-scene`.

To stop storing image data in extension storage and rely only on IndexedDB for images, you need the scene JSON to **not** include file payloads. The elements only need to keep their `fileId` references. So you should **not** pass the real `files` into `serializeAsJSON`. For example, call it with an empty files object:

```ts
const sceneJson = serializeAsJSON(elements, appState, {}, "local");
```

Then the serialized string should contain only elements + appState (with `fileId`s), and no embedded dataURLs. On load you still get the elements with `fileId`s, restore the scene, then load the actual file data from IndexedDB (from the background, once it’s moved there) and call `addFiles()`.

---

## Summary

| Issue | Cause | Direction for fix |
|-------|--------|--------------------|
| IndexedDB not visible on another site | Content script runs in page context → IndexedDB is per-**page origin**, not shared. | Move IndexedDB open/read/write to the **background script** (extension origin) and call it via messaging. |
| dataURL in `excalidraw-annotate-scene` | `serializeAsJSON(..., files, "local")` embeds the file data in the JSON. | Call `serializeAsJSON(elements, appState, {}, "local")` so the scene in chrome.storage has no embedded images; keep images only in IndexedDB (in the background). |

I can outline concrete code changes (messages, background script API, and the exact `serializeAsJSON` change) if you want to implement this next.

---

**User**

Implement the changes

---

**Cursor**


Implementing both changes: moving IndexedDB to the background script and removing image data from the scene JSON.



Implementing both changes: adding background IndexedDB handlers, then updating sceneStorage to use them and to serialize without file data.



Summary of what was implemented:

## 1. **IndexedDB in the background (extension origin)**

**`src/background/service-worker.ts`**
- **Constants:** `IDB_DATABASE_NAME = "excalidraw-annotate"`, `IDB_OBJECT_STORE_FILES = "files"`.
- **Helpers:** `openExcalidrawIDB()`, `saveExcalidrawFiles(files)`, `loadExcalidrawFiles(fileIds)` that open IndexedDB in the **extension** context (so the same DB is used on all sites).
- **Message handlers:**
  - `EXCALIDRAW_SAVE_FILES`: payload `{ files: ExcalidrawFileRecord[] }` → clear the store, put each file, then `sendResponse({ success: true })` or `{ success: false, error }`.
  - `EXCALIDRAW_LOAD_FILES`: payload `{ fileIds: string[] }` → read those ids from the store, then `sendResponse({ files })`.

Files are now stored in one IndexedDB under the extension origin, so they are shared across all tabs/sites.

## 2. **No image data in scene JSON + content uses background for files**

**`src/content/utils/sceneStorage.ts`**
- **Save:**  
  - Scene JSON is produced with `serializeAsJSON(elements, appState, {}, "local")` so **no file data** is written to `excalidraw-annotate-scene`.  
  - Only file ids from image elements are collected; the corresponding file objects are sent to the background with `chrome.runtime.sendMessage({ type: "EXCALIDRAW_SAVE_FILES", files: filesToSave })`.  
  - Scene JSON is still saved to `chrome.storage.local` as before.
- **Load:**  
  - Scene is read from `chrome.storage.local`, parsed, and restored.  
  - File ids from restored image elements are sent to the background with `chrome.runtime.sendMessage({ type: "EXCALIDRAW_LOAD_FILES", fileIds })`.  
  - The returned `files` are passed to `api.addFiles(files)`, then the scene is applied with `updateScene`.

Result:
- **IndexedDB** is opened only in the background, so the same saved images are available on every website.
- **`excalidraw-annotate-scene`** in `chrome.storage.local` no longer contains `dataURL`s; it only has elements and app state (with `fileId`s). Image bytes live only in the extension’s IndexedDB.

---

**User**

update the readme and the guide html 

---

**Cursor**


Updating the README and guide to document the Save/Load feature.



Summary of updates:

**README.md**
- **What This Project Does:** Added a bullet for saving and loading the scene so it persists across sessions and sites.
- **High-Level Features:** New “Save / Load” bullet describing one global scene (scene JSON in `chrome.storage.local`, images in background IndexedDB, shared across sites).
- **Toggle Buttons:** New bullet for **Save** / **Load** (available in Annotate mode): what they do and that the scene is global.
- **Project Structure:** Content script now mentions scene save/load and `sceneStorage.ts`; background now mentions Excalidraw file storage and IndexedDB under the extension origin.
- **Permissions:** Storage description now includes the saved Excalidraw scene and where scene vs. images are stored.

**src/options/guide.html**
- **New “Save and Load” section:** Describes Save (stores current scene globally) and Load (clears canvas and restores last saved scene); notes that scene JSON is in Chrome storage and images in the extension’s IndexedDB, and that saving again overwrites.
- **Warning tip:** Replaced “extension does not persist” with: Off clears the in-memory scene; use Save first to keep work; Load replaces the current canvas with the last saved scene.
- **Tip:** Added a sentence about saving the scene to keep drawings and captures across sessions and sites.

