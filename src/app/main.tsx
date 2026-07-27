import { createRoot } from "react-dom/client";

import "../styles.css";
import { App } from "./App";
import { AppProviders } from "./AppProviders";

const rootElement = document.querySelector<HTMLDivElement>("#root");

if (!rootElement) {
  throw new Error("RoamAtlas root element is missing");
}

createRoot(rootElement).render(
  <AppProviders>
    <App />
  </AppProviders>
);
