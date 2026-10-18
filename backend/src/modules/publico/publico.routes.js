// ============================================
// PUBLICO.ROUTES.JS — endpoints de la vista publica (RF-09)
//
// Sin autenticar: es el unico modulo abierto. Quien escanea el codigo QR no
// tiene cuenta ni deberia necesitarla.
// ============================================

const express = require('express');

const { limitarEventos } = require('../../middlewares/limite.middleware');
const { validarEvento } = require('../estadisticas/estadistica.validator');

const publicoController = require('./publico.controller');

const router = express.Router();

// GET /api/publico/:slug — perfil y contenido visible
router.get('/:slug', publicoController.obtenerPerfilPublico);

// POST /api/publico/:slug/eventos — registra un escaneo, visita o clic (RF-11)
router.post(
  '/:slug/eventos',
  limitarEventos,
  validarEvento,
  publicoController.registrarEvento
);

module.exports = router;
