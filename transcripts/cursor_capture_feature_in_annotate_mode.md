# Capture feature in annotate mode
_Exported on 2/21/2026 at 04:46:25 EST from Cursor (2.4.36)_

---

**User**

level 1 is fully complete according to my testing from @GIUDE.md .
Now for level 2 I think lets skip it and lets try to implement level 3.

I think in my opinion level 3 might be a bit to overengineered so lets so a simple version of it.
When I am in annotate mode add a new button for capture this will capture, then I can select a part of the screen and then it puts it in my clipboard so then I can paste it in excalidraw.

The flow would be:
- I enable the extension, I go into anotate mode and do some anotations
- then when I click on the capture selection button in the mode toggle it will go into capture mode
- capture mode does apply the same styling for the @src/content/components/Overlay.tsx as the `isBrowseMode` (className add)
- I should be able to select a portion of the screen
- after selection its auto coppied to my clipboard
- the toggle switches back into anotate mode so that I can paste the image

---

**Cursor**

I’ll map the current annotate/browse flow first, then draft a concrete Level 3 “simple capture mode” plan that fits your existing structure and keeps complexity low. I’m going to quickly inspect the relevant files and your `GIUDE.md` expectations before proposing the implementation steps.

I’ve confirmed your guide intent and the existing `Overlay`/`ModeToggle` structure. Next I’ll verify the current `useMode`, `App`, and background messaging so the plan is precise about where capture mode and clipboard behavior should plug in.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I’m starting implementation now and will work through the existing to-dos in order, marking each as in progress/completed as I go. First step is mode + toggle wiring, then I’ll move to overlay behavior and capture pipeline.

Mode and toggle updates are in. I’m moving to the overlay behavior now so `capture` mirrors `browse` visual treatment before implementing the rectangle selection UI.

I’ve added the in-page capture selection UI and wired it into `App`. Next I’m implementing the background `CAPTURE_VISIBLE_TAB` cropping handler so clipboard copy can use an actual cropped image payload.

Core code changes are complete. I’m running validation now (`lint`/`build`) and then I’ll report any fixes needed before marking the final todo done.

Implemented exactly the simple Level 3 capture flow from your plan, without touching the plan file.

### What changed

- Added new `capture` mode in `src/content/hooks/useMode.ts`
  - `Mode` now includes `"capture"`.
  - `Escape` in capture mode cancels and returns to annotate.
- Added `Capture` button in `src/content/components/ModeToggle.tsx`
  - Visible when in annotate/capture.
  - Click switches to capture mode.
- Updated overlay browse-style behavior in `src/content/components/Overlay.tsx`
  - Capture mode now uses the same browse-style hide behavior (`excalidraw-overlay--browse`) and opacity logic.
- Added selection + clipboard UI in `src/content/components/CaptureSelection.tsx`
  - Drag to draw rectangle.
  - On mouse up:
    - sends `CAPTURE_VISIBLE_TAB` with selected region,
    - receives cropped `dataUrl`,
    - writes image to clipboard,
    - returns to annotate mode.
  - Tiny selections are ignored and return to annotate.
- Wired capture UI in `src/content/App.tsx`
  - Renders `CaptureSelection` only while `mode === "capture"`.
- Implemented background capture/crop in `src/background/service-worker.ts`
  - New message handler for `CAPTURE_VISIBLE_TAB`.
  - Uses `chrome.tabs.captureVisibleTab`.
  - Crops with `OffscreenCanvas`.
  - Returns cropped PNG `dataUrl`.

### Validation run

- `npm run lint` ✅
- `npm run build` ✅

All plan to-dos are marked completed.

### Quick manual check for you

- Enable extension → enter annotate.
- Click `Capture` → drag select.
- Paste into Excalidraw.
- Confirm mode is back to annotate afterward.
- Press `Escape` during capture to confirm cancel path.

---

**User**

Getting an error in the console log

```
Capture selection failed: Error: Either the '<all_urls>' or 'activeTab' permission is required.
```

---

**Cursor**

That error makes sense with the current flow: capture is being triggered from the content UI, but `activeTab` is only guaranteed after explicit extension action grants. I’ll add explicit host permission coverage so `captureVisibleTab` can run consistently in this mode.

Fixed. The capture error happens because `activeTab` alone isn’t always available in your current flow (especially when you didn’t explicitly grant it via extension action interaction on that tab).

### Change made
- Updated `src/manifest.json` to include:
  - `"host_permissions": ["<all_urls>"]`

This gives `chrome.tabs.captureVisibleTab` consistent permission coverage in your on-page capture flow.

### Verification
- `npm run build` passes successfully.

### What you need to do now
- Reload the extension in `chrome://extensions` (Manifest changes require reload).
- Retry annotate → capture selection.
- If Chrome prompts for updated site access, approve it.

If you still hit issues after reload, I can add a small runtime fallback that surfaces a user-facing toast with exact permission guidance instead of only console error.

