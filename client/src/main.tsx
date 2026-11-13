import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeAndroid, isAndroid } from './lib/native';

initializeAndroid().then(() => createRoot(document.getElementById("root")!).render(<App />)).catch(error => {
  document.getElementById('root')!.textContent = `DairyFlow could not start: ${error.message}. Your saved entries remain on this device.`;
});

if (!isAndroid && import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(console.error);
