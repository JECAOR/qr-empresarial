import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout/Layout";
import RutaProtegida from "./components/RutaProtegida/RutaProtegida";
import PerfilPublicoPage from "./pages/PerfilPublico/PerfilPublicoPage";
import LoginPage from "./pages/Login/LoginPage";
import UsuariosPage from "./pages/Usuarios/UsuariosPage";
import AccesoDenegadoPage from "./pages/AccesoDenegado/AccesoDenegadoPage";

/**
 * Las rutas de la aplicacion.
 *
 * El perfil publico es la portada y no pide sesion: es lo que ve quien
 * escanea un codigo QR. La gestion de usuarios exige sesion Y el rol
 * administrador, que es lo que autoriza usuario.routes.js.
 */
export default function App() {
  return (
    <Routes>
      {/* Fuera de Layout: la pantalla de entrada no lleva barra de navegacion */}
      <Route path="/login" element={<LoginPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<PerfilPublicoPage />} />
        <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

        <Route element={<RutaProtegida rolesPermitidos={["administrador"]} />}>
          <Route path="/usuarios" element={<UsuariosPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
