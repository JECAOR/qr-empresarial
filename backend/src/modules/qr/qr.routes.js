// ============================================
// QR.ROUTES.JS — endpoints del modulo QR (RF-07, RF-08)
// Todas requieren token: cada cuenta solo ve y descarga el codigo de su
// propio perfil.
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');

const qrController = require('./qr.controller');
const { validarEstado } = require('./qr.validator');

const router = express.Router();

router.use(autenticar);

// GET /api/qr/imagen — descarga PNG, SVG o PDF (RF-08).
// Antes de cualquier ruta con parametro
router.get('/imagen', qrController.descargarImagen);

// GET /api/qr — consulta el codigo propio
router.get('/', qrController.obtenerMiQr);

// POST /api/qr — genera el codigo (RF-07)
router.post('/', qrController.generarMiQr);

// PATCH /api/qr/estado — activa o desactiva
router.patch('/estado', validarEstado, qrController.cambiarEstado);

module.exports = router;
