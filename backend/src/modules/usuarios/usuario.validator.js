// ============================================
// USUARIO.VALIDATOR.JS — validacion de los datos de entrada
// Se ejecuta antes del controlador: impide que datos mal formados
// avancen por la aplicacion. No consulta la base de datos.
// ============================================

const ROLES_VALIDOS = ['empresa', 'administrador'];
const ESTADOS_VALIDOS = ['activo', 'restringido'];
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGITUD_MINIMA_CONTRASENA = 8;

/**
 * Valida el cuerpo de la peticion POST /api/usuarios.
 * Responde 400 con el motivo si algun dato no cumple, o llama a next().
 */
function validarCrearUsuario(req, res, next) {
  const { nombre, correo, contrasena, rol } = req.body;

  // Campos obligatorios
  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({
      message: 'Los campos nombre, correo y contrasena son obligatorios'
    });
  }

  // Nombre
  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({
      message: 'El nombre debe tener al menos 2 caracteres'
    });
  }

  // Correo
  if (!FORMATO_CORREO.test(correo)) {
    return res.status(400).json({
      message: 'El formato del correo no es válido'
    });
  }

  // Contrasena (RN-02): minimo 8 caracteres, mayuscula, numero y simbolo
  const esSegura =
    typeof contrasena === 'string' &&
    contrasena.length >= LONGITUD_MINIMA_CONTRASENA &&
    /[A-Z]/.test(contrasena) &&
    /[0-9]/.test(contrasena) &&
    /[^A-Za-z0-9]/.test(contrasena);

  if (!esSegura) {
    return res.status(400).json({
      message: 'La contrasena debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo'
    });
  }

  // Rol: es opcional, pero si llega debe ser uno de los valores permitidos
  if (rol !== undefined && !ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({
      message: 'El rol debe ser empresa o administrador'
    });
  }

  next();
}

/**
 * Comprueba que el identificador de la URL sea un entero positivo.
 * Evita consultar la base de datos con valores sin sentido.
 */
function validarIdUsuario(req, res, next) {
  const idUsuario = Number(req.params.idUsuario);

  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    return res.status(400).json({
      message: 'El identificador del usuario no es válido'
    });
  }

  next();
}

/**
 * Valida los datos de actualizacion. No incluye la contrasena:
 * cambiarla es otra operacion, con su propia regla (RN-20).
 */
function validarActualizarUsuario(req, res, next) {
  const { nombre, correo, rol } = req.body;

  if (!nombre || !correo || !rol) {
    return res.status(400).json({
      message: 'Los campos nombre, correo y rol son obligatorios'
    });
  }

  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({
      message: 'El nombre debe tener al menos 2 caracteres'
    });
  }

  if (!FORMATO_CORREO.test(correo)) {
    return res.status(400).json({
      message: 'El formato del correo no es válido'
    });
  }

  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({
      message: 'El rol debe ser empresa o administrador'
    });
  }

  next();
}

/**
 * Valida el estado enviado en el PATCH: activo o restringido.
 */
function validarEstado(req, res, next) {
  const { estado } = req.body;

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      message: 'El estado debe ser activo o restringido'
    });
  }

  next();
}

module.exports = {
  validarCrearUsuario,
  validarIdUsuario,
  validarActualizarUsuario,
  validarEstado
};
