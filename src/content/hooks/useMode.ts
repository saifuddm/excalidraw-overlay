import { useEffect, useState } from "react";
import type { Mode } from "../types";

export function useMode() {
  const [mode, setMode] = useState<Mode>("off");

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (mode === "annotate" && event.code === "Space" && !isTypingTarget(event.target)) {
        event.preventDefault();
      }

      // Global toggle shortcut for opening/closing the overlay quickly.
      if (event.altKey && event.shiftKey && event.code === "KeyA") {
        setMode((prev) => (prev === "off" ? "annotate" : "off"));
        return;
      }

      // Mode shortcuts (Alt+B Browse, Alt+A Annotate, Alt+C Capture).
      if (
        event.altKey &&
        !event.shiftKey &&
        !isTypingTarget(event.target)
      ) {
        if (event.code === "KeyB" && mode !== "off") {
          event.preventDefault();
          setMode("browse");
          return;
        }
        if (event.code === "KeyA" && mode !== "off") {
          event.preventDefault();
          setMode("annotate");
          return;
        }
        if (
          event.code === "KeyC" &&
          (mode === "annotate" || mode === "browse")
        ) {
          event.preventDefault();
          setMode("capture");
          return;
        }
      }

      if (mode === "off") return;
      if (event.key === "Escape" && mode === "annotate") {
        setMode("browse");
      }

      if (event.key === "Escape" && mode === "capture") {
        setMode("annotate");
      }
    };


    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [mode]);

  return { mode, setMode };
}
