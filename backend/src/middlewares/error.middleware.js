// ============================================
// ERROR.MIDDLEWARE.JS — manejo centralizado de errores
// Express reconoce este middleware porque recibe cuatro parametros.
// Recibe lo que los controladores envian con next(error) y lo convierte
// en una respuesta HTTP uniforme.
// ============================================

function errorHandler(error, req, res, next) {
  const status = error.status || 500;

  // Los errores inesperados se registran completos para poder investigarlos
  if (status >= 500) {
    console.error('Error no controlado:', error);
  }

  // Los errores controlados conservan su mensaje porque ayudan al cliente
  // a corregir. Los inesperados devuelven un texto generico: un mensaje
  // como "Duplicate entry ... for key usuario.correo" revelaria la
  // estructura interna de la base de datos.
  return res.status(status).json({
    message: status >= 500 ? 'Error interno del servidor' : error.message
  });
}

module.exports = errorHandler;
