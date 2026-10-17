// ============================================
// PERFIL.ROUTES.JS — endpoints del modulo Perfiles (RF-04)
// Todas requieren token: cada cuenta solo ve y edita su propio perfil.
// La vista publica por slug es el RF-09, del modulo 5.
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');

const perfilController = require('./perfil.controller');
const { validarPerfil } = require('./perfil.validator');

const router = express.Router();

router.use(autenticar);

// GET /api/perfiles/me — consulta el perfil propio
router.get('/me', perfilController.obtenerMiPerfil);

// PUT /api/perfiles/me — crea o actualiza el perfil propio
router.put('/me', validarPerfil, perfilController.actualizarMiPerfil);

module.exports = router;
