import { createRoot } from "react-dom/client";

export default function Popup() {
  const handleOpenGuide = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <main
      style={{
        minWidth: "260px",
        padding: "12px",
        fontFamily: "system-ui, sans-serif",
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: "14px", margin: "0 0 8px" }}>
        Excalidraw Annotate
      </h1>
      <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.4 }}>
        Use Alt+Shift+A on any page to toggle the overlay.
      </p>
      <p style={{ margin: "6px 0 0", fontSize: "11px", lineHeight: 1.4, color: "#666" }}>
        Alt+B Browse, Alt+A Annotate, Alt+C Capture
      </p>
      <button
        type="button"
        onClick={handleOpenGuide}
        style={{
          marginTop: "10px",
          width: "100%",
          border: "1px solid #d0d7de",
          borderRadius: "6px",
          padding: "8px 10px",
          background: "#f6f8fa",
          color: "#111",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        Open usage guide
      </button>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
