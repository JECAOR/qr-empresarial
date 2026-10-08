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

module.exports = {
  crearUsuario
};
