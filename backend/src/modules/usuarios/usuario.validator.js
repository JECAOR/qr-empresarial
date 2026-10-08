// ============================================
// USUARIO.VALIDATOR.JS — validacion de los datos de entrada
// Se ejecuta antes del controlador: impide que datos mal formados
// avancen por la aplicacion. No consulta la base de datos.
// ============================================

const ROLES_VALIDOS = ['empresa', 'administrador'];
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

module.exports = {
  validarCrearUsuario
};
