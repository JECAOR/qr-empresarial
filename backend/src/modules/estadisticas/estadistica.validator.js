// ============================================
// ESTADISTICA.VALIDATOR.JS — validacion del registro de eventos (RF-11)
//
// Este cuerpo llega desde la vista publica, que es una pantalla abierta: nada
// de lo que trae es de fiar. Aqui se comprueba la forma; que el enlace sea de
// ese perfil lo comprueba el Service, porque necesita consultar la base.
// ============================================

const { TIPOS } = require('./estadistica.service');

/**
 * Valida el cuerpo de POST /api/publico/:slug/eventos.
 */
function validarEvento(req, res, next) {
  const { tipo, idEnlace } = req.body || {};

  if (!TIPOS.includes(tipo)) {
    return res.status(400).json({
      message: `El tipo de evento debe ser uno de: ${TIPOS.join(', ')}`
    });
  }

  if (tipo === 'clic') {
    const id = Number(idEnlace);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: 'Un clic debe indicar el enlace que se pulso'
      });
    }

    req.body.idEnlace = id;
  }

  next();
}

module.exports = { validarEvento };
