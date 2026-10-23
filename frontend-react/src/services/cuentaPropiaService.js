// ============================================
// CUENTAPROPIASERVICE.JS — la cuenta de quien tiene la sesion (RF-12)
//
// Todas las rutas van sobre /me: nunca llevan identificador, porque el
// usuario sale del token. No se puede pedir ni cambiar la cuenta de otro.
// ============================================

import { peticion, CLAVE_TOKEN, CLAVE_USUARIO } from "./apiClient";

/**
 * Cambia el nombre y el correo.
 *
 * La contrasena solo hace falta si el correo cambia, y eso lo decide el
 * servidor comparando con el que ya tiene la cuenta. Sin ella responde 401:
 * el correo es el identificador con el que se entra y al que llega el enlace
 * de recuperacion, de modo que quien se hiciera con una sesion abierta
 * podria cambiarlo y despues apropiarse de la cuenta.
 */
export const guardarMisDatos = ({ nombre, correo, contrasena }) =>
  peticion("/usuarios/me", {
    method: "PUT",
    body: JSON.stringify(contrasena ? { nombre, correo, contrasena } : { nombre, correo })
  });

/**
 * Cambia la contrasena.
 *
 * El servidor cierra todas las demas sesiones y devuelve UN TOKEN NUEVO para
 * esta. Hay que guardarlo: con el viejo, la siguiente peticion responderia
 * 401 y la pantalla echaria fuera a quien acaba de cambiar su clave.
 */
export async function cambiarMiContrasena({ contrasenaActual, contrasenaNueva }) {
  const resultado = await peticion("/usuarios/me/contrasena", {
    method: "PUT",
    body: JSON.stringify({ contrasenaActual, contrasenaNueva })
  });

  const token = resultado?.data?.token;

  if (!token) throw new Error("El servidor no devolvió la sesión nueva");

  sessionStorage.setItem(CLAVE_TOKEN, token);

  return resultado;
}

/** Los avisos por correo de la cuenta. */
export const consultarMisPreferencias = () => peticion("/usuarios/me/preferencias");

/**
 * Guarda los avisos.
 *
 * Se guardan de verdad, pero HOY NO SE ENVIA NINGUNO: el sistema no tiene
 * todavia el trabajo que los mandaria. La pantalla lo dice en lugar de
 * prometer correos que no llegan.
 */
export const guardarMisPreferencias = ({ resumen, novedades }) =>
  peticion("/usuarios/me/preferencias", {
    method: "PUT",
    body: JSON.stringify({ resumen, novedades })
  });

/**
 * Da de baja la cuenta propia.
 *
 * Pide la contrasena a proposito: es la unica accion de la aplicacion que no
 * se puede deshacer desde la pantalla. Es un borrado logico -los datos se
 * conservan- pero la cuenta deja de existir para quien la usaba.
 */
export async function eliminarMiCuenta(contrasena) {
  const resultado = await peticion("/usuarios/me", {
    method: "DELETE",
    body: JSON.stringify({ contrasena })
  });

  sessionStorage.removeItem(CLAVE_TOKEN);
  sessionStorage.removeItem(CLAVE_USUARIO);

  return resultado;
}
