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
async function crear(usuario, conexion) {
  const { nombre, correo, contrasena, rol } = usuario;

  // Al registrarse, la cuenta y su perfil empresarial se crean en una misma
  // transaccion: se recibe esa conexion para participar en ella. Sin ella se
  // usa el pool, como el resto del proyecto.
  const ejecutor = conexion || pool;

  const [resultado] = await ejecutor.execute(
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

/**
 * Actualiza el nombre y el correo de una cuenta (RF-12).
 *
 * Es distinta de la actualizacion administrativa: esa tambien puede cambiar
 * el rol, y aqui nadie debe poder ascenderse a administrador cambiando sus
 * "datos personales".
 *
 * @param {number} idUsuario
 * @param {{nombre: string, correo: string}} datos
 * @returns {Promise<number>}
 */
async function actualizarDatosPropios(idUsuario, datos) {
  const [resultado] = await pool.execute(
    `UPDATE usuario
     SET nombre = ?, correo = ?
     WHERE id_usuario = ? AND deleted_at IS NULL`,
    [datos.nombre, datos.correo, idUsuario]
  );

  return resultado.affectedRows;
}

/**
 * Comprueba si otro usuario ya tiene ese correo (RN-01).
 *
 * Se excluye la propia cuenta: guardar el formulario sin cambiar el correo
 * no deberia chocar consigo mismo.
 *
 * @param {string} correo
 * @param {number} idUsuario
 * @returns {Promise<boolean>}
 */
async function correoUsadoPorOtro(correo, idUsuario) {
  const [filas] = await pool.execute(
    `SELECT id_usuario FROM usuario
     WHERE correo = ? AND id_usuario <> ? AND deleted_at IS NULL`,
    [correo, idUsuario]
  );

  return filas.length > 0;
}

/**
 * Preferencias de avisos de una cuenta (RF-12).
 *
 * Devuelve undefined si la cuenta nunca guardo ninguna: la fila se crea al
 * guardar por primera vez, y hasta entonces valen los valores por defecto
 * de la tabla.
 *
 * @param {number} idUsuario
 * @returns {Promise<object|undefined>}
 */
async function buscarPreferencias(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT aviso_resumen, aviso_novedades, fecha_actualizacion
     FROM preferencia_usuario
     WHERE id_usuario = ?`,
    [idUsuario]
  );

  return filas[0];
}

/**
 * Guarda las preferencias de avisos.
 *
 * Un solo INSERT ... ON DUPLICATE KEY UPDATE en lugar de consultar y luego
 * decidir: la columna id_usuario es UNIQUE, asi que la base resuelve si toca
 * crear o actualizar, y no hay hueco entre la consulta y la escritura.
 *
 * @param {number} idUsuario
 * @param {{resumen: boolean, novedades: boolean}} prefs
 */
async function guardarPreferencias(idUsuario, prefs) {
  await pool.execute(
    `INSERT INTO preferencia_usuario
       (id_usuario, aviso_resumen, aviso_novedades)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       aviso_resumen = VALUES(aviso_resumen),
       aviso_novedades = VALUES(aviso_novedades)`,
    [idUsuario, prefs.resumen ? 1 : 0, prefs.novedades ? 1 : 0]
  );
}

module.exports = {
  buscarPorCorreo,
  crear,
  listar,
  buscarPorId,
  actualizar,
  actualizarEstado,
  eliminarLogico,
  actualizarDatosPropios,
  correoUsadoPorOtro,
  buscarPreferencias,
  guardarPreferencias
};
