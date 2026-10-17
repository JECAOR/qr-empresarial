// ============================================
// AUTH.ROUTES.JS — endpoints del modulo Auth
// Rutas publicas: no requieren token.
// ============================================

const express = require('express');

const { limitarLogin, limitarRecuperacion } = require('../../middlewares/limite.middleware');

const authController = require('./auth.controller');
const {
  validarLogin,
  validarRegistro,
  validarSolicitudRecuperacion,
  validarRestablecer
} = require('./auth.validator');

const router = express.Router();

// POST /api/auth/registro — registro publico (rol forzado a "empresa")
router.post('/registro', validarRegistro, authController.registrar);

// POST /api/auth/login — inicia sesion y devuelve un JWT
// RN-03: maximo 5 intentos fallidos; despues se bloquea 15 minutos
router.post('/login', limitarLogin, validarLogin, authController.iniciarSesion);

// --- Recuperacion de contrasena (RF-03) ---

// POST /api/auth/recuperar-contrasena — solicita el enlace
router.post(
  '/recuperar-contrasena',
  limitarRecuperacion,
  validarSolicitudRecuperacion,
  authController.solicitarRecuperacion
);

// GET /api/auth/restablecer/:token — comprueba el enlace antes de mostrar el formulario
router.get('/restablecer/:token', authController.validarEnlaceRecuperacion);

// POST /api/auth/restablecer-contrasena — define la nueva contrasena
router.post(
  '/restablecer-contrasena',
  validarRestablecer,
  authController.restablecerContrasena
);

module.exports = router;
