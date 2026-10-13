// ============================================
// AUTH.ROUTES.JS — endpoints del modulo Auth
// Rutas publicas: no requieren token.
// ============================================

const express = require('express');

const authController = require('./auth.controller');
const { validarLogin, validarRegistro } = require('./auth.validator');

const router = express.Router();

// POST /api/auth/registro — registro publico (rol forzado a "empresa")
router.post('/registro', validarRegistro, authController.registrar);

// POST /api/auth/login — inicia sesion y devuelve un JWT
router.post('/login', validarLogin, authController.iniciarSesion);

module.exports = router;
