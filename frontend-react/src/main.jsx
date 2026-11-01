import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { ProveedorAuth } from "./context/AuthContext";
import "./styles/global.css";
import { aplicarTema, temaGuardado } from "./styles/tema";
import App from "./App.jsx";

// El color de marca, antes de dibujar nada. Lo definitivo lo trae
// useTemaPropio() preguntando al perfil, pero esa respuesta tarda: aplicar
// aqui el que quedo guardado la ultima vez es lo que evita ver la aplicacion
// en indigo durante un instante y luego cambiar de color.
//
// Sin recordar: esto LEE la cache, no la escribe. Guardar aqui dejaba un
// "qre_tema" en el navegador de cualquiera que abriera una pagina publica
// sin tener cuenta, que no viene a cuento. La escriben los dos sitios que de
// verdad se enteran del color del negocio: useTemaPropio() al leer el
// perfil, y PerfilPage al cambiarlo.
aplicarTema(temaGuardado(), { recordar: false });

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
