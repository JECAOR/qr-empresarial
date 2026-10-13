// ============================================
// AUTH.CONTROLLER.JS — interaccion HTTP del modulo Auth
// Recibe la peticion, delega en el Service y devuelve el token.
// ============================================

const authService = require('./auth.service');

/**
 * POST /api/auth/login — valida las credenciales y entrega un token.
 */
async function iniciarSesion(req, res, next) {
  try {
    const { correo, contrasena } = req.body;

    const resultado = await authService.iniciarSesion(correo, contrasena);

    return res.status(200).json({
      message: 'Inicio de sesión correcto',
      data: resultado
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/registro — registro publico de una empresa.
 */
async function registrar(req, res, next) {
  try {
    const usuario = await authService.registrar(req.body);

    return res.status(201).json({
      message: 'Cuenta creada correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  iniciarSesion,
  registrar
};
