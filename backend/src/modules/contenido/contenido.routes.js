// ============================================
// CONTENIDO.ROUTES.JS — endpoints del modulo Contenido (RF-05, RF-06)
// Todas requieren token: cada cuenta solo ve y edita el contenido de su
// propio perfil.
// ============================================

const express = require('express');

const autenticar = require('../../middlewares/auth.middleware');

const contenidoController = require('./contenido.controller');
const {
  validarContenido,
  validarEstado,
  validarOrden
} = require('./contenido.validator');

const router = express.Router();

router.use(autenticar);

// GET /api/contenido/categorias — antes de cualquier ruta con parametro,
// o "categorias" se tomaria por un identificador
router.get('/categorias', contenidoController.listarCategorias);

// GET /api/contenido — lista el contenido propio
router.get('/', contenidoController.listarMiContenido);

// POST /api/contenido — agrega un bloque (RF-05)
router.post('/', validarContenido, contenidoController.crearContenido);

// PUT /api/contenido/orden — reordena. Tambien antes de /:idContenido
router.put('/orden', validarOrden, contenidoController.reordenarContenido);

// PUT /api/contenido/:idContenido — edita un bloque (RF-06)
router.put('/:idContenido', validarContenido, contenidoController.actualizarContenido);

// PATCH /api/contenido/:idContenido/estado — activa o desactiva (RF-06)
router.patch('/:idContenido/estado', validarEstado, contenidoController.cambiarEstado);

// DELETE /api/contenido/:idContenido — elimina (RF-06)
router.delete('/:idContenido', contenidoController.eliminarContenido);

module.exports = router;
