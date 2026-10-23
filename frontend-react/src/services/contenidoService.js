// ============================================
// CONTENIDOSERVICE.JS — los bloques del perfil (RF-05 y RF-06)
//
// Siete rutas. Todas sobre el contenido de quien tiene la sesion: el perfil
// se deduce del token, nunca se pasa por parametro.
// ============================================

import { peticion } from "./apiClient";

/**
 * Los bloques del perfil, activos y desactivados.
 *
 * Es la diferencia con la vista publica: alli solo salen los activos. El
 * dueno tiene que ver los dos para poder encenderlos de nuevo.
 *
 * Cada bloque llega con un id compuesto -"enlace-12", "elemento-31"- porque
 * viven en dos tablas distintas y el numero solo no los distingue.
 */
export const listarContenido = () => peticion("/contenido");

/** Las categorias disponibles, agrupadas en enlaces y elementos. */
export const listarCategorias = () => peticion("/contenido/categorias");

/**
 * Crea un bloque.
 *
 * El tipo decide de que lista sale la categoria: "enlace" usa las de enlace
 * -WhatsApp, Instagram, Google Maps...- y "texto" y "boton" las de elemento.
 * Mezclarlas da 400.
 */
export const crearContenido = (datos) =>
  peticion("/contenido", { method: "POST", body: JSON.stringify(datos) });

/**
 * Edita un bloque.
 *
 * El tipo NO se puede cambiar: seria mover la fila de una tabla a otra. Para
 * convertir un texto en un boton hay que borrarlo y crearlo de nuevo.
 */
export const actualizarContenido = (id, datos) =>
  peticion(`/contenido/${id}`, { method: "PUT", body: JSON.stringify(datos) });

/** Enciende o apaga un bloque sin borrarlo (RF-06). */
export const cambiarEstadoContenido = (id, activo) =>
  peticion(`/contenido/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo })
  });

export const eliminarContenido = (id) =>
  peticion(`/contenido/${id}`, { method: "DELETE" });

/**
 * Fija el orden de una seccion.
 *
 * Se manda la lista entera de identificadores en el orden deseado, no "sube
 * este uno": el servidor comprueba que todos sean de esta cuenta antes de
 * tocar nada, de modo que la seccion no queda a medio reordenar.
 */
export const reordenarContenido = (ids) =>
  peticion("/contenido/orden", { method: "PUT", body: JSON.stringify({ ids }) });
