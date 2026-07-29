import React from "react";
import { createRoot } from "react-dom/client";

import { PetSurface } from "./features/pet/PetSurface";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PetSurface />
  </React.StrictMode>,
);
