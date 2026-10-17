// ============================================
// CONTENIDO.SERVICE.JS — reglas del contenido del perfil (RF-05, RF-06)
//
// Traduce entre lo que ve la pantalla —una lista de bloques con un tipo— y
// las dos tablas del esquema. También resuelve a qué perfil pertenece la
// sesión: los endpoints hablan de "mi contenido", nunca de identificadores
// de perfil que llegan por la URL.
// ============================================

const perfilRepository = require('../perfiles/perfil.repository');
const contenidoRepository = require('./contenido.repository');

// Qué tabla y qué categorías corresponden a cada tipo de la API.
// "enlace" lleva a otra parte; "texto" y "boton" son contenido propio.
const TIPOS = {
  enlace: { clase: 'enlace' },
  texto: { clase: 'elemento', categoriaPorDefecto: 'Texto' },
  boton: { clase: 'elemento', categoriaPorDefecto: 'Botón' }
};

/**
 * Identificador que usa la API: la tabla y el número, juntos.
 *
 * Hace falta porque los dos contadores empiezan en 1: sin el prefijo, el
 * enlace 3 y el elemento 3 serían el mismo "3" para el cliente.
 */
function componerId(clase, id) {
  return `${clase}-${id}`;
}

/**
 * Separa un identificador de la API en sus dos partes.
 *
 * @param {string} idContenido - Por ejemplo "enlace-12".
 * @returns {{clase: string, id: number}}
 * @throws {Error} 400 si no tiene la forma esperada.
 */
function descomponerId(idContenido) {
  const partes = String(idContenido).split('-');
  const clase = partes[0];
  const id = Number(partes[1]);

  const valido = (clase === 'enlace' || clase === 'elemento')
    && Number.isInteger(id) && id > 0;

  if (!valido) {
    const error = new Error('El identificador del contenido no es válido');
    error.status = 400;
    throw error;
  }

  return { clase, id };
}

/**
 * Da forma de API a una fila del repositorio.
 */
function aRespuesta(fila) {
  return {
    id: componerId(fila.clase, fila.id),
    tipo: tipoDeLaFila(fila),
    seccion: fila.seccion,
    titulo: fila.titulo,
    detalle: fila.detalle,
    categoria: {
      id: fila.id_categoria,
      nombre: fila.categoria,
      icono: fila.icono
    },
    orden: fila.orden,
    // MySQL devuelve TINYINT(1), no un booleano
    activo: Boolean(fila.activo)
  };
}

/**
 * Deduce el tipo de la API a partir de la fila.
 *
 * Los enlaces son siempre "enlace". Entre los elementos, el botón se
 * distingue por su categoría; todo lo demás se trata como texto.
 */
function tipoDeLaFila(fila) {
  if (fila.clase === 'enlace') return 'enlace';

  return fila.categoria === 'Botón' ? 'boton' : 'texto';
}

/**
 * Comprueba la categoría y deja el detalle listo para guardar (RF-10).
 *
 * La regla de la URL vive aquí porque depende de la categoría, y la
 * categoría hay que leerla de la base:
 *
 *   - WhatsApp admite un número de teléfono, que es como lo escribe
 *     cualquiera, y se guarda convertido en un enlace wa.me. Así la vista
 *     pública no tiene que adivinar si lo que hay es un teléfono o una URL.
 *   - El resto de los enlaces exige http o https. Un "javascript:" acabaría
 *     en la vista pública y sería un agujero de seguridad.
 *   - Los textos y botones no llevan URL: su detalle es texto libre.
 *
 * @param {string} tipo
 * @param {number} idCategoria
 * @param {string} detalle
 * @returns {Promise<{categoria: object, detalle: string}>}
 * @throws {Error} 400 si la categoría no existe o la URL no sirve.
 */
