// ============================================
// QRSERVICE.JS — el codigo QR del perfil (RF-07, RF-08 y RF-09)
// ============================================

import { peticion, descargar } from "./apiClient";

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
