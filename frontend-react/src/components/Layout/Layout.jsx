import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import "./Layout.css";

/**
 * La barra de navegacion, comun a todas las pantallas.
 *
 * El enlace a Usuarios solo se ensena a un administrador, porque es el unico
 * rol que autoriza usuario.routes.js. Un enlace visible no concede permisos
 * -el servidor sigue mandando-, pero ofrecer una puerta que va a dar 403 es
 * una mala pantalla.
 */
export default function Layout() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();

  async function cerrar() {
    await salir();
    navegar("/login");
  }

  return (
    <>
      <header className="barra">
        <Link className="barra__marca" to="/">QR Empresarial</Link>

        <nav className="barra__nav">
          <NavLink to="/" end>Perfil público</NavLink>
          {usuario && <NavLink to="/perfil">Mi negocio</NavLink>}
          {usuario && <NavLink to="/contenido">Contenido</NavLink>}
          {usuario && <NavLink to="/codigo-qr">Código QR</NavLink>}
          {usuario && <NavLink to="/actividad">Actividad</NavLink>}
          {usuario && <NavLink to="/configuracion">Configuración</NavLink>}
          {usuario?.rol === "administrador" && <NavLink to="/usuarios">Usuarios</NavLink>}
          {usuario?.rol === "administrador" && <NavLink to="/administracion">Administración</NavLink>}
        </nav>

        {usuario ? (
          <div className="barra__sesion">
            <span className="barra__quien">
              {usuario.nombre}
              <span className="barra__rol">{usuario.rol}</span>
            </span>
            <button type="button" className="barra__salir" onClick={cerrar}>Salir</button>
          </div>
        ) : (
          <Link className="barra__entrar" to="/login">Iniciar sesión</Link>
        )}
      </header>

      <Outlet />
    </>
  );
}
