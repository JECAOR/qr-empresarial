import { Route, Routes } from "react-router-dom";

import Layout from "./components/Layout/Layout";
import RutaProtegida from "./components/RutaProtegida/RutaProtegida";
import PerfilPublicoPage from "./pages/PerfilPublico/PerfilPublicoPage";
import LoginPage from "./pages/Login/LoginPage";
import RegistroPage from "./pages/Cuenta/RegistroPage";
import RecuperarPage from "./pages/Cuenta/RecuperarPage";
import RestablecerPage from "./pages/Cuenta/RestablecerPage";
import NoEncontradaPage from "./pages/NoEncontrada/NoEncontradaPage";
import PerfilPage from "./pages/Perfil/PerfilPage";
import ContenidoPage from "./pages/Contenido/ContenidoPage";
import CodigoQrPage from "./pages/CodigoQr/CodigoQrPage";
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
      {/* Fuera de Layout: las pantallas de cuenta no llevan barra de
          navegacion. Quien no ha entrado no tiene donde navegar. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/recuperar" element={<RecuperarPage />} />
      <Route path="/restablecer" element={<RestablecerPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<PerfilPublicoPage />} />
        <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />

        {/* Basta con tener sesion: el perfil es el de quien entra */}
        <Route element={<RutaProtegida />}>
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/contenido" element={<ContenidoPage />} />
          <Route path="/codigo-qr" element={<CodigoQrPage />} />
        </Route>

        <Route element={<RutaProtegida rolesPermitidos={["administrador"]} />}>
          <Route path="/usuarios" element={<UsuariosPage />} />
        </Route>

        {/* Una direccion que no existe se dice, no se disimula mandando
            a la portada como si nada */}
        <Route path="*" element={<NoEncontradaPage />} />
      </Route>
    </Routes>
  );
}