async function resolverCategoriaYDetalle(tipo, idCategoria, detalle) {
  const { clase } = TIPOS[tipo];

  const categoria = await contenidoRepository.buscarCategoria(clase, idCategoria);

  if (!categoria) {
    const error = new Error('La categoría indicada no existe');
    error.status = 400;
    throw error;
  }

  if (clase !== 'enlace') return { categoria, detalle };

  if (categoria.nombre === 'WhatsApp') {
    return { categoria, detalle: normalizarWhatsapp(detalle) };
  }

  if (!esUrlValida(detalle)) {
    const error = new Error('El enlace debe ser una dirección que empiece por http o https');
    error.status = 400;
    throw error;
  }

  return { categoria, detalle };
}

/**
 * Convierte un teléfono en un enlace de WhatsApp, o deja pasar la URL si ya
 * venía escrita.
 */
function normalizarWhatsapp(detalle) {
  if (esUrlValida(detalle)) return detalle;

  const digitos = detalle.replace(/[^\d]/g, '');

  if (digitos.length < 7) {
    const error = new Error('Escriba un número de WhatsApp válido o un enlace completo');
    error.status = 400;
    throw error;
  }

  return `https://wa.me/${digitos}`;
}

/**
 * Comprueba que sea una dirección que un navegador pueda abrir.
 * Mismo criterio que en el perfil: solo http y https.
 */
