// ============================================
// QR.VALIDATOR.JS — validacion del modulo QR
//
// Las opciones de la imagen (formato, tamano y color) se validan en el
// Service, dentro de opcionesDeImagen(), porque ahi mismo se normalizan y no
// tiene sentido recorrer dos veces lo mismo.
// ============================================

/**
 * Valida el cuerpo de PATCH /api/qr/estado.
 */
function validarEstado(req, res, next) {
  if (typeof req.body?.activo !== 'boolean') {
    return res.status(400).json({
      message: 'El campo activo debe ser true o false'
    });
  }

  next();
}

module.exports = { validarEstado };
