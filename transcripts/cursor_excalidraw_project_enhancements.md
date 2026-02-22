# Excalidraw project enhancements
_Exported on 2/22/2026 at 02:57:23 EST from Cursor (2.5.20)_

---

**User**

We have implemented excalidraw overylay and a way to take screenshots. Now I want to enhance this project even more.
- Add support for synced scrolling, this is a checkbox in the ModeToggle where there would be a checkbox to enable sync scroll. This setting allows us to use our scrollwheel to scroll up and down and it would do it for both the excalidraw canvas and the underlying website. Currently when I scroll in anotate mode it scrolls the canvas and when I scroll in browse mode it scrolls the webpage but if this setting is enabled when scrolling in either modes we scroll both the website and the canvas for excalidraw
- When we capture the screen it gets pasted in our clipboard what I want is after it switches to anotate mode we paste the picture at the exact spot that the selection we took. If this can be done properly we dont have to save the selection to the clipboard. Not really sure if this is possible


---

**Cursor**

I understand the two enhancements: synced scrolling toggle and auto-inserting the captured image at the selected region in annotate mode. I’ll quickly inspect the current mode toggle, scrolling, and screenshot/capture flow to draft a concrete implementation plan and call out any technical constraints.

I found the key files; next I’m reading the overlay and capture implementation to map exactly where to add synced-wheel behavior and how screenshot placement can be injected into Excalidraw scene instead of clipboard.

I’ve confirmed the current implementation writes the capture to clipboard only, and there’s no Excalidraw API wiring yet. I’m now checking the installed Excalidraw type surface to ensure the plan uses APIs that actually exist in your version.

I have enough context to propose an implementation plan without guessing APIs: Excalidraw `0.18.0` exposes `excalidrawAPI`, `updateScene`, `addFiles`, and coordinate converters, so both features are feasible in this codebase. I’m drafting a concrete, file-by-file plan now.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I’m starting implementation now and will work through the existing to-dos in order, beginning with wiring the sync-scroll state/UI in `App` and `ModeToggle`, then moving into overlay behavior and capture insertion.

I’ve finished the state and UI toggle wiring. Next I’m implementing the overlay imperative API hooks for synced wheel scrolling and capture insertion plumbing.

I’m now refactoring capture completion payload so `CaptureSelection` returns the captured data + selection rect, then I’ll wire the remaining insertion path cleanup and run lint checks.

Core code changes are in place and lint is clean. I’m running a build check now to validate TypeScript/excalidraw typings and then I’ll finalize todo statuses with a concise change summary.

Implemented both features from your plan and completed all to-dos.

### What changed

- Added a `Sync scroll` checkbox in `ModeToggle` and state wiring in `App`.
- Added shared capture types in `src/content/types.ts`:
  - `SelectionRect`
  - `CaptureResult`
- Refactored `CaptureSelection` to return capture payload (`dataUrl + rect`) via `onDone(result?)` instead of writing to clipboard.
- Upgraded `Overlay` to use Excalidraw imperative API:
  - Captures API instance with `excalidrawAPI`.
  - When sync scroll is enabled, wheel input updates Excalidraw scroll in both `browse` and `annotate`.
  - In `annotate`, it also scrolls the page (manual scroll + canvas sync) so both move together.
- Added automatic captured-image insertion:
  - On capture completion and switch back to annotate, the image is inserted directly into Excalidraw.
  - Placement uses the selected viewport rectangle converted to scene coordinates, so it lands at the same visual location/size.
  - Captured image gets selected immediately after insertion.

### Files updated

- `src/content/App.tsx`
- `src/content/components/ModeToggle.tsx`
- `src/content/components/Overlay.tsx`
- `src/content/components/CaptureSelection.tsx`
- `src/content/types.ts` (new)

### Validation

- `ReadLints` reports no linter errors for edited files.
- `npm run build` succeeds.

