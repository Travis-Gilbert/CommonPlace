import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PetSurface } from "./features/pet/PetSurface";
import { AppProvider } from "./state/store";
import "./styles/global.css";
import "./styles/app.css";

const isPetSurface =
  new URLSearchParams(window.location.search).get("surface") === "pet";

document.body.classList.toggle("pet-window", isPetSurface);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isPetSurface ? (
      <PetSurface />
    ) : (
      <AppProvider>
        <App />
      </AppProvider>
    )}
  </React.StrictMode>,
);
