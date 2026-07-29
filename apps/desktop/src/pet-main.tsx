import React from "react";
import ReactDOM from "react-dom/client";

import { PetSurface } from "./features/pet/PetSurface";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PetSurface />
  </React.StrictMode>,
);
