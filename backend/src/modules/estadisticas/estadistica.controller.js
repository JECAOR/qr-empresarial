// ============================================
// ESTADISTICA.CONTROLLER.JS — interaccion HTTP de las estadisticas (RF-11)
// ============================================

const estadisticaService = require('./estadistica.service');

/**
 * GET /api/estadisticas — lo que muestra el panel.
 * Admite ?dias=7|30|90; cualquier otro valor cae en 7.
 */
async function obtenerMisEstadisticas(req, res, next) {
  try {
    const datos = await estadisticaService.obtenerMisEstadisticas(
      req.usuario.id,
      req.query.dias
    );

    // Son datos de una cuenta: no deben quedar en ninguna cache compartida
    res.setHeader('Cache-Control', 'private, no-store');

    return res.status(200).json({ data: datos });
  } catch (error) {
    next(error);
  }
}

module.exports = { obtenerMisEstadisticas };
