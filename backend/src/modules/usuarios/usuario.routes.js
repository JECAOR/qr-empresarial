// ============================================
// USUARIO.ROUTES.JS — endpoints del modulo Usuarios
// Todas las rutas requieren un token valido. Las operaciones
// administrativas exigen ademas el rol administrador (RN-22).
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');
const autorizarRoles = require('../../middlewares/rol.middleware');

const usuarioController = require('./usuario.controller');
const {
  validarCrearUsuario,
  validarIdUsuario,
  validarActualizarUsuario,
  validarEstado
} = require('./usuario.validator');

const router = express.Router();

// Todas las rutas de este modulo requieren un token valido
router.use(autenticar);

// --- Perfil propio: cualquier usuario autenticado ---
// Debe declararse ANTES de /:idUsuario, o Express interpretaria "me"
// como un identificador y el validador responderia 400.
router.get('/me', usuarioController.obtenerMiPerfil);

// --- Operaciones administrativas: solo el rol administrador ---

// POST /api/usuarios — registra un usuario con cualquier rol
router.post(
  '/',
  autorizarRoles('administrador'),
  validarCrearUsuario,
  usuarioController.crearUsuario
);

// GET /api/usuarios — lista los usuarios activos
router.get(
  '/',
  autorizarRoles('administrador'),
  usuarioController.listarUsuarios
);

// GET /api/usuarios/:idUsuario — consulta un usuario
router.get(
  '/:idUsuario',
  autorizarRoles('administrador'),
  validarIdUsuario,
  usuarioController.obtenerUsuario
);

// PUT /api/usuarios/:idUsuario — actualiza nombre, correo y rol
router.put(
  '/:idUsuario',
  autorizarRoles('administrador'),
  validarIdUsuario,
  validarActualizarUsuario,
  usuarioController.actualizarUsuario
);

// PATCH /api/usuarios/:idUsuario/estado — activa o restringe la cuenta
router.patch(
  '/:idUsuario/estado',
  autorizarRoles('administrador'),
  validarIdUsuario,
  validarEstado,
  usuarioController.cambiarEstadoUsuario
);

// DELETE /api/usuarios/:idUsuario — eliminacion logica
router.delete(
  '/:idUsuario',
  autorizarRoles('administrador'),
  validarIdUsuario,
  usuarioController.eliminarUsuario
);

module.exports = router;
