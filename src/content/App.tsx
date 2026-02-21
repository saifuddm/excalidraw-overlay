import { useEffect } from "react";
import CaptureSelection from "./components/CaptureSelection";
import Overlay from "./components/Overlay";
import ModeToggle from "./components/ModeToggle";
import { useMode } from "./hooks/useMode";

export default function App() {
  const { mode, setMode } = useMode();

  useEffect(() => {
    const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (
      message
    ) => {
      if (message?.type !== "TOGGLE_EXTENSION") return;
      setMode((prev) => (prev === "off" ? "annotate" : "off"));
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setMode]);

  if (mode === "off") return null;

  return (
    <>
      <ModeToggle mode={mode} setMode={setMode} />
      <Overlay mode={mode} />
      {mode === "capture" && <CaptureSelection onDone={() => setMode("annotate")} />}
    </>
  );
}
