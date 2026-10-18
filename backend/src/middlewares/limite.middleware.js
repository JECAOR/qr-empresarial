// ============================================
// LIMITE.MIDDLEWARE.JS — limite de intentos (RN-03)
// Protege el inicio de sesion y la solicitud de recuperacion contra
// intentos repetidos desde la misma direccion IP.
//
// Cada endpoint tiene su propio contador: agotar los intentos de login
// no debe impedir solicitar la recuperacion de la contrasena.
// ============================================

const { rateLimit, MemoryStore } = require('express-rate-limit');

// Se guarda el almacen de cada limitador para poder vaciarlo entre
// pruebas. Sin esto, las pruebas que comprueban un 401 gastarian el cupo
// de las siguientes y la suite fallaria por el orden en que corre, no por
// el codigo. No baja ningun limite: en produccion nadie llama a reiniciar.
const almacenes = [];

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
  const almacen = new MemoryStore();

  almacenes.push(almacen);

  return rateLimit({
    store: almacen,
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

// Registro de eventos de la vista publica (RF-11).
//
// Es un endpoint abierto que escribe en la tabla que mas crece del esquema,
// asi que conviene un techo: sin el, cualquiera podria inflar las
// estadisticas de un negocio -o llenar la base- con un bucle.
//
// El cupo es alto a proposito: una misma conexion puede traer a varias
// personas (la red de un local, una oficina) y cada visita legitima registra
// uno o dos eventos. 120 en quince minutos deja sitio de sobra para eso y
// corta un abuso evidente.
const limitarEventos = crearLimitador({
  maxIntentos: 120,
  descripcion: 'registro de eventos',
  soloFallidos: false
});

/**
 * Vacia los contadores de los tres limitadores.
 *
 * Solo lo usan las pruebas automaticas (backend/tests). La aplicacion no lo
 * llama nunca: si lo hiciera, el limite del RN-03 dejaria de servir.
 */
function reiniciarContadores() {
  return Promise.all(almacenes.map((a) => a.resetAll()));
}

module.exports = {
  limitarLogin,
  limitarRecuperacion,
  limitarEventos,
  reiniciarContadores
};
