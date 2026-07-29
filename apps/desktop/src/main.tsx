import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProvider } from "./state/store";
import "./styles/global.css";
import "./styles/app.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
