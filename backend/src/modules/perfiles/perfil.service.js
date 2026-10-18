// ============================================
// PERFIL.SERVICE.JS — reglas del perfil empresarial (RF-04)
// Genera el slug, decide que se puede cambiar y da forma a la respuesta.
// No conoce HTTP: no usa req ni res.
// ============================================

const crypto = require('crypto');

const perfilRepository = require('./perfil.repository');

const LARGO_MAXIMO_SLUG = 60;

/**
 * Convierte un nombre en una cadena apta para una URL.
 *
 * "Panadería La Espiga" -> "panaderia-la-espiga"
 *
 * Se quitan los acentos antes de descartar lo que no sea una letra o un
 * numero; si no, "panadería" quedaria como "panader-a".
 */
function convertirEnSlug(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_MAXIMO_SLUG);
}

/**
 * Genera un slug libre a partir del nombre del negocio.
 *
 * Dos negocios pueden llamarse igual, y la columna es UNIQUE, asi que al
 * repetirse se agrega un sufijo: panaderia-la-espiga, panaderia-la-espiga-2...
 *
 * @param {string} nombreNegocio
 * @returns {Promise<string>}
 */
async function generarSlugUnico(nombreNegocio) {
  const base = convertirEnSlug(nombreNegocio) || 'negocio';

  if (!(await perfilRepository.slugEnUso(base))) return base;

  // El limite evita un bucle infinito si algo va mal; 200 homonimos es muy
  // por encima de lo que este sistema va a ver.
  for (let sufijo = 2; sufijo <= 200; sufijo += 1) {
    const candidato = `${base.slice(0, LARGO_MAXIMO_SLUG - 4)}-${sufijo}`;

    if (!(await perfilRepository.slugEnUso(candidato))) return candidato;
  }

  const error = new Error('No se pudo generar una dirección pública para el negocio');
  error.status = 409;
  throw error;
}

/**
 * Pasa una fila de la base al formato que usa la API.
 * Las claves van en camelCase, como en el resto de los modulos.
 */
function aRespuesta(fila) {
  return {
    idPerfil: fila.id_perfil,
    nombreNegocio: fila.nombre_negocio,
    categoria: fila.categoria,
    descripcion: fila.descripcion,
    direccion: fila.direccion,
    telefono: fila.telefono,
    correoContacto: fila.correo_contacto,
    instagram: fila.instagram,
    horario: fila.horario,
    imagen: fila.imagen,
    // El color de marca del negocio. La vista publica tambien lo usa, asi
    // que quien escanea el codigo ve los colores que eligio el negocio.
    tema: fila.tema,
    slug: fila.slug,
    urlPublica: `/p/${fila.slug}`,
    fechaCreacion: fila.fecha_creacion,
    fechaActualizacion: fila.fecha_actualizacion
  };
}

/**
 * Crea el perfil de una cuenta recien registrada.
 *
 * Se llama desde el registro, dentro de la misma transaccion, para que
 * ninguna cuenta quede sin perfil. Si no llega el nombre del negocio se usa
 * el de la cuenta: siempre hay algo que mostrar.
 *
 * @param {object} datos
 * @param {number} datos.idUsuario
 * @param {string} datos.nombreNegocio
 * @param {object} [conexion] - Conexion de la transaccion en curso.
 * @returns {Promise<{idPerfil: number, slug: string}>}
 */
async function crearParaUsuario(datos, conexion) {
  const slug = await generarSlugUnico(datos.nombreNegocio);

  try {
    const idPerfil = await perfilRepository.crear({ ...datos, slug }, conexion);

    return { idPerfil, slug };
  } catch (error) {
    // Entre la comprobacion y el INSERT, otro registro simultaneo pudo tomar
    // el mismo slug: cada transaccion no ve las filas que la otra todavia no
    // confirmo. El UNIQUE de la columna lo impide, y aqui se resuelve con un
    // sufijo aleatorio en lugar de devolver un error.
    const esSlugRepetido =
      error.code === 'ER_DUP_ENTRY' && String(error.message).includes('uq_perfil_slug');

    if (!esSlugRepetido) throw error;

    const sufijo = crypto.randomBytes(3).toString('hex');
    const slugAlterno = `${slug.slice(0, LARGO_MAXIMO_SLUG - 7)}-${sufijo}`;

    console.warn('Slug ocupado por otro registro simultaneo; se usa', slugAlterno);

    const idPerfil = await perfilRepository.crear(
      { ...datos, slug: slugAlterno },
      conexion
    );

    return { idPerfil, slug: slugAlterno };
  }
}

/**
 * Devuelve el perfil de la cuenta autenticada.
 *
 * @param {number} idUsuario
 * @returns {Promise<object>}
 * @throws {Error} 404 si la cuenta no tiene perfil.
 */
async function obtenerMiPerfil(idUsuario) {
  const perfil = await perfilRepository.buscarPorUsuario(idUsuario);

  if (!perfil) {
    // Les ocurre a las cuentas creadas antes de que el registro creara el
    // perfil, y a las que crea el administrador desde POST /api/usuarios.
    const error = new Error('Esta cuenta todavía no tiene un perfil empresarial');
    error.status = 404;
    throw error;
  }

  return aRespuesta(perfil);
}

/**
 * Actualiza el perfil de la cuenta autenticada.
 *
 * Si la cuenta no tenia perfil, se crea: asi la pantalla de Configuracion
 * funciona igual para una cuenta antigua que para una recien registrada, sin
 * tener que distinguir entre crear y editar.
 *
 * @param {number} idUsuario
 * @param {object} datos - Ya validados por el validador (RF-10).
 * @returns {Promise<object>} El perfil como queda guardado.
 */
async function actualizarMiPerfil(idUsuario, datos) {
  const existente = await perfilRepository.buscarPorUsuario(idUsuario);

  if (!existente) {
    await crearParaUsuario({ ...datos, idUsuario });
  } else {
    await perfilRepository.actualizarPorUsuario(idUsuario, datos);
  }

  // Se vuelve a leer para devolver lo que quedo guardado de verdad, con el
  // slug y la fecha de actualizacion que puso la base.
  return aRespuesta(await perfilRepository.buscarPorUsuario(idUsuario));
}

module.exports = {
  crearParaUsuario,
  obtenerMiPerfil,
  actualizarMiPerfil,
  generarSlugUnico,
  convertirEnSlug
};