If you want, I can now do a quick follow-up pass to persist `Sync scroll` in `chrome.storage` so it survives page reloads.

---

**User**

I think there is problem with the CaptureSelection. I capture a part of the page and then when its pasted, the image spot is correct but the content of the image does not match the selection that was done it feels like the image was zoomed in for some reason the space the image takes up is accurate to the selection.

---

**Cursor**

That behavior lines up with a coordinate-scaling bug in crop math (CSS-pixel selection vs device-pixel screenshot). I’m going to patch capture to scale the selected rect against the actual captured bitmap dimensions so content matches the exact area you selected.

I’ve applied a scaling fix so crop coordinates are mapped from viewport CSS pixels to captured bitmap pixels. I’ll quickly run lints/build to confirm no regressions.

You were exactly right — this was a scaling mismatch.

### Root cause
Your selection rectangle is in **CSS pixels** (`clientX/clientY`), but `chrome.tabs.captureVisibleTab()` returns an image in **bitmap/device pixels** (often 2x on HiDPI, and affected by zoom).  
So crop coordinates were too small relative to the bitmap, which makes the result look “zoomed in”.

### Fix I applied

- In `CaptureSelection`, I now send viewport size along with the selected region:
  - `viewport.width = window.innerWidth`
  - `viewport.height = window.innerHeight`
- In `service-worker`, crop now computes:
  - `scaleX = bitmap.width / viewport.width`
  - `scaleY = bitmap.height / viewport.height`
  - Then scales `left/top/width/height` by these factors before cropping.

This keeps the inserted image content aligned with the exact region you selected.

### Files updated

- `src/content/components/CaptureSelection.tsx`
- `src/background/service-worker.ts`

### Verification
- Lints: clean
- Build: `npm run build` passes

If you still notice slight offset on specific sites, I can add a `visualViewport`-aware fallback (for pages with unusual viewport behavior), but this fix usually resolves the zoomed-in crop issue.

---

**User**

For the scroll sync excalidraw has an api `onScrollChange` can we use that, would it be better that the current solution

---

**Cursor**

Yes — `onScrollChange` is a good API to use, but **not as the only sync source**.

### Short answer
- **Better than wheel-only for canvas → page sync** in annotate mode.
- **Not sufficient alone** for page → canvas sync (especially browse mode), because Excalidraw won’t always emit scroll changes when the webpage scrolls.

### Why
- `onScrollChange` fires when Excalidraw viewport changes (mouse wheel on canvas, panning, keyboard-driven canvas moves, etc.).
- In `browse` mode, your overlay/canvas is hidden/non-interactive, so Excalidraw isn’t the source of truth — the page is.
- Requirement is bidirectional: scrolling either side should move both.

### Best approach
Use a **hybrid sync**:
1. Subscribe to `excalidrawAPI.onScrollChange` → scroll the webpage.
2. Listen to `window` `scroll` → update Excalidraw `scrollX/scrollY`.
3. Add loop guards (`isSyncingFromCanvas` / `isSyncingFromPage`) to prevent feedback loops.

That will be cleaner and more robust than wheel interception, and it also captures non-wheel scroll causes.

If you want, I can refactor the current implementation to this hybrid `onScrollChange + window scroll` model.

---

**User**

Lets refactor to use the hybrid approach

---

**Cursor**

Perfect — I’ll refactor `Overlay` to a hybrid sync: Excalidraw `onScrollChange` for canvas→page and `window` `scroll` for page→canvas, with loop guards to avoid recursive updates. Then I’ll run lint/build.

Refactor is in. I removed the old wheel path and replaced it with bidirectional scroll sync + loop guards. I’ll run one final lint/build pass to ensure everything is clean.

Refactor complete — sync now uses the hybrid model.

