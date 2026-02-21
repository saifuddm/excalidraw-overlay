import { createRoot } from "react-dom/client";
import "@excalidraw/excalidraw/index.css";
import App from "./App.tsx";

function init() {
  if (document.getElementById("excalidraw-annotate-root")) return;

  const container = document.createElement("div");
  container.id = "excalidraw-annotate-root";
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.zIndex = "2147483647";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const mountPoint = document.createElement("div");
  mountPoint.id = "excalidraw-annotate-mount";
  mountPoint.style.position = "fixed";
  mountPoint.style.inset = "0";
  mountPoint.style.width = "100vw";
  mountPoint.style.height = "100vh";
  mountPoint.style.zIndex = "2147483647";
  mountPoint.style.pointerEvents = "none";
  container.appendChild(mountPoint);

  createRoot(mountPoint).render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
