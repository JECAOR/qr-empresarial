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

/**
 * Construye un limitador por IP.
 *
 * @param {object} opciones
 * @param {number} opciones.maxIntentos
 * @param {string} opciones.descripcion - Para el mensaje y el registro.
 * @param {boolean} opciones.soloFallidos - Si es true, las respuestas
 *   correctas no gastan cupo. Solo sirve en endpoints que responden con
 *   error cuando el intento no es valido, como el login.
 */
function crearLimitador({ maxIntentos, descripcion, soloFallidos }) {
  return rateLimit({
    windowMs: MINUTOS_BLOQUEO * 60 * 1000,
    limit: maxIntentos,
    standardHeaders: 'draft-7',
    legacyHeaders: false,

    skipSuccessfulRequests: soloFallidos,

    handler: (req, res) => {
      console.warn(`Limite de ${descripcion} alcanzado desde ${req.ip}`);

      return res.status(429).json({
        message: `Demasiadas solicitudes. Intente de nuevo en ${MINUTOS_BLOQUEO} minutos`
      });
    }
  });
}

// RN-03: maximo 5 intentos fallidos de inicio de sesion.
// Quien acierta la contrasena no gasta cupo, de modo que un usuario
// legitimo nunca se topa con el bloqueo.
const limitarLogin = crearLimitador({
  maxIntentos: 5,
  descripcion: 'inicio de sesion',
  soloFallidos: true
});

// Evita que alguien use el formulario de recuperacion para enviar correos
// masivos a terceros.
//
// Aqui se cuentan TODAS las solicitudes, no solo las fallidas: el endpoint
// responde 200 siempre, exista o no el correo, para no revelar que cuentas
// hay registradas. Si solo se contaran las fallidas, el contador no subiria
// nunca y el limite no serviria de nada.
const limitarRecuperacion = crearLimitador({
  maxIntentos: 10,
  descripcion: 'solicitudes de recuperacion',
  soloFallidos: false
});

module.exports = {
  limitarLogin,
  limitarRecuperacion
};
