// ============================================
// AUTH.REPOSITORY.JS — acceso a datos del modulo Auth
// Consulta la informacion necesaria para autenticar al usuario
// y comprobar que su cuenta siga habilitada.
// ============================================

const pool = require('../../config/database');

/**
 * Busca un usuario por correo incluyendo la contrasena cifrada.
 * Es la unica consulta del backend que selecciona ese campo, y solo
 * para compararlo con bcrypt dentro del Service.
 *
 * @param {string} correo
 * @returns {Promise<object|undefined>} Usuario con su hash, o undefined.
 */
async function buscarPorCorreo(correo) {
  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, correo, contrasena, rol, estado
     FROM usuario
     WHERE correo = ? AND deleted_at IS NULL`,
    [correo]
  );

  return filas[0];
}

/**
 * Busca un usuario por su identificador, sin la contrasena.
 * La usa el middleware de autenticacion en cada peticion protegida,
 * para comprobar que la cuenta siga activa y no haya sido eliminada.
 *
 * @param {number|string} idUsuario
 * @returns {Promise<object|undefined>}
 */
async function buscarPorId(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, correo, rol, estado
     FROM usuario
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [idUsuario]
  );

  return filas[0];
}

module.exports = {
  buscarPorCorreo,
  buscarPorId
};
