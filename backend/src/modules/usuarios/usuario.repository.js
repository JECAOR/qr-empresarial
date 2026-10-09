// ============================================
// USUARIO.REPOSITORY.JS — acceso a datos del modulo Usuarios
// Unica capa que escribe consultas SQL. No contiene reglas de negocio
// ni conoce nada de HTTP: solo consulta y guarda informacion.
// ============================================

const pool = require('../../config/database');

/**
 * Busca un usuario por su correo, ignorando los eliminados logicamente.
 * @param {string} correo - Correo electronico a consultar.
 * @returns {Promise<object|undefined>} El usuario encontrado o undefined.
 */
async function buscarPorCorreo(correo) {
  const [filas] = await pool.execute(
    'SELECT id_usuario FROM usuario WHERE correo = ? AND deleted_at IS NULL',
    [correo]
  );

  return filas[0];
}

/**
 * Registra un usuario nuevo en la base de datos.
 * @param {{nombre: string, correo: string, contrasena: string, rol: string}} usuario
 * @returns {Promise<number>} Identificador asignado por MySQL.
 */
async function crear(usuario) {
  const { nombre, correo, contrasena, rol } = usuario;

  const [resultado] = await pool.execute(
    `INSERT INTO usuario (nombre, correo, contrasena, rol)
     VALUES (?, ?, ?, ?)`,
    [nombre, correo, contrasena, rol]
  );

  return resultado.insertId;
}

/**
 * Lista los usuarios que no han sido eliminados logicamente.
 * @returns {Promise<object[]>} Usuarios, sin la contrasena.
 */
async function listar() {
  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, correo, rol, estado, fecha_registro
     FROM usuario
     WHERE deleted_at IS NULL
     ORDER BY id_usuario`
  );

  return filas;
}

/**
 * Busca un usuario por su identificador.
 * @param {number|string} idUsuario
 * @returns {Promise<object|undefined>} El usuario o undefined si no existe.
 */
async function buscarPorId(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, correo, rol, estado, fecha_registro
     FROM usuario
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [idUsuario]
  );

  return filas[0];
}

/**
 * Actualiza los datos basicos del usuario. No modifica la contrasena.
 * @param {number|string} idUsuario
 * @param {{nombre: string, correo: string, rol: string}} usuario
 * @returns {Promise<number>} Filas modificadas.
 */
async function actualizar(idUsuario, usuario) {
  const { nombre, correo, rol } = usuario;

  const [resultado] = await pool.execute(
    `UPDATE usuario
     SET nombre = ?, correo = ?, rol = ?
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [nombre, correo, rol, idUsuario]
  );

  return resultado.affectedRows;
}

/**
 * Cambia el estado de la cuenta: activo o restringido (RN-23).
 * @param {number|string} idUsuario
 * @param {string} estado
 * @returns {Promise<number>} Filas modificadas.
 */
async function actualizarEstado(idUsuario, estado) {
  const [resultado] = await pool.execute(
    `UPDATE usuario
     SET estado = ?
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [estado, idUsuario]
  );

  return resultado.affectedRows;
}

/**
 * Eliminacion logica: marca la fecha de borrado y restringe la cuenta.
 * El registro permanece para no romper las relaciones con perfiles y QR.
 *
 * El correo se prefija con "eliminado_<id>_" porque la columna es UNIQUE
 * en toda la tabla: sin esto, la direccion quedaria ocupada para siempre
 * y un registro posterior con ese mismo correo fallaria en MySQL.
 *
 * @param {number|string} idUsuario
 * @returns {Promise<number>} Filas modificadas.
 */
async function eliminarLogico(idUsuario) {
  const [resultado] = await pool.execute(
    `UPDATE usuario
     SET deleted_at = NOW(),
         estado = 'restringido',
         correo = CONCAT('eliminado_', id_usuario, '_', correo)
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [idUsuario]
  );

  return resultado.affectedRows;
}

module.exports = {
  buscarPorCorreo,
  crear,
  listar,
  buscarPorId,
  actualizar,
  actualizarEstado,
  eliminarLogico
};
