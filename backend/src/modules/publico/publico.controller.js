// ============================================
// PUBLICO.CONTROLLER.JS — interaccion HTTP de la vista publica (RF-09)
// ============================================

const publicoService = require('./publico.service');

/**
 * GET /api/publico/:slug — perfil y contenido visible, sin autenticacion.
 */
async function obtenerPerfilPublico(req, res, next) {
  try {
    const { perfil, contenido, porSeccion } = await publicoService.obtenerPerfilPublico(
      req.params.slug
    );

    // Se puede guardar en cache un rato: la informacion cambia cuando el
    // negocio la edita, no en cada escaneo, y un perfil muy visitado no
    // deberia consultar la base cada vez. Un minuto es poco para la base y
    // suficientemente poco para que una correccion se vea casi al momento.
    res.setHeader('Cache-Control', 'public, max-age=60');

    return res.status(200).json({ data: { perfil, contenido, porSeccion } });
  } catch (error) {
    next(error);
  }
}

module.exports = { obtenerPerfilPublico };
