// ============================================
// AUTH.VALIDATOR.JS — validacion de los datos de entrada del login
// Solo comprueba que lleguen los dos campos. El formato del correo y la
// fuerza de la contrasena no se revisan aqui: en el login, unas credenciales
// mal escritas deben responder 401, no 400.
// ============================================

/**
 * Valida el cuerpo de POST /api/auth/login.
 */
function validarLogin(req, res, next) {
  const { correo, contrasena } = req.body;

  const datosCompletos =
    typeof correo === 'string' && correo.trim() &&
    typeof contrasena === 'string' && contrasena;

  if (!datosCompletos) {
    return res.status(400).json({
      message: 'El correo y la contrasena son obligatorios'
    });
  }

  next();
}

/**
 * Valida el cuerpo de POST /api/auth/registro.
 * Aqui si se revisan formato y fuerza, igual que en la creacion
 * administrativa: son los datos con los que nacera la cuenta.
 */
function validarRegistro(req, res, next) {
  const { nombre, correo, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({
      message: 'Los campos nombre, correo y contrasena son obligatorios'
    });
  }

  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({
      message: 'El nombre debe tener al menos 2 caracteres'
    });
  }

  const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!FORMATO_CORREO.test(correo)) {
    return res.status(400).json({
      message: 'El formato del correo no es válido'
    });
  }

  // RN-02: minimo 8 caracteres, mayuscula, numero y simbolo
  const esSegura =
    typeof contrasena === 'string' &&
    contrasena.length >= 8 &&
    /[A-Z]/.test(contrasena) &&
    /[0-9]/.test(contrasena) &&
    /[^A-Za-z0-9]/.test(contrasena);

  if (!esSegura) {
    return res.status(400).json({
      message: 'La contrasena debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo'
    });
  }

  // Datos del negocio (paso 2 del formulario de registro). Son opcionales:
  // si no llegan, el perfil nace con el nombre de la cuenta y se completa
  // despues en Configuracion.
  const { negocio } = req.body;

  if (negocio !== undefined) {
    if (typeof negocio !== 'object' || negocio === null || Array.isArray(negocio)) {
      return res.status(400).json({
        message: 'Los datos del negocio deben venir en un objeto'
      });
    }

    const nombreNegocio =
      typeof negocio.nombreNegocio === 'string' ? negocio.nombreNegocio.trim() : '';

    if (nombreNegocio && nombreNegocio.length < 2) {
      return res.status(400).json({
        message: 'El nombre del negocio debe tener al menos 2 caracteres'
      });
    }

    if (nombreNegocio.length > 150) {
      return res.status(400).json({
        message: 'El nombre del negocio no puede superar los 150 caracteres'
      });
    }
  }

  next();
}

/**
 * Valida el cuerpo de POST /api/auth/recuperar-contrasena.
 */
function validarSolicitudRecuperacion(req, res, next) {
  const { correo } = req.body;

  if (typeof correo !== 'string' || !correo.trim()) {
    return res.status(400).json({
      message: 'El correo es obligatorio'
    });
  }

  next();
}

/**
 * Valida el cuerpo de POST /api/auth/restablecer-contrasena.
 * La nueva contrasena debe cumplir RN-02, igual que en el registro.
 */
function validarRestablecer(req, res, next) {
  const { token, contrasena } = req.body;

  if (typeof token !== 'string' || token.length < 32) {
    return res.status(400).json({
      message: 'El enlace de recuperación no es válido'
    });
  }

  const esSegura =
    typeof contrasena === 'string' &&
    contrasena.length >= 8 &&
    /[A-Z]/.test(contrasena) &&
    /[0-9]/.test(contrasena) &&
    /[^A-Za-z0-9]/.test(contrasena);

  if (!esSegura) {
    return res.status(400).json({
      message: 'La contrasena debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo'
    });
  }

  next();
}

module.exports = {
  validarLogin,
  validarRegistro,
  validarSolicitudRecuperacion,
  validarRestablecer
};
