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
    `SELECT id_usuario, nombre, correo, rol, estado, sesiones_validas_desde
     FROM usuario
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [idUsuario]
  );

  return filas[0];
}

/**
 * Busca un usuario por identificador incluyendo la contrasena cifrada.
 *
 * Es aparte de buscarPorId porque esa la usa el middleware en cada peticion
 * protegida, y alli el hash no hace falta: no conviene sacarlo de la base
 * mas veces de las necesarias. Aqui si, para comprobar la contrasena actual
 * antes de cambiarla.
 *
 * @param {number} idUsuario
 * @returns {Promise<object|undefined>}
 */
async function buscarPorIdConContrasena(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT id_usuario, nombre, correo, contrasena, rol, estado
     FROM usuario
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [idUsuario]
  );

  return filas[0];
}

/**
 * Anota que la cuenta acaba de iniciar sesion (RF-13).
 *
 * Es el dato que no se podia calcular con nada de lo que ya habia, y el que
 * hace falta para "eliminar usuarios inactivos" del RF-14.
 *
 * @param {number} idUsuario
 */
async function registrarAcceso(idUsuario) {
  await pool.execute('UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = ?', [idUsuario]);
}

/**
 * Guarda el hash de un token de recuperacion (RF-03).
 * Nunca se almacena el token en claro: si alguien leyera la tabla,
 * no podria construir el enlace.
 *
 * @param {number} idUsuario
 * @param {string} tokenHash
 * @param {Date} expiraEn
 * @returns {Promise<number>} Identificador del token.
 */
async function crearTokenRecuperacion(idUsuario, tokenHash, expiraEn) {
  const [resultado] = await pool.execute(
    `INSERT INTO token_recuperacion (token_hash, expira_en, id_usuario)
     VALUES (?, ?, ?)`,
    [tokenHash, expiraEn, idUsuario]
  );

  return resultado.insertId;
}

/**
 * Busca un token vigente: que no haya expirado ni se haya usado.
 * @param {string} tokenHash
 * @returns {Promise<object|undefined>}
 */
async function buscarTokenVigente(tokenHash) {
  const [filas] = await pool.execute(
    `SELECT id_token, id_usuario, expira_en
     FROM token_recuperacion
     WHERE token_hash = ?
       AND usado_en IS NULL
       AND expira_en > NOW()`,
    [tokenHash]
  );

  return filas[0];
}

/**
 * Marca el token como usado: el enlace sirve una sola vez (RN-04).
 * @param {number} idToken
 */
async function marcarTokenUsado(idToken) {
  const [resultado] = await pool.execute(
    'UPDATE token_recuperacion SET usado_en = NOW() WHERE id_token = ?',
    [idToken]
  );

  return resultado.affectedRows;
}

/**
 * Invalida los tokens anteriores del usuario al solicitar uno nuevo,
 * para que solo el ultimo enlace enviado sea valido.
 * @param {number} idUsuario
 */
async function invalidarTokensAnteriores(idUsuario) {
  const [resultado] = await pool.execute(
    `UPDATE token_recuperacion
     SET usado_en = NOW()
     WHERE id_usuario = ? AND usado_en IS NULL`,
    [idUsuario]
  );

  return resultado.affectedRows;
}

/**
 * Cambia la contrasena del usuario. Recibe el hash ya calculado.
 * @param {number} idUsuario
 * @param {string} contrasenaCifrada
 */
async function actualizarContrasena(idUsuario, contrasenaCifrada) {
  const [resultado] = await pool.execute(
    `UPDATE usuario
     SET contrasena = ?
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [contrasenaCifrada, idUsuario]
  );

  return resultado.affectedRows;
}

/**
 * Anota el token como revocado al cerrar sesion (RF-02).
 *
 * Usa INSERT IGNORE porque cerrar sesion dos veces con el mismo token no
 * es un error: la segunda vez el jti ya esta en la tabla y basta con dejarlo
 * como esta. El UNIQUE de la columna es el que hace que no se duplique.
 *
 * @param {string} jti - Identificador del token.
 * @param {number} idUsuario
 * @param {Date} expiraEn - Vencimiento del propio token.
 */
async function revocarSesion(jti, idUsuario, expiraEn) {
  const [resultado] = await pool.execute(
    `INSERT IGNORE INTO sesion_revocada (jti, id_usuario, expira_en)
     VALUES (?, ?, ?)`,
    [jti, idUsuario, expiraEn]
  );

  return resultado.affectedRows;
}

/**
 * Comprueba si un token fue revocado. La consulta el middleware de
 * autenticacion en cada peticion protegida.
 *
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
async function sesionRevocada(jti) {
  const [filas] = await pool.execute(
    'SELECT id_sesion FROM sesion_revocada WHERE jti = ?',
    [jti]
  );

  return filas.length > 0;
}

/**
 * Elimina las revocaciones cuyo token ya habria vencido por si solo.
 * Mantenerlas no cambiaria ninguna respuesta y la tabla creceria sin fin.
 */
async function limpiarSesionesVencidas() {
  const [resultado] = await pool.execute(
    'DELETE FROM sesion_revocada WHERE expira_en < NOW()'
  );

  return resultado.affectedRows;
}

/**
 * Cierra todas las sesiones de un usuario (migracion 006).
 *
 * No borra tokens: marca el momento del corte. El middleware rechaza despues
 * cualquier token firmado antes de esa fecha, sin importar cuantos haya ni
 * desde que dispositivo se emitieron.
 *
 * Se llama al restablecer o cambiar la contrasena: si alguien recupero su
 * cuenta porque se la habian tomado, las sesiones del intruso deben morir ahi.
 *
 * @param {number} idUsuario
 */
async function cerrarTodasLasSesiones(idUsuario) {
  const [resultado] = await pool.execute(
    `UPDATE usuario
     SET sesiones_validas_desde = NOW()
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [idUsuario]
  );

  // Las revocaciones una por una de este usuario quedan de sobra: la fecha
  // de corte ya cubre todos sus tokens anteriores.
  await pool.execute('DELETE FROM sesion_revocada WHERE id_usuario = ?', [idUsuario]);

  return resultado.affectedRows;
}

module.exports = {
  registrarAcceso,
  buscarPorCorreo,
  buscarPorId,
  buscarPorIdConContrasena,
  cerrarTodasLasSesiones,
  revocarSesion,
  sesionRevocada,
  limpiarSesionesVencidas,
  crearTokenRecuperacion,
  buscarTokenVigente,
  marcarTokenUsado,
  invalidarTokensAnteriores,
  actualizarContrasena
};
