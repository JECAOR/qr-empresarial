// ============================================
// ADMIN.ROUTES.JS — endpoints de la administracion (RF-13 y RF-15)
//
// Todo este modulo es exclusivo del rol administrador (RN-22). El guardia
// se monta una sola vez para el router entero y no ruta por ruta: asi una
// ruta nueva nace protegida, en lugar de quedar abierta si alguien olvida
// anadirle el middleware.
//
// El RF-14 (restringir y eliminar) NO tiene endpoints aqui. Ya los resuelven
// PATCH /api/usuarios/:id/estado y DELETE /api/usuarios/:id, que existen
// desde el modulo 1 con sus reglas y sus pruebas. Duplicarlos habria dejado
// dos caminos para lo mismo.
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');
const autorizarRoles = require('../../middlewares/rol.middleware');

const adminController = require('./admin.controller');
const { validarFiltros } = require('./admin.validator');

const router = express.Router();

router.use(autenticar, autorizarRoles('administrador'));

// GET /api/admin/resumen — cuantas cuentas hay y en que estado
router.get('/resumen', adminController.obtenerResumen);

// GET /api/admin/reportes/usuarios — el CSV (RF-15).
// Antes de /usuarios/:idUsuario no hace falta, porque cuelga de otra rama,
// pero se declara aqui para que las dos rutas con filtros queden juntas.
router.get('/reportes/usuarios', validarFiltros, adminController.descargarReporte);

// GET /api/admin/usuarios — lista con la actividad de cada cuenta
router.get('/usuarios', validarFiltros, adminController.listarUsuarios);

// GET /api/admin/usuarios/:idUsuario — detalle de una cuenta
router.get('/usuarios/:idUsuario', adminController.obtenerUsuario);

module.exports = router;
