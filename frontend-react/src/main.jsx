import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { ProveedorAuth } from "./context/AuthContext";
import "./styles/global.css";
import App from "./App.jsx";

// StrictMode ejecuta los efectos dos veces en desarrollo, a proposito: asi
// salta a la vista un efecto que no sabe limpiarse. Por eso en la pestana
// Network se ven DOS peticiones GET y no es un error.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorAuth>
        <App />
      </ProveedorAuth>
    </BrowserRouter>
  </StrictMode>
);
