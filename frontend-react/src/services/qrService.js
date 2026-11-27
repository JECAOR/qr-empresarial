// ============================================
// QRSERVICE.JS — el codigo QR del perfil (RF-07, RF-08 y RF-09)
// ============================================

import { peticion, descargar, origenDelBackend } from "./apiClient";

/**
 * La dirección pública completa, a partir de lo que devuelve la API.
 *
 * En la base conviven DOS formatos y los dos siguen vivos:
 *
 *   #1  /p/panaderia-la-espiga                      ← los primeros códigos
 *   #14 http://localhost:3000/p/floristeria-...     ← los de ahora
 *
 * El backend arma la dirección desde `APP_URL` y la guarda entera, pero los
 * códigos más antiguos guardaron solo la ruta. La pantalla anteponía el
 * origen sin mirar, y en los nuevos el resultado era el dominio repetido:
 * `http://localhost:3000http://localhost:3000/p/...`.
 *
 * El código impreso no se veía afectado —la imagen la dibuja el servidor con
 * la dirección guardada, que es correcta—, pero sí todo lo que el negocio
 * copia o comparte desde la pantalla: el enlace, el botón de copiar, «Abrirla»
 * y los tres mensajes de WhatsApp, correo e Instagram.
 *
 * Se mira el valor en lugar de confiar en el formato, porque los dos existen.
 *
 * @param {string} url - Lo que la API devuelve en `qr.url`.
 * @returns {string}
 */
export function direccionPublica(url) {
  if (!url) return "";

  return /^https?:\/\//i.test(url) ? url : `${origenDelBackend()}${url}`;
}

/**
 * El codigo del perfil.
 *
 * Responde 404 si todavia no se ha generado, que no es un error: es el estado
 * normal de un perfil recien creado.
 */
export const consultarMiQr = () => peticion("/qr");

/**
 * Genera el codigo (RF-07).
 *
 * Es idempotente: si ya existia devuelve el mismo, sin cambiar su direccion.
 * De eso depende que un codigo ya impreso siga sirviendo.
 *
 * Responde 409 si el perfil no tiene ningun bloque activo: un codigo que
 * lleva a una pagina en blanco no le sirve a nadie.
 */
export const generarMiQr = () => peticion("/qr", { method: "POST" });

/**
 * Publica o retira la pagina (RF-09).
 *
 * Apagarlo no borra el codigo: la direccion se conserva y se puede volver a
 * publicar. Es la salida cuando el modulo 3 no deja quitar el ultimo bloque.
 */
export const cambiarEstadoQr = (activo) =>
  peticion("/qr/estado", { method: "PATCH", body: JSON.stringify({ activo }) });

/**
 * Descarga la imagen del codigo (RF-08).
 *
 * @param {{formato: string, tamano: number, color: string}} opciones
 */
export function descargarImagen({ formato, tamano, color }) {
  const parametros = new URLSearchParams({
    formato,
    tamano: String(tamano),
    color: color.replace(/^#/, "")
  });

  return descargar(`/qr/imagen?${parametros}`);
}