function esUrlValida(valor) {
  try {
    const url = new URL(valor);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

/**
 * Devuelve el perfil de la cuenta, que es a quien pertenece el contenido.
 *
 * @param {number} idUsuario
 * @returns {Promise<object>}
 * @throws {Error} 404 si la cuenta todavía no tiene perfil.
 */
async function perfilDeLaCuenta(idUsuario) {
  const perfil = await perfilRepository.buscarPorUsuario(idUsuario);

  if (!perfil) {
    const error = new Error(
      'Primero complete el perfil empresarial: el contenido se cuelga de él'
    );
    error.status = 404;
    throw error;
  }

  return perfil;
}

/**
 * Lista el contenido de la cuenta autenticada.
 *
 * Se devuelve plano y ordenado, y también agrupado por sección, porque es
 * como lo pinta la pantalla. Agrupar aquí ahorra que cada cliente lo repita.
 *
 * @param {number} idUsuario
 * @returns {Promise<{items: object[], porSeccion: object}>}
 */
async function listarMiContenido(idUsuario) {
  const perfil = await perfilDeLaCuenta(idUsuario);

  const filas = await contenidoRepository.listarPorPerfil(perfil.id_perfil);
  const items = filas.map(aRespuesta);

  const porSeccion = {};

  for (const item of items) {
    if (!porSeccion[item.seccion]) porSeccion[item.seccion] = [];
    porSeccion[item.seccion].push(item);
  }

  return { items, porSeccion };
}

/**
 * Agrega un bloque de contenido (RF-05).
 *
 * @param {number} idUsuario
 * @param {object} datos - Ya validados: tipo, seccion, titulo, detalle, idCategoria.
 * @returns {Promise<object>} El contenido creado.
 */
async function crearContenido(idUsuario, datos) {
  const perfil = await perfilDeLaCuenta(idUsuario);
  const { clase } = TIPOS[datos.tipo];

  const { categoria, detalle } = await resolverCategoriaYDetalle(
    datos.tipo, datos.idCategoria, datos.detalle
  );

  // Se coloca al final de su sección
  const orden = await contenidoRepository.siguienteOrden(perfil.id_perfil, datos.seccion);

  const comun = { ...datos, detalle, idPerfil: perfil.id_perfil, orden };

  const id = clase === 'enlace'
    ? await contenidoRepository.crearEnlace(comun)
    : await contenidoRepository.crearElemento({ ...comun, tipo: categoria.nombre });

  const fila = await contenidoRepository.buscarPorId(clase, id, perfil.id_perfil);

  return aRespuesta(fila);
}

/**
 * Edita un bloque existente (RF-06).
 *
 * El tipo no se puede cambiar: un enlace vive en otra tabla que un texto, y
 * cambiarlo seria borrar uno y crear otro. La pantalla tampoco lo ofrece.
 *
 * @param {number} idUsuario
 * @param {string} idContenido
 * @param {object} datos
 * @returns {Promise<object>}
 * @throws {Error} 404 si no existe o no es de esta cuenta.
 */
async function actualizarContenido(idUsuario, idContenido, datos) {
  const perfil = await perfilDeLaCuenta(idUsuario);
  const { clase, id } = descomponerId(idContenido);

  // El tipo no viaja en el PUT: se deduce de la tabla donde ya vive el bloque
  const tipo = clase === 'enlace' ? 'enlace' : 'texto';

  const { categoria, detalle } = await resolverCategoriaYDetalle(
    tipo, datos.idCategoria, datos.detalle
  );

  const filas = clase === 'enlace'
    ? await contenidoRepository.actualizarEnlace(id, perfil.id_perfil, { ...datos, detalle })
    : await contenidoRepository.actualizarElemento(id, perfil.id_perfil, {
      ...datos,
      detalle,
      tipo: categoria.nombre
    });

  if (filas === 0) throw noEncontrado();

  return aRespuesta(await contenidoRepository.buscarPorId(clase, id, perfil.id_perfil));
}

/**
 * Activa o desactiva un bloque (RF-06).
 *
 * Desactivar no es borrar: el bloque sigue en el panel pero deja de
 * aparecer en la vista pública. Sirve para una promoción que vuelve cada
 * temporada, sin tener que escribirla otra vez.
 */
async function cambiarEstadoContenido(idUsuario, idContenido, activo) {
  const perfil = await perfilDeLaCuenta(idUsuario);
  const { clase, id } = descomponerId(idContenido);

  const filas = await contenidoRepository.cambiarEstado(clase, id, perfil.id_perfil, activo);

  if (filas === 0) throw noEncontrado();

  return aRespuesta(await contenidoRepository.buscarPorId(clase, id, perfil.id_perfil));
}

/**
 * Elimina un bloque (RF-06).
 */
async function eliminarContenido(idUsuario, idContenido) {
  const perfil = await perfilDeLaCuenta(idUsuario);
  const { clase, id } = descomponerId(idContenido);

  const filas = await contenidoRepository.eliminar(clase, id, perfil.id_perfil);

  if (filas === 0) throw noEncontrado();
}

/**
 * Reordena una sección completa.
 *
 * Se recibe la lista de identificadores en el orden deseado, que es como lo
 * sabe la pantalla después de arrastrar. Se comprueba que todos sean de esta
 * cuenta antes de tocar nada: así no queda la sección a medio reordenar.
 *
 * @param {number} idUsuario
 * @param {string[]} ids
 */
async function reordenarContenido(idUsuario, ids) {
  const perfil = await perfilDeLaCuenta(idUsuario);

  const partes = ids.map(descomponerId);

  for (const { clase, id } of partes) {
    const fila = await contenidoRepository.buscarPorId(clase, id, perfil.id_perfil);

    if (!fila) throw noEncontrado();
  }

  for (let i = 0; i < partes.length; i += 1) {
    const { clase, id } = partes[i];

    await contenidoRepository.fijarOrden(clase, id, perfil.id_perfil, i + 1);
  }
}

function noEncontrado() {
  const error = new Error('El contenido no existe o no pertenece a esta cuenta');
  error.status = 404;
  return error;
}

/**
 * Categorías disponibles para la pantalla (las ocho del RF-05 y las de los
 * elementos).
 */
async function listarCategorias() {
  return contenidoRepository.listarCategorias();
}

module.exports = {
  listarMiContenido,
  crearContenido,
  actualizarContenido,
  cambiarEstadoContenido,
  eliminarContenido,
  reordenarContenido,
  listarCategorias,
  TIPOS,
  descomponerId
};
