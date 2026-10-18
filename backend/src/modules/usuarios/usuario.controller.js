// ============================================
// USUARIO.CONTROLLER.JS — interaccion HTTP del modulo Usuarios
// Recibe la peticion, delega el trabajo al Service y prepara la respuesta.
// No contiene reglas de negocio ni consultas SQL.
// ============================================

const usuarioService = require('./usuario.service');
const authService = require('../auth/auth.service');

/**
 * POST /api/usuarios — registra un usuario nuevo.
 * @param {object} req - Peticion HTTP; los datos llegan en req.body.
 * @param {object} res - Respuesta HTTP.
 * @param {Function} next - Envia el error al middleware global.
 */
async function crearUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.crearUsuario(req.body);

    return res.status(201).json({
      message: 'Usuario creado correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios — lista los usuarios activos.
 */
async function listarUsuarios(req, res, next) {
  try {
    const usuarios = await usuarioService.listarUsuarios();

    return res.status(200).json({ data: usuarios });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios/:idUsuario — consulta un usuario.
 */
async function obtenerUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.obtenerUsuarioPorId(req.params.idUsuario);

    return res.status(200).json({ data: usuario });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/usuarios/:idUsuario — actualiza los datos del usuario.
 */
async function actualizarUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.actualizarUsuario(req.params.idUsuario, req.body);

    return res.status(200).json({
      message: 'Usuario actualizado correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/usuarios/:idUsuario/estado — activa o restringe la cuenta.
 */
async function cambiarEstadoUsuario(req, res, next) {
  try {
    const usuario = await usuarioService.cambiarEstadoUsuario(
      req.params.idUsuario,
      req.body.estado
    );

    return res.status(200).json({
      message: 'Estado del usuario actualizado correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/usuarios/:idUsuario — eliminacion logica.
 */
async function eliminarUsuario(req, res, next) {
  try {
    await usuarioService.eliminarUsuario(req.params.idUsuario);

    return res.status(200).json({
      message: 'Usuario eliminado correctamente'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios/me — devuelve el perfil del usuario autenticado.
 * El identificador sale del token, no de la URL.
 */
async function obtenerMiPerfil(req, res, next) {
  try {
    const usuario = await authService.obtenerPerfil(req.usuario.id);

    return res.status(200).json({ data: usuario });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/usuarios/me/contrasena — cambia la contrasena propia.
 *
 * El identificador sale del token, no de la URL ni del cuerpo: nadie puede
 * cambiar la contrasena de otra persona por esta via.
 *
 * Devuelve un token nuevo porque el cambio cierra todas las sesiones de la
 * cuenta, incluida la que hizo la peticion. El frontend reemplaza el que
 * tenia guardado y la persona sigue trabajando sin volver a entrar.
 */
async function cambiarMiContrasena(req, res, next) {
  try {
    const { contrasenaActual, contrasenaNueva } = req.body;

    const { token } = await authService.cambiarContrasena(
      req.usuario.id,
      contrasenaActual,
      contrasenaNueva
    );

    return res.status(200).json({
      message: 'Contraseña actualizada correctamente. Se cerraron las demás sesiones',
      data: { token }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/usuarios/me — elimina la cuenta propia.
 *
 * La contrasena viaja en el cuerpo: es una accion irreversible y no basta con
 * tener la sesion abierta. El identificador sale del token.
 */
async function eliminarMiCuenta(req, res, next) {
  try {
    await authService.eliminarMiCuenta(req.usuario.id, req.body.contrasena);

    return res.status(200).json({
      message: 'Cuenta eliminada correctamente'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/usuarios/me — actualiza los datos personales (RF-12).
 */
async function actualizarMisDatos(req, res, next) {
  try {
    const usuario = await authService.actualizarMisDatos(req.usuario.id, req.body);

    return res.status(200).json({
      message: 'Datos actualizados correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios/me/preferencias — avisos de la cuenta (RF-12).
 */
async function obtenerMisPreferencias(req, res, next) {
  try {
    const prefs = await authService.obtenerMisPreferencias(req.usuario.id);

    return res.status(200).json({ data: prefs });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/usuarios/me/preferencias — guarda los avisos de la cuenta.
 */
async function guardarMisPreferencias(req, res, next) {
  try {
    const prefs = await authService.guardarMisPreferencias(req.usuario.id, req.body);

    return res.status(200).json({
      message: 'Preferencias guardadas correctamente',
      data: prefs
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crearUsuario,
  obtenerMiPerfil,
  cambiarMiContrasena,
  actualizarMisDatos,
  obtenerMisPreferencias,
  guardarMisPreferencias,
  eliminarMiCuenta,
  listarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario
};
