import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

/**
 * Deja pasar solo a quien tiene sesion y, si se indican, el rol adecuado.
 *
 * Esto NO es seguridad: es cortesia. Quien escriba la direccion a mano o
 * llame a la API con curl se salta esta comprobacion entera. La seguridad la
 * aplica Express en cada endpoint, y por eso una cuenta de empresa recibe 403
 * aunque consiga pintar la pantalla.
 *
 * @param {string[]} [rolesPermitidos]
 */
export default function RutaProtegida({ rolesPermitidos }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) return <p className="aviso">Verificando sesión…</p>;

  // Se recuerda a donde iba, para devolverlo ahi despues de entrar
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return <Outlet />;
}
