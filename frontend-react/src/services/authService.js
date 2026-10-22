// ============================================
// AUTHSERVICE.JS — inicio y cierre de sesion (RF-02)
// ============================================

import { peticion, CLAVE_TOKEN, CLAVE_USUARIO } from "./apiClient";

/**
 * Entra con correo y contrasena y guarda la sesion.
 *
 * El cuerpo que pide esta API es {correo, contrasena}, no {email, password}.
 * Y responde:
 *
 *   { message, data: { token, usuario: { idUsuario, nombre, correo, rol } } }
 *
 * Sin campo `success`, `usuario` en lugar de `user`, y `rol` es una cadena
 * -"administrador" o "empresa"-, no un objeto {id, name}. Quien copie el
 * ejemplo de la guia tal cual se queda sin rol y sin poder proteger nada.
 *
 * @param {string} correo
 * @param {string} contrasena
 * @returns {Promise<object>} El usuario que inicio sesion.
 */
export async function iniciarSesion(correo, contrasena) {
  const resultado = await peticion("/auth/login", {
    method: "POST",
    body: JSON.stringify({ correo, contrasena })
  });

  const { token, usuario } = resultado?.data ?? {};

  if (!token || !usuario?.rol) {
    throw new Error("La respuesta del inicio de sesión está incompleta");
  }

  // sessionStorage y no localStorage: la sesion muere al cerrar la pestana,
  // que es lo que se espera de un panel de administracion.
  sessionStorage.setItem(CLAVE_TOKEN, token);
  sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));

  return usuario;
}

/**
 * Cierra la sesion en el servidor y borra la local.
 *
 * El backend revoca el token (RF-02): sin esto, un token robado seguiria
 * sirviendo hasta que caducara. Si la llamada falla -porque ya habia
 * caducado, por ejemplo-, la sesion local se borra igual.
 */
export async function cerrarSesion() {
  try {
    await peticion("/auth/logout", { method: "POST" });
  } catch {
    // Da igual por que fallara: lo que no puede quedar es la sesion local
  }

  sessionStorage.removeItem(CLAVE_TOKEN);
  sessionStorage.removeItem(CLAVE_USUARIO);
}

/** El perfil de quien tiene la sesion abierta. */
export function consultarMiPerfil() {
  return peticion("/usuarios/me");
}