### What changed in `Overlay`
- Removed wheel-event-based sync logic.
- Added Excalidraw `onScrollChange` subscription for **canvas → page** syncing.
- Added `window` `scroll` listener for **page → canvas** syncing.
- Added loop guards to avoid recursive ping-pong:
  - `isSyncingFromCanvasRef`
  - `isSyncingFromPageRef`
- Keeps sync active only when:
  - `syncScrollEnabled === true`
  - mode is `annotate` or `browse`

### Why this is better
- Captures more than wheel input (e.g. any Excalidraw viewport scroll change).
- Keeps page and Excalidraw synchronized bidirectionally.
- Avoids brittle wheel interception behavior.

### Validation
- Lints: clean
- Build: `npm run build` passes

If you want, I can also add a tiny deadzone threshold (ignore very tiny deltas) to reduce micro-jitter on high-resolution trackpads.

---

**User**

can we set the canvas size to be the height of the page? this is because when I have syned scroll and I scroll all the way to the top and keep scrolling the canvas will scroll but the page will not

---

**Cursor**

Great question — I’ll quickly inspect your current `Overlay` sync logic to confirm whether canvas height is the right fix or whether clamping scroll deltas is the safer approach.

Short answer: you *can*, but it won’t solve this specific issue well.

The root problem isn’t canvas height — it’s boundary clamping mismatch.

- Your overlay is fixed to viewport (`height: "100vh"`), and Excalidraw itself is effectively infinite, so it can keep scrolling regardless of page bounds.
- In `onScrollChange`, you call `window.scrollBy(...)` from canvas deltas. At top/bottom, the browser clamps page scroll to 0/max, but Excalidraw has already moved, so they desync.
- Since page didn’t actually move, your `window` scroll handler has `deltaY = 0`, so nothing pulls canvas back.

You can see this flow in `src/content/components/Overlay.tsx`:
- canvas→page sync: `onScrollChange` + `window.scrollBy(...)`
- page→canvas sync: `handleWindowScroll`

### Better fix than “page-height canvas”
Keep hybrid sync, but add **boundary reconciliation** in `onScrollChange`:

1. Record page scroll before `scrollBy`.
2. Apply `scrollBy`.
3. On next frame, read actual page scroll delta.
4. If actual delta is smaller than requested (clamped), revert the excess canvas movement with `api.updateScene(...)`.

Conceptually:
- requestedPageDelta = from canvas delta
- actualPageDelta = after - before
- unappliedPageDelta = requested - actual
- unappliedCanvasDelta = -unappliedPageDelta / zoom
- apply `scrollX/scrollY -= unappliedCanvasDelta` to keep lockstep

That preserves your current architecture and fixes the “keep scrolling at top/bottom moves only canvas” behavior.

If you want, I can sketch the exact patch for `Overlay.tsx` (in code form) so you can drop it in.

---

**User**

Implement the better fix for scroll sync

---

**Cursor**

I’m implementing the boundary reconciliation in `Overlay` now: when canvas scroll requests more page movement than the page can do at top/bottom, I’ll compute the unapplied delta and immediately correct Excalidraw scroll to stay locked with the page.

Implemented the better boundary-safe scroll sync fix.

### What I changed
In `src/content/components/Overlay.tsx`, inside the `api.onScrollChange(...)` path:

- Kept hybrid sync (canvas→page + page→canvas).
- Added **reconciliation** for page boundary clamping:
  - Compute requested page delta from canvas delta.
  - Scroll page with `window.scrollBy`.
  - In `requestAnimationFrame`, compute actual page movement.
  - If page movement was clamped (top/bottom), compute unapplied delta and correct Excalidraw scroll with `api.updateScene(...)`.
- Added a `canvasReconcileRafRef` to avoid overlapping reconciliation frames and cancel on cleanup.
- Updated internal previous-scroll refs after correction so the next delta starts from consistent state.

### Result
When user keeps scrolling at page top/bottom, Excalidraw no longer drifts away from webpage scroll position.

### Validation
- Lints clean.
- `npm run build` passes.

