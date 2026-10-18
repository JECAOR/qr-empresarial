// ============================================
// PUBLICO.SERVICE.JS — reglas de la vista publica (RF-09)
//
// "Mostrar la informacion actualizada del perfil cuando el codigo QR sea
// escaneado, sin generar un nuevo codigo": el codigo lleva siempre a la misma
// direccion y lo que se devuelve aqui es el estado de ahora. No hay nada que
// regenerar, y de eso depende que un codigo impreso siga sirviendo.
// ============================================

const publicoRepository = require('./publico.repository');

/**
 * Error unico para "no hay nada que mostrar".
 *
 * Se responde lo mismo si el perfil no existe, si la cuenta fue restringida o
 * si el codigo QR esta desactivado. Distinguirlos le diria a cualquiera que
 * ese negocio existe y esta suspendido, y eso no es asunto de quien escanea.
 */
function noDisponible() {
  const error = new Error('Este perfil no está disponible');
  error.status = 404;
  return error;
}

/**
 * Da forma publica al perfil. Se enumera campo por campo a proposito: asi,
 * si manana se agrega una columna a la tabla, no se filtra sola.
 */
function perfilPublico(fila) {
  return {
    nombreNegocio: fila.nombre_negocio,
    categoria: fila.categoria,
    descripcion: fila.descripcion,
    direccion: fila.direccion,
    telefono: fila.telefono,
    correoContacto: fila.correo_contacto,
    instagram: fila.instagram,
    horario: fila.horario,
    imagen: fila.imagen,
    slug: fila.slug,
    actualizadoEn: fila.fecha_actualizacion
  };
}

function contenidoPublico(fila) {
  return {
    id: `${fila.clase}-${fila.id}`,
    tipo: fila.clase === 'enlace' ? 'enlace' : (fila.categoria === 'Botón' ? 'boton' : 'texto'),
    seccion: fila.seccion,
    titulo: fila.titulo,
    detalle: fila.detalle,
    categoria: fila.categoria,
    icono: fila.icono
  };
}

/**
 * Devuelve el perfil publico y su contenido visible.
 *
 * @param {string} slug
 * @returns {Promise<{perfil: object, contenido: object[], porSeccion: object}>}
 * @throws {Error} 404 si no hay nada que mostrar.
 */
async function obtenerPerfilPublico(slug) {
  if (typeof slug !== 'string' || !slug.trim()) throw noDisponible();

  const fila = await publicoRepository.buscarPerfilPublicable(slug.trim());

  if (!fila) throw noDisponible();

  const filas = await publicoRepository.listarContenidoVisible(fila.id_perfil);
  const contenido = filas.map(contenidoPublico);

  const porSeccion = {};

  for (const item of contenido) {
    if (!porSeccion[item.seccion]) porSeccion[item.seccion] = [];
    porSeccion[item.seccion].push(item);
  }

  return { perfil: perfilPublico(fila), contenido, porSeccion };
}

module.exports = { obtenerPerfilPublico };
