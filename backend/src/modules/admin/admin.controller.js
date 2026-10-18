// ============================================
// ADMIN.CONTROLLER.JS — administracion (RF-13 y RF-15)
// ============================================

const adminService = require('./admin.service');

/**
 * GET /api/admin/resumen — cuantas cuentas hay y en que estado (RF-13).
 */
async function obtenerResumen(req, res, next) {
  try {
    return res.status(200).json({ data: await adminService.obtenerResumen() });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/usuarios — lista con la actividad de cada cuenta (RF-13).
 */
async function listarUsuarios(req, res, next) {
  try {
    const { usuarios, paginacion } = await adminService.listarUsuarios(req.filtros);

    return res.status(200).json({ data: usuarios, paginacion });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/usuarios/:idUsuario — detalle de una cuenta (RF-13).
 */
async function obtenerUsuario(req, res, next) {
  try {
    const usuario = await adminService.obtenerUsuario(req.params.idUsuario);

    return res.status(200).json({ data: usuario });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/reportes/usuarios — descarga el CSV (RF-15).
 *
 * Se manda como adjunto, no como texto que el navegador abra en una
 * pestana: lo que pide el requisito es DESCARGAR el reporte.
 */
async function descargarReporte(req, res, next) {
  try {
    const csv = await adminService.generarReporteCsv(req.filtros);

    const fecha = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="usuarios-${fecha}.csv"`);

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}

module.exports = { obtenerResumen, listarUsuarios, obtenerUsuario, descargarReporte };
