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
async function crearUsuario(datosUsuario) {
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
  });

  // La contrasena nunca se devuelve al cliente
  return { idUsuario, nombre, correo, rol };
}

/**
 * Devuelve todos los usuarios activos.
 * @returns {Promise<object[]>}
 */
async function listarUsuarios() {
  return usuarioRepository.listar();
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

  return usuario;
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

  return usuarioRepository.buscarPorId(idUsuario);
}

/**
 * Activa o restringe la cuenta de un usuario (RN-23).
 * @param {number|string} idUsuario
 * @param {string} estado - activo o restringido.
 * @returns {Promise<object>} Usuario actualizado.
 */
async function cambiarEstadoUsuario(idUsuario, estado) {
  await obtenerUsuarioPorId(idUsuario);

  await usuarioRepository.actualizarEstado(idUsuario, estado);

  return usuarioRepository.buscarPorId(idUsuario);
}

/**
 * Elimina logicamente un usuario: deja de estar disponible, pero su
 * informacion y sus relaciones se conservan.
 * @param {number|string} idUsuario
 */
async function eliminarUsuario(idUsuario) {
  await obtenerUsuarioPorId(idUsuario);

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
