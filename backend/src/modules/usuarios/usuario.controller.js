// ============================================
// USUARIO.CONTROLLER.JS — interaccion HTTP del modulo Usuarios
// Recibe la peticion, delega el trabajo al Service y prepara la respuesta.
// No contiene reglas de negocio ni consultas SQL.
// ============================================

const usuarioService = require('./usuario.service');
const authService = require('../auth/auth.service');

/**
 * POST /api/usuarios — registra un usuario nuevo.
 * @param {object} req - Peticion HTTP; los datos llegan en req.body.
 * @param {object} res - Respuesta HTTP.
 * @param {Function} next - Envia el error al middleware global.
 */
async function crearUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.crearUsuario(req.body);

    return res.status(201).json({
      message: 'Usuario creado correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios — lista los usuarios activos.
 */
async function listarUsuarios(req, res, next) {
  try {
    const usuarios = await usuarioService.listarUsuarios();

    return res.status(200).json({ data: usuarios });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios/:idUsuario — consulta un usuario.
 */
async function obtenerUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.obtenerUsuarioPorId(req.params.idUsuario);

    return res.status(200).json({ data: usuario });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/usuarios/:idUsuario — actualiza los datos del usuario.
 */
async function actualizarUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.actualizarUsuario(req.params.idUsuario, req.body);

    return res.status(200).json({
      message: 'Usuario actualizado correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/usuarios/:idUsuario/estado — activa o restringe la cuenta.
 */
async function cambiarEstadoUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.cambiarEstadoUsuario(
      req.params.idUsuario,
      req.body.estado
    );

    return res.status(200).json({
      message: 'Estado del usuario actualizado correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/usuarios/:idUsuario — eliminacion logica.
 */
async function eliminarUsuario(req, res, next) {
  try {
    await usuarioService.eliminarUsuario(req.params.idUsuario);

    return res.status(200).json({
      message: 'Usuario eliminado correctamente'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios/me — devuelve el perfil del usuario autenticado.
 * El identificador sale del token, no de la URL.
 */
async function obtenerMiPerfil(req, res, next) {
  try {
    const usuario = await authService.obtenerPerfil(req.usuario.id);

    return res.status(200).json({ data: usuario });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crearUsuario,
  obtenerMiPerfil,
  listarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario
};
