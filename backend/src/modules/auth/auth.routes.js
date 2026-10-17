// ============================================
// AUTH.ROUTES.JS — endpoints del modulo Auth
// Casi todas son publicas. La excepcion es el cierre de sesion: para
// revocar un token hay que presentarlo, asi que exige autenticacion.
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');
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

// POST /api/auth/logout — cierra la sesion actual (RF-02)
// Revoca el jti del token recibido; las demas sesiones no se tocan
router.post('/logout', autenticar, authController.cerrarSesion);

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
