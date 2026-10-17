// ============================================
// PERFIL.CONTROLLER.JS — interaccion HTTP del modulo Perfiles
// Recibe la peticion, delega en el Service y arma la respuesta.
// ============================================

const perfilService = require('./perfil.service');

/**
 * GET /api/perfiles/me — devuelve el perfil de la cuenta autenticada.
 * El identificador sale del token, nunca de la URL.
 */
async function obtenerMiPerfil(req, res, next) {
  try {
    const perfil = await perfilService.obtenerMiPerfil(req.usuario.id);

    return res.status(200).json({ data: perfil });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/perfiles/me — crea o actualiza el perfil de la cuenta autenticada.
 */
async function actualizarMiPerfil(req, res, next) {
  try {
    const perfil = await perfilService.actualizarMiPerfil(req.usuario.id, req.body);

    return res.status(200).json({
      message: 'Perfil empresarial guardado correctamente',
      data: perfil
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  obtenerMiPerfil,
  actualizarMiPerfil
};
