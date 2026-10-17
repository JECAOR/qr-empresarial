// ============================================
// AUTH.CONTROLLER.JS — interaccion HTTP del modulo Auth
// Recibe la peticion, delega en el Service y devuelve el token.
// ============================================

const authService = require('./auth.service');

/**
 * POST /api/auth/login — valida las credenciales y entrega un token.
 */
async function iniciarSesion(req, res, next) {
  try {
    const { correo, contrasena } = req.body;

    const resultado = await authService.iniciarSesion(correo, contrasena);

    return res.status(200).json({
      message: 'Inicio de sesión correcto',
      data: resultado
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout — cierra la sesion actual (RF-02).
 * Requiere token: lo que se revoca es precisamente el token enviado.
 */
async function cerrarSesion(req, res, next) {
  try {
    await authService.cerrarSesion(req.usuario);

    return res.status(200).json({
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/registro — registro publico de una empresa.
 */
async function registrar(req, res, next) {
  try {
    const usuario = await authService.registrar(req.body);

    return res.status(201).json({
      message: 'Cuenta creada correctamente',
      data: usuario
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/recuperar-contrasena — solicita el enlace de recuperacion.
 * Responde siempre 200, exista o no el correo (no revela que cuentas hay).
 */
async function solicitarRecuperacion(req, res, next) {
  try {
    const { enlace } = await authService.solicitarRecuperacion(req.body.correo);

    const respuesta = {
      message: 'Si el correo está registrado, recibirá un enlace para restablecer su contrasena'
    };

    // Solo en desarrollo se devuelve el enlace, para poder probar sin correo
    if (enlace && process.env.NODE_ENV !== 'production') {
      respuesta.enlaceDesarrollo = enlace;
    }

    return res.status(200).json(respuesta);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/restablecer/:token — comprueba que el enlace siga sirviendo.
 */
async function validarEnlaceRecuperacion(req, res, next) {
  try {
    await authService.validarTokenRecuperacion(req.params.token);

    return res.status(200).json({ message: 'El enlace es válido' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/restablecer-contrasena — define la nueva contrasena.
 */
async function restablecerContrasena(req, res, next) {
  try {
    const { token, contrasena } = req.body;

    await authService.restablecerContrasena(token, contrasena);

    return res.status(200).json({
      message: 'Contrasena restablecida correctamente'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  iniciarSesion,
  cerrarSesion,
  registrar,
  solicitarRecuperacion,
  validarEnlaceRecuperacion,
  restablecerContrasena
};
