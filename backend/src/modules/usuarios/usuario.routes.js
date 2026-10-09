// ============================================
// USUARIO.ROUTES.JS — endpoints del modulo Usuarios
// Define que ruta recibe cada peticion y en que orden se ejecutan
// los validadores y el controlador.
// ============================================

const express = require('express');

const usuarioController = require('./usuario.controller');
const {
  validarCrearUsuario,
  validarIdUsuario,
  validarActualizarUsuario,
  validarEstado
} = require('./usuario.validator');

const router = express.Router();

// POST /api/usuarios — registra un usuario nuevo
router.post('/', validarCrearUsuario, usuarioController.crearUsuario);

// GET /api/usuarios — lista los usuarios activos
router.get('/', usuarioController.listarUsuarios);

// GET /api/usuarios/:idUsuario — consulta un usuario
router.get('/:idUsuario', validarIdUsuario, usuarioController.obtenerUsuario);

// PUT /api/usuarios/:idUsuario — actualiza nombre, correo y rol
router.put(
  '/:idUsuario',
  validarIdUsuario,
  validarActualizarUsuario,
  usuarioController.actualizarUsuario
);

// PATCH /api/usuarios/:idUsuario/estado — activa o restringe la cuenta
router.patch(
  '/:idUsuario/estado',
  validarIdUsuario,
  validarEstado,
  usuarioController.cambiarEstadoUsuario
);

// DELETE /api/usuarios/:idUsuario — eliminacion logica
router.delete('/:idUsuario', validarIdUsuario, usuarioController.eliminarUsuario);

module.exports = router;
