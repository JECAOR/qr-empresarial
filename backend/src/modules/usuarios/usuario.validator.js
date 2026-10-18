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

/**
 * Valida el cuerpo de PUT /api/usuarios/me/contrasena.
 *
 * De la contrasena actual solo se comprueba que venga: si esta mal escrita
 * eso lo resuelve el Service con un 401, no un 400 de formato. La nueva si
 * tiene que cumplir RN-02, igual que en el registro.
 */
function validarCambioContrasena(req, res, next) {
  const { contrasenaActual, contrasenaNueva } = req.body;

  if (typeof contrasenaActual !== 'string' || !contrasenaActual) {
    return res.status(400).json({
      message: 'La contraseña actual es obligatoria'
    });
  }

  const esSegura =
    typeof contrasenaNueva === 'string' &&
    contrasenaNueva.length >= 8 &&
    /[A-Z]/.test(contrasenaNueva) &&
    /[0-9]/.test(contrasenaNueva) &&
    /[^A-Za-z0-9]/.test(contrasenaNueva);

  if (!esSegura) {
    return res.status(400).json({
      message: 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo'
    });
  }

  next();
}

/**
 * Valida el cuerpo de DELETE /api/usuarios/me.
 * Solo se comprueba que la contrasena venga; si esta equivocada, el Service
 * responde 401.
 */
function validarEliminarMiCuenta(req, res, next) {
  const { contrasena } = req.body;

  if (typeof contrasena !== 'string' || !contrasena) {
    return res.status(400).json({
      message: 'Debe confirmar su contraseña para eliminar la cuenta'
    });
  }

  next();
}

/**
 * Valida el cuerpo de PUT /api/usuarios/me (RF-12).
 *
 * La contrasena no se exige aqui: solo hace falta si el correo cambia, y eso
 * se sabe comparando con el que ya tiene la cuenta, que es trabajo del
 * Service.
 */
function validarMisDatos(req, res, next) {
  const { nombre, correo } = req.body || {};

  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({
      message: 'El nombre debe tener al menos 2 caracteres'
    });
  }

  const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (typeof correo !== 'string' || !FORMATO_CORREO.test(correo.trim())) {
    return res.status(400).json({
      message: 'El formato del correo no es válido'
    });
  }

  if (nombre.trim().length > 100 || correo.trim().length > 100) {
    return res.status(400).json({
      message: 'El nombre y el correo no pueden superar los 100 caracteres'
    });
  }

  req.body = {
    nombre: nombre.trim(),
    correo: correo.trim(),
    contrasena: typeof req.body.contrasena === 'string' ? req.body.contrasena : null
  };

  next();
}

/**
 * Valida el cuerpo de PUT /api/usuarios/me/preferencias.
 *
 * Los dos avisos son obligatorios: la pantalla manda siempre los dos
 * interruptores, y aceptar un cuerpo a medias dejaria el que falta en su
 * valor por defecto sin que nadie lo pidiera.
 *
 * Eran tres hasta la migracion 012. El tercero avisaba de resenas nuevas, y
 * en el sistema no hay resenas: se quito en lugar de dejar un interruptor que
 * promete un correo que nunca llegaria.
 */
function validarPreferencias(req, res, next) {
  const { resumen, novedades } = req.body || {};

  const todosBooleanos = [resumen, novedades]
    .every((valor) => typeof valor === 'boolean');

  if (!todosBooleanos) {
    return res.status(400).json({
      message: 'Los avisos resumen y novedades deben ser true o false'
    });
  }

  next();
}

module.exports = {
  validarCrearUsuario,
  validarIdUsuario,
  validarActualizarUsuario,
  validarEstado,
  validarCambioContrasena,
  validarEliminarMiCuenta,
  validarMisDatos,
  validarPreferencias
};
