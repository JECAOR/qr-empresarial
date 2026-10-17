// ============================================
// LIMITE.MIDDLEWARE.JS — limite de intentos (RN-03)
// Protege el inicio de sesion y la solicitud de recuperacion contra
// intentos repetidos desde la misma direccion IP.
//
// Cada endpoint tiene su propio contador: agotar los intentos de login
// no debe impedir solicitar la recuperacion de la contrasena.
// ============================================

const rateLimit = require('express-rate-limit');

const MINUTOS_BLOQUEO = 15;

function crearLimitador(maxIntentos, descripcion) {
  return rateLimit({
    windowMs: MINUTOS_BLOQUEO * 60 * 1000,
    limit: maxIntentos,
    standardHeaders: 'draft-7',
    legacyHeaders: false,

    // Solo cuentan los intentos fallidos: quien acierta no gasta cupo
    skipSuccessfulRequests: true,

    handler: (req, res) => {
      console.warn(`Limite de ${descripcion} alcanzado desde ${req.ip}`);

      return res.status(429).json({
        message: `Demasiados intentos fallidos. Intente de nuevo en ${MINUTOS_BLOQUEO} minutos`
      });
    }
  });
}

// RN-03: maximo 5 intentos fallidos de inicio de sesion
const limitarLogin = crearLimitador(5, 'inicio de sesion');

// Evita que alguien use el formulario de recuperacion para enviar
// correos masivos a terceros
const limitarRecuperacion = crearLimitador(3, 'solicitudes de recuperacion');

module.exports = {
  limitarLogin,
  limitarRecuperacion
};
