// ============================================
// CUENTASERVICE.JS — registro y recuperacion de contrasena (RF-01 y RF-03)
//
// Las cuatro rutas abiertas del modulo de autenticacion: las usa quien
// todavia no tiene sesion, asi que ninguna lleva token.
// ============================================

import { peticion } from "./apiClient";

/**
 * Registro publico (RF-01).
 *
 * El negocio es opcional. Si se envia, la cuenta y su perfil empresarial se
 * crean en una misma transaccion: nunca queda una cuenta sin perfil.
 *
 * Responde 201 con {data: {idUsuario, nombre, correo, rol, slug}}, SIN token.
 * Quien se registra todavia tiene que iniciar sesion.
 *
 * El rol no se acepta aqui por diseno: nadie se asciende a administrador
 * registrandose. Enviarlo no da error, simplemente se ignora.
 */
export function registrar({ nombre, correo, contrasena, negocio }) {
  const cuerpo = { nombre, correo, contrasena };

  // Solo se manda si tiene algo: un objeto vacio haria fallar la validacion
  if (negocio?.nombreNegocio?.trim()) cuerpo.negocio = negocio;

  return peticion("/auth/registro", {
    method: "POST",
    body: JSON.stringify(cuerpo)
  });
}

/**
 * Pide el enlace para restablecer la contrasena (RF-03).
 *
 * Responde 200 diga lo que diga el correo: si contestara 404 para uno que no
 * existe, cualquiera podria averiguar que direcciones estan registradas.
 *
 * Fuera de produccion el servidor devuelve ademas `enlaceDesarrollo`, para
 * poder seguir la prueba sin un buzon de correo. En produccion ese campo no
 * viaja, asi que la pantalla puede mostrarlo sin condicionarlo: si no esta,
 * no se ensena nada.
 */
export function pedirEnlaceDeRecuperacion(correo) {
  return peticion("/auth/recuperar-contrasena", {
    method: "POST",
    body: JSON.stringify({ correo })
  });
}

/** Comprueba si un enlace de recuperacion sigue sirviendo. */
export function comprobarEnlace(token) {
  return peticion(`/auth/restablecer/${encodeURIComponent(token)}`);
}

/** Fija la contrasena nueva y da el enlace por usado. */
export function restablecerContrasena(token, contrasena) {
  return peticion("/auth/restablecer-contrasena", {
    method: "POST",
    body: JSON.stringify({ token, contrasena })
  });
}
