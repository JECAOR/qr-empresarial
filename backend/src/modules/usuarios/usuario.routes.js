// ============================================
// USUARIO.ROUTES.JS — endpoints del modulo Usuarios
// Define que ruta recibe cada peticion y en que orden se ejecutan
// el validador y el controlador.
// ============================================

const express = require('express');

const usuarioController = require('./usuario.controller');
const { validarCrearUsuario } = require('./usuario.validator');

const router = express.Router();

// POST /api/usuarios — registra un usuario nuevo
router.post('/', validarCrearUsuario, usuarioController.crearUsuario);

module.exports = router;
