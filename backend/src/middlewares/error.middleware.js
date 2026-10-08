// ============================================
// ERROR.MIDDLEWARE.JS — manejo centralizado de errores
// Express reconoce este middleware porque recibe cuatro parametros.
// Recibe lo que los controladores envian con next(error) y lo convierte
// en una respuesta HTTP uniforme.
// ============================================

function errorHandler(error, req, res, next) {
  const status = error.status || 500;

  // Los errores inesperados (500) se registran para poder investigarlos
  if (status === 500) {
    console.error('Error no controlado:', error);
  }

  return res.status(status).json({
    message: error.message || 'Error interno del servidor'
  });
}

module.exports = errorHandler;
