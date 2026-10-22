// ============================================
// USUARIO.SERVICE.JS — reglas de negocio del modulo Usuarios
// Esta capa no conoce HTTP: no usa req ni res. Recibe datos, aplica las
// reglas del proyecto y devuelve datos o lanza errores con su codigo.
// ============================================

const bcrypt = require('bcrypt');
const usuarioRepository = require('./usuario.repository');

const ROLES_VALIDOS = ['empresa', 'administrador'];
const RONDAS_BCRYPT = 10;

/**
 * Registra un usuario nuevo aplicando las reglas RN-01 y RN-02.
 * @param {{nombre: string, correo: string, contrasena: string, rol?: string}} datosUsuario
 * @returns {Promise<object>} Usuario creado, sin la contrasena.
 * @throws {Error} 409 si el correo ya existe; 400 si el rol no es valido.
 */
async function crearUsuario(datosUsuario, conexion) {
  const { nombre, correo, contrasena, rol = 'empresa' } = datosUsuario;

  // RN-01: el correo debe ser unico
  const usuarioExistente = await usuarioRepository.buscarPorCorreo(correo);

  if (usuarioExistente) {
    const error = new Error('El correo ya está registrado');
    error.status = 409;
    throw error;
  }

  // El rol debe ser uno de los valores permitidos por el ENUM de la tabla
  if (!ROLES_VALIDOS.includes(rol)) {
    const error = new Error('El rol indicado no existe');
    error.status = 400;
    throw error;
  }

  // RN-02: la contrasena se almacena cifrada, nunca en texto plano
  const contrasenaCifrada = await bcrypt.hash(contrasena, RONDAS_BCRYPT);

  const idUsuario = await usuarioRepository.crear({
    nombre,
    correo,
    contrasena: contrasenaCifrada,
    rol
  }, conexion);

  // La contrasena nunca se devuelve al cliente
  return { idUsuario, nombre, correo, rol };
}

/**
 * Da forma de respuesta a una fila de la tabla.
 *
 * El modulo devolvia las filas tal como salen de MySQL -id_usuario,
 * fecha_registro-, mientras que el inicio de sesion y GET /usuarios/me ya
 * respondian en camelCase. La misma entidad llegaba al cliente con dos
 * nombres distintos segun por donde se pidiera.
 *
 * Se enumera campo por campo a proposito, igual que en la vista publica: si
 * manana se agrega una columna a la tabla, no se filtra sola.
 *
 * @param {object|undefined} fila
 * @returns {object|undefined}
 */
function aRespuesta(fila) {
  if (!fila) return fila;

  return {
    idUsuario: fila.id_usuario,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    estado: fila.estado,
    fechaRegistro: fila.fecha_registro
  };
}

/**
 * Devuelve todos los usuarios activos.
 * @returns {Promise<object[]>}
 */
async function listarUsuarios() {
  const filas = await usuarioRepository.listar();

  return filas.map(aRespuesta);
}

/**
 * Consulta un usuario por su identificador.
 * @param {number|string} idUsuario
 * @returns {Promise<object>}
 * @throws {Error} 404 si el usuario no existe.
 */
async function obtenerUsuarioPorId(idUsuario) {
  const usuario = await usuarioRepository.buscarPorId(idUsuario);

  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  return aRespuesta(usuario);
}

/**
 * Actualiza los datos del usuario. No modifica la contrasena.
 * @param {number|string} idUsuario
 * @param {{nombre: string, correo: string, rol: string}} datosUsuario
 * @returns {Promise<object>} Usuario actualizado.
 * @throws {Error} 404 si no existe; 409 si el correo es de otro usuario; 400 si el rol no es valido.
 */
async function actualizarUsuario(idUsuario, datosUsuario) {
  await obtenerUsuarioPorId(idUsuario);

  // RN-01: el correo sigue siendo unico, salvo que sea el del propio usuario
  const correoExistente = await usuarioRepository.buscarPorCorreo(datosUsuario.correo);

  if (correoExistente && correoExistente.id_usuario !== Number(idUsuario)) {
    const error = new Error('El correo ya está registrado');
    error.status = 409;
    throw error;
  }

  if (!ROLES_VALIDOS.includes(datosUsuario.rol)) {
    const error = new Error('El rol indicado no existe');
    error.status = 400;
    throw error;
  }

  await usuarioRepository.actualizar(idUsuario, datosUsuario);

  return aRespuesta(await usuarioRepository.buscarPorId(idUsuario));
}

/**
 * Activa o restringe la cuenta de un usuario (RN-23).
 * @param {number|string} idUsuario
 * @param {string} estado - activo o restringido.
 * @returns {Promise<object>} Usuario actualizado.
 */
async function cambiarEstadoUsuario(idUsuario, estado, idSolicitante) {
  await obtenerUsuarioPorId(idUsuario);

  // Restringirse a uno mismo cierra el acceso en la misma peticion que lo
  // pide. Reactivarse no hace dano, asi que solo se corta ese caso.
  if (estado === 'restringido') {
    noContraUnoMismo(idUsuario, idSolicitante, 'restringir');
  }

  await usuarioRepository.actualizarEstado(idUsuario, estado);

  return aRespuesta(await usuarioRepository.buscarPorId(idUsuario));
}

/**
 * Impide que un administrador se aplique a si mismo una accion que lo
 * dejaria fuera.
 *
 * El README daba esta regla por aplicada y no lo estaba: lo encontraron las
 * pruebas automaticas. Un administrador podia eliminar su propia cuenta
 * desde la administracion -sin confirmar la contrasena, que es lo que si
 * pide "Eliminar mi cuenta" en Configuracion- y podia restringirse, con lo
 * que perdia el acceso en la misma peticion. Si fuera el unico, nadie
 * podria volver a administrar el sistema.
 *
 * @param {number|string} idUsuario - A quien se le aplica.
 * @param {number|string} idSolicitante - Quien lo pide.
 * @param {string} accion - Para el mensaje.
 */
function noContraUnoMismo(idUsuario, idSolicitante, accion) {
  if (Number(idUsuario) !== Number(idSolicitante)) return;

  const error = new Error(`Un administrador no puede ${accion} su propia cuenta`);
  error.status = 400;
  throw error;
}

/**
 * Elimina logicamente un usuario: deja de estar disponible, pero su
 * informacion y sus relaciones se conservan.
 *
 * @param {number|string} idUsuario
 * @param {number|string} idSolicitante
 */
async function eliminarUsuario(idUsuario, idSolicitante) {
  await obtenerUsuarioPorId(idUsuario);

  // Para darse de baja esta DELETE /api/usuarios/me, que pide la contrasena
  noContraUnoMismo(idUsuario, idSolicitante, 'eliminar');

  await usuarioRepository.eliminarLogico(idUsuario);
}

module.exports = {
  crearUsuario,
  listarUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario
};
