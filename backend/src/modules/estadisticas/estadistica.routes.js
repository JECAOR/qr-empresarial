// ============================================
// ESTADISTICA.ROUTES.JS — endpoints de las estadisticas (RF-11)
// Requieren token: cada cuenta solo ve las de su propio perfil.
//
// El registro de eventos NO esta aqui: lo informa la vista publica, que no
// tiene sesion, y vive en /api/publico/:slug/eventos.
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');

const estadisticaController = require('./estadistica.controller');

const router = express.Router();

router.use(autenticar);

// GET /api/estadisticas — totales, serie diaria y enlaces mas pulsados
router.get('/', estadisticaController.obtenerMisEstadisticas);

module.exports = router;
