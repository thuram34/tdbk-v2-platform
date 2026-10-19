import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import PwaInstallPrompt from "./PwaInstallPrompt";
import "./styles.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.error("Chemist Pro service worker registration failed:", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <PwaInstallPrompt />
  </React.StrictMode>,
);
