// ============================================
// QR.CONTROLLER.JS — interaccion HTTP del modulo QR (RF-07, RF-08)
// ============================================

const qrService = require('./qr.service');

/**
 * GET /api/qr — devuelve el codigo QR de la cuenta.
 */
async function obtenerMiQr(req, res, next) {
  try {
    const qr = await qrService.obtenerMiQr(req.usuario.id);

    return res.status(200).json({ data: qr });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/qr — genera el codigo QR del perfil (RF-07).
 *
 * Si ya existia se devuelve 200 con el mismo; solo el primero responde 201.
 * Asi la pantalla puede llamar sin preguntar antes y el resultado es el
 * mismo las dos veces.
 */
async function generarMiQr(req, res, next) {
  try {
    const { qr, yaExistia } = await qrService.generarMiQr(req.usuario.id);

    return res.status(yaExistia ? 200 : 201).json({
      message: yaExistia
        ? 'Este perfil ya tenía un código QR'
        : 'Código QR generado correctamente',
      data: qr
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/qr/estado — activa o desactiva el codigo.
 */
async function cambiarEstado(req, res, next) {
  try {
    const qr = await qrService.cambiarEstadoMiQr(req.usuario.id, req.body.activo);

    return res.status(200).json({
      message: qr.activo ? 'Código QR activado' : 'Código QR desactivado',
      data: qr
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/qr/imagen — descarga la imagen del codigo (RF-08).
 *
 * Acepta ?formato=png|svg|pdf, ?tamano y ?color. Responde el archivo, no
 * JSON, asi que el navegador lo descarga directamente.
 */
async function descargarImagen(req, res, next) {
  try {
    const { buffer, tipo, extension, nombre } = await qrService.generarImagen(
      req.usuario.id,
      req.query
    );

    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.${extension}"`);
    // El contenido depende de la cuenta que lo pide: no debe quedar en
    // ninguna cache compartida
    res.setHeader('Cache-Control', 'private, no-store');

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  obtenerMiQr,
  generarMiQr,
  cambiarEstado,
  descargarImagen
};
