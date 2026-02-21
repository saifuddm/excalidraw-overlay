import { createRoot } from "react-dom/client";

export default function Popup() {
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
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
