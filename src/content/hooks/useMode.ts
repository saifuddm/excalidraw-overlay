import { useEffect, useState } from "react";

export type Mode = "off" | "browse" | "annotate" | "capture";

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

      if (event.altKey && event.shiftKey && event.code === "KeyA") {
        setMode((prev) => (prev === "off" ? "annotate" : "off"));
        return;
      }

      if (mode === "off") return;


      if (event.key === "Escape" && mode === "annotate") {
        setMode("browse");
      }

      if (event.key === "Escape" && mode === "capture") {
        setMode("annotate");
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt" && mode === "browse") {
        setMode("annotate");
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [mode]);

  return { mode, setMode };
}
