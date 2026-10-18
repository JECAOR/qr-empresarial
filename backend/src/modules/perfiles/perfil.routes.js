// ============================================
// PERFIL.ROUTES.JS — endpoints del modulo Perfiles (RF-04)
// Todas requieren token: cada cuenta solo ve y edita su propio perfil.
// La vista publica por slug es el RF-09, del modulo 5.
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');

const perfilController = require('./perfil.controller');
const { validarPerfil, validarTema } = require('./perfil.validator');

const router = express.Router();

router.use(autenticar);

// GET /api/perfiles/me — consulta el perfil propio
router.get('/me', perfilController.obtenerMiPerfil);

// PUT /api/perfiles/me — crea o actualiza el perfil propio
router.put('/me', validarPerfil, perfilController.actualizarMiPerfil);

// PATCH /api/perfiles/me/tema — cambia solo el color de marca (RF-12).
// Aparte del PUT por seguridad: el selector de color esta en todas las
// pantallas y no deberia poder tocar el resto del perfil.
router.patch('/me/tema', validarTema, perfilController.actualizarMiTema);

module.exports = router;
