// ============================================
// CONTENIDOSERVICE.JS — los bloques del perfil (RF-05 y RF-06)
//
// Siete rutas. Todas sobre el contenido de quien tiene la sesion: el perfil
// se deduce del token, nunca se pasa por parametro.
// ============================================

import { peticion } from "./apiClient";

/**
 * Las secciones en las que se reparte el contenido (RF-05).
 *
 * Viven aqui, con el servicio, porque son el vocabulario del campo `seccion`
 * de esta API y no la decision de una pantalla: las usan el panel del dueno,
 * para sus pestanas, y las dos vistas publicas, para separar el contenido con
 * los mismos nombres. Tenerlas en cada sitio dejaria que el panel llamara
 * "Menu principal" a lo que la pagina publica llama otra cosa.
 *
 * El orden es el de las pestanas del panel, y es el que se respeta al
 * pintarlas: quien ordena su contenido en el panel espera verlo asi.
 */
export const SECCIONES = [
  { id: "menu", nombre: "Menú principal" },
  { id: "promos", nombre: "Promociones" },
  { id: "reservas", nombre: "Reservaciones" }
];

/** La seccion del menu, que tiene pantalla propia. */
export const SECCION_MENU = "menu";

const posicionDe = (id) => {
  const puesto = SECCIONES.findIndex((s) => s.id === id);

  // Una que no conocemos va al final. El validador del backend acepta
  // cualquier cadena en `seccion`, asi que puede llegar una que esta lista no
  // tenga: se pinta con su nombre tal cual en lugar de desaparecer.
  return puesto === -1 ? SECCIONES.length : puesto;
};

/**
 * Convierte el `porSeccion` de la API en algo que se puede recorrer.
 *
 * Devuelve [{id, nombre, bloques}] con las secciones que TIENEN contenido, en
 * el orden del panel. Las vacias se descartan aqui y no en la pantalla:
 * un titulo de seccion sin nada debajo no dice nada.
 *
 * @param {object} porSeccion - Lo que devuelve GET /publico/:slug.
 */
export function seccionesEnOrden(porSeccion) {
  if (!porSeccion) return [];

  return Object.keys(porSeccion)
    .filter((id) => porSeccion[id]?.length > 0)
    .sort((a, b) => posicionDe(a) - posicionDe(b))
    .map((id) => ({
      id,
      nombre: SECCIONES.find((s) => s.id === id)?.nombre ?? id,
      bloques: porSeccion[id]
    }));
}

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
