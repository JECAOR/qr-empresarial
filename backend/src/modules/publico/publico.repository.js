// ============================================
// PUBLICO.REPOSITORY.JS — acceso a datos de la vista pública (RF-09)
//
// Es la única capa del proyecto que sirve a alguien sin sesión: quien escanea
// el código QR no tiene cuenta. Por eso las consultas son explícitas sobre
// qué devuelven y qué filtran, y nunca seleccionan campos de la cuenta.
// ============================================

const pool = require('../../config/database');

/**
 * Busca un perfil publicable por su slug.
 *
 * Tres condiciones, y las tres importan:
 *   - La cuenta dueña está activa y no eliminada. Si se restringió o se dio
 *     de baja, su perfil deja de mostrarse (RN-23).
 *   - El código QR, si existe, no está desactivado. Desactivarlo es el
 *     interruptor que apaga la vista pública sin borrar nada.
 *   - Un perfil sin código generado sí se muestra: el enlace puede haberse
 *     compartido por WhatsApp o copiado a mano, sin pasar por el QR.
 *
 * No se seleccionan ni el correo de la cuenta ni su identificador: aquí no
 * tienen nada que hacer.
 *
 * @param {string} slug
 * @returns {Promise<object|undefined>}
 */
async function buscarPerfilPublicable(slug) {
  const [filas] = await pool.execute(
    `SELECT p.id_perfil, p.nombre_negocio, p.categoria, p.descripcion,
            p.direccion, p.telefono, p.correo_contacto, p.instagram,
            p.horario, p.imagen, p.tema, p.slug, p.fecha_actualizacion,
            q.activo AS qr_activo
     FROM perfil_empresarial p
     JOIN usuario u ON u.id_usuario = p.id_usuario
     LEFT JOIN codigo_qr q ON q.id_perfil = p.id_perfil
     WHERE p.slug = ?
       AND u.estado = 'activo'
       AND u.deleted_at IS NULL
       AND (q.activo IS NULL OR q.activo = 1)`,
    [slug]
  );

  return filas[0];
}

/**
 * Devuelve el contenido visible de un perfil.
 *
 * Solo lo activo: desactivar un bloque en el panel es exactamente esto, que
 * deje de aparecer aquí (RF-06).
 *
 * @param {number} idPerfil
 * @returns {Promise<object[]>}
 */
async function listarContenidoVisible(idPerfil) {
  const [filas] = await pool.execute(
    `SELECT 'enlace' AS clase, e.id_enlace AS id, e.titulo, e.seccion,
            e.url AS detalle, e.orden, c.nombre AS categoria, c.icono
     FROM enlace e
     JOIN categoria_enlace c ON c.id_categoria_enlace = e.id_categoria_enlace
     WHERE e.id_perfil = ? AND e.activo = 1

     UNION ALL

     SELECT 'elemento' AS clase, el.id_elemento AS id, el.titulo, el.seccion,
            el.contenido AS detalle, el.orden, c.nombre AS categoria, c.icono
     FROM elemento el
     JOIN categoria_elemento c ON c.id_categoria_elemento = el.id_categoria_elemento
     WHERE el.id_perfil = ? AND el.activo = 1

     ORDER BY seccion, orden, id`,
    [idPerfil, idPerfil]
  );

  return filas;
}

module.exports = {
  buscarPerfilPublicable,
  listarContenidoVisible
};
