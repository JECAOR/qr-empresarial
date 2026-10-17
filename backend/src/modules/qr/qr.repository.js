// ============================================
// QR.REPOSITORY.JS — acceso a datos del código QR (RF-07)
//
// La tabla `codigo_qr` tiene `id_perfil` como UNIQUE, así que la base ya
// garantiza lo que pide el RF-07: un código por perfil empresarial. Aquí no
// hace falta comprobarlo, solo no pelearse con ello.
// ============================================

const pool = require('../../config/database');

const CAMPOS = `
  id_qr, codigo_qr, activo, fecha_creacion, fecha_actualizacion, id_perfil
`;

/**
 * Busca el código QR de un perfil.
 * @param {number} idPerfil
 * @returns {Promise<object|undefined>}
 */
async function buscarPorPerfil(idPerfil) {
  const [filas] = await pool.execute(
    `SELECT ${CAMPOS} FROM codigo_qr WHERE id_perfil = ?`,
    [idPerfil]
  );

  return filas[0];
}

/**
 * Crea el código QR de un perfil.
 *
 * @param {number} idPerfil
 * @param {string} url - La dirección que queda codificada.
 * @returns {Promise<number>}
 */
async function crear(idPerfil, url) {
  // La fecha y el estado los pone la base (migracion 009)
  const [resultado] = await pool.execute(
    'INSERT INTO codigo_qr (codigo_qr, id_perfil) VALUES (?, ?)',
    [url, idPerfil]
  );

  return resultado.insertId;
}

/**
 * Activa o desactiva el código.
 *
 * Desactivarlo no lo borra: el QR impreso sigue existiendo en el mundo, y
 * esta bandera es la que decide si la vista pública responde o no.
 *
 * @param {number} idPerfil
 * @param {boolean} activo
 * @returns {Promise<number>} Filas afectadas.
 */
async function cambiarEstado(idPerfil, activo) {
  // fecha_actualizacion la mantiene MySQL sola (ON UPDATE CURRENT_TIMESTAMP)
  const [resultado] = await pool.execute(
    'UPDATE codigo_qr SET activo = ? WHERE id_perfil = ?',
    [activo ? 1 : 0, idPerfil]
  );

  return resultado.affectedRows;
}

/**
 * Cuenta los bloques de contenido activos de un perfil.
 *
 * Lo necesita la regla del RF-07: no se genera un código que lleve a un
 * perfil vacío, porque quien lo escanee no encontraría nada.
 *
 * @param {number} idPerfil
 * @returns {Promise<number>}
 */
async function contarContenidoActivo(idPerfil) {
  const [filas] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM enlace   WHERE id_perfil = ? AND activo = 1) +
       (SELECT COUNT(*) FROM elemento WHERE id_perfil = ? AND activo = 1) AS total`,
    [idPerfil, idPerfil]
  );

  return Number(filas[0].total);
}

module.exports = {
  buscarPorPerfil,
  crear,
  cambiarEstado,
  contarContenidoActivo
};
