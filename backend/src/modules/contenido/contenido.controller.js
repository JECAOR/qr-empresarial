// ============================================
// CONTENIDO.CONTROLLER.JS — interaccion HTTP del modulo Contenido
// ============================================

const contenidoService = require('./contenido.service');

/**
 * GET /api/contenido — todo el contenido de la cuenta autenticada.
 * Se devuelve plano y agrupado por seccion: la pantalla usa lo segundo.
 */
async function listarMiContenido(req, res, next) {
  try {
    const { items, porSeccion } = await contenidoService.listarMiContenido(req.usuario.id);

    return res.status(200).json({ data: items, porSeccion });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/contenido/categorias — las ocho categorias de enlace del RF-05
 * y las de los elementos.
 */
async function listarCategorias(req, res, next) {
  try {
    const categorias = await contenidoService.listarCategorias();

    return res.status(200).json({ data: categorias });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/contenido — agrega un bloque (RF-05).
 */
async function crearContenido(req, res, next) {
  try {
    const item = await contenidoService.crearContenido(req.usuario.id, req.body);

    return res.status(201).json({
      message: 'Contenido agregado correctamente',
      data: item
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/contenido/:idContenido — edita un bloque (RF-06).
 */
async function actualizarContenido(req, res, next) {
  try {
    const item = await contenidoService.actualizarContenido(
      req.usuario.id,
      req.params.idContenido,
      req.body
    );

    return res.status(200).json({
      message: 'Contenido actualizado correctamente',
      data: item
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/contenido/:idContenido/estado — activa o desactiva (RF-06).
 */
async function cambiarEstado(req, res, next) {
  try {
    const item = await contenidoService.cambiarEstadoContenido(
      req.usuario.id,
      req.params.idContenido,
      req.body.activo
    );

    return res.status(200).json({
      message: item.activo ? 'Contenido activado' : 'Contenido desactivado',
      data: item
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/contenido/:idContenido — elimina un bloque (RF-06).
 */
async function eliminarContenido(req, res, next) {
  try {
    await contenidoService.eliminarContenido(req.usuario.id, req.params.idContenido);

    return res.status(200).json({ message: 'Contenido eliminado correctamente' });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/contenido/orden — reordena una seccion.
 */
async function reordenarContenido(req, res, next) {
  try {
    await contenidoService.reordenarContenido(req.usuario.id, req.body.ids);

    return res.status(200).json({ message: 'Orden actualizado correctamente' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listarMiContenido,
  listarCategorias,
  crearContenido,
  actualizarContenido,
  cambiarEstado,
  eliminarContenido,
  reordenarContenido
};
