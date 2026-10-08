// ============================================
// USUARIO.CONTROLLER.JS — interaccion HTTP del modulo Usuarios
// Recibe la peticion, delega el trabajo al Service y prepara la respuesta.
// No contiene reglas de negocio ni consultas SQL.
// ============================================

const usuarioService = require('./usuario.service');

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

module.exports = {
  crearUsuario
};
