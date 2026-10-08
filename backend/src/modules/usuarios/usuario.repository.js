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

module.exports = {
  buscarPorCorreo,
  crear
};
