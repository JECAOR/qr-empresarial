// ============================================
// AUTH.SERVICE.JS — reglas de autenticacion
// Compara la contrasena con bcrypt y firma el token JWT.
// No conoce HTTP: no usa req ni res.
// ============================================

const crypto = require('crypto');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authRepository = require('./auth.repository');
const usuarioService = require('../usuarios/usuario.service');

const ROL_POR_DEFECTO = 'empresa';

/**
 * Error unico para los tres motivos de fallo del login.
 * Responder siempre lo mismo evita que alguien descubra que correos
 * estan registrados probando uno por uno.
 */
function credencialesInvalidas() {
  const error = new Error('Credenciales inválidas');
  error.status = 401;
  return error;
}

/**
 * Verifica las credenciales y entrega un token de sesion.
 * @param {string} correo
 * @param {string} contrasena - En texto plano, tal como llega del formulario.
 * @returns {Promise<{token: string, usuario: object}>}
 * @throws {Error} 401 si el usuario no existe, esta restringido o la clave no coincide.
 */
async function iniciarSesion(correo, contrasena) {
  const usuario = await authRepository.buscarPorCorreo(correo);

  // Caso 1: el usuario no existe o fue eliminado
  if (!usuario) {
    console.warn('Login rechazado: usuario no encontrado');
    throw credencialesInvalidas();
  }

  // Caso 2: la cuenta esta restringida (RN-23)
  if (usuario.estado !== 'activo') {
    console.warn('Login rechazado: cuenta restringida');
    throw credencialesInvalidas();
  }

  // Caso 3: la contrasena no coincide con el hash almacenado
  const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);

  if (!contrasenaValida) {
    console.warn('Login rechazado: contrasena incorrecta');
    throw credencialesInvalidas();
  }

  // Caso 4: autenticacion correcta
  const token = jwt.sign(
    { id: usuario.id_usuario, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );

  return {
    token,
    usuario: {
      idUsuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol
    }
  };
}

/**
 * Devuelve los datos del usuario autenticado.
 * El identificador no llega por la URL, sino del token verificado,
 * de modo que nadie puede consultar el perfil de otra persona.
 *
 * @param {number} idUsuario - Tomado de req.usuario.id
 * @returns {Promise<object>} Datos publicos del usuario.
 * @throws {Error} 404 si la cuenta ya no existe o fue restringida.
 */
async function obtenerPerfil(idUsuario) {
  const usuario = await authRepository.buscarPorId(idUsuario);

  if (!usuario || usuario.estado !== 'activo') {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  return {
    idUsuario: usuario.id_usuario,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    estado: usuario.estado
  };
}

/**
 * Registro publico: una empresa crea su propia cuenta desde el formulario,
 * sin autenticacion previa.
 *
 * El rol NO se toma del cuerpo de la peticion: siempre es "empresa".
 * Aunque alguien edite el JSON e incluya "rol": "administrador", el valor
 * se descarta. Crear cuentas administrativas es una operacion exclusiva
 * del administrador, mediante POST /api/usuarios.
 *
 * Reutiliza usuarioService.crearUsuario para no duplicar la validacion
 * del correo unico (RN-01) ni el cifrado de la contrasena (RN-02).
 *
 * @param {{nombre: string, correo: string, contrasena: string}} datos
 * @returns {Promise<object>} Usuario creado, sin la contrasena.
 */
async function registrar(datos) {
  const { nombre, correo, contrasena } = datos;

  return usuarioService.crearUsuario({
    nombre,
    correo,
    contrasena,
    rol: ROL_POR_DEFECTO
  });
}

const RONDAS_BCRYPT = 10;

/**
 * Calcula el hash que se guarda en la base para un token de recuperacion.
 * Se usa SHA-256 y no bcrypt porque el token ya es aleatorio de 32 bytes:
 * no hace falta un algoritmo lento contra fuerza bruta, y asi la busqueda
 * por hash es directa.
 */
function hashDelToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Paso 1 de RF-03: genera el enlace de recuperacion.
 *
 * Responde siempre lo mismo exista o no el correo, para no revelar que
 * cuentas estan registradas. Si el correo existe, invalida los enlaces
 * anteriores y emite uno nuevo.
 *
 * @param {string} correo
 * @returns {Promise<{enlace: string|null}>} El enlace solo en desarrollo.
 */
async function solicitarRecuperacion(correo) {
  const usuario = await authRepository.buscarPorCorreo(correo);

  if (!usuario || usuario.estado !== 'activo') {
    console.warn('Recuperacion solicitada para un correo inexistente o restringido');
    return { enlace: null };
  }

  await authRepository.invalidarTokensAnteriores(usuario.id_usuario);

  // Token aleatorio: viaja en el enlace, pero en la base solo queda su hash
  const token = crypto.randomBytes(32).toString('hex');
  const minutos = Number(process.env.RECUPERACION_EXPIRA_MINUTOS || 30);
  const expiraEn = new Date(Date.now() + minutos * 60 * 1000);

  await authRepository.crearTokenRecuperacion(usuario.id_usuario, hashDelToken(token), expiraEn);

  const enlace = `${process.env.APP_URL}/restablecer.html?token=${token}`;

  // Mientras no haya servidor de correo, el enlace se imprime en la consola.
  // Al conectar nodemailer, basta reemplazar este bloque por el envio real.
  console.log('--------------------------------------------------');
  console.log('Enlace de recuperacion para', usuario.correo);
  console.log(enlace);
  console.log('Vence:', expiraEn.toLocaleString('es-CO'));
  console.log('--------------------------------------------------');

  return { enlace };
}

/**
 * Paso 2 de RF-03: comprueba que un enlace siga sirviendo.
 * Lo usa el frontend al abrir la pantalla, antes de mostrar el formulario.
 *
 * @param {string} token
 * @returns {Promise<{valido: true}>}
 * @throws {Error} 400 si el enlace vencio, ya se uso o no existe.
 */
async function validarTokenRecuperacion(token) {
  const registro = await authRepository.buscarTokenVigente(hashDelToken(token));

  if (!registro) {
    const error = new Error('El enlace de recuperación no es válido o ya expiró');
    error.status = 400;
    throw error;
  }

  return { valido: true };
}

/**
 * Paso 3 de RF-03: define la nueva contrasena y consume el enlace.
 *
 * @param {string} token
 * @param {string} contrasena - Nueva contrasena en texto plano.
 * @throws {Error} 400 si el enlace no sirve.
 */
async function restablecerContrasena(token, contrasena) {
  const registro = await authRepository.buscarTokenVigente(hashDelToken(token));

  if (!registro) {
    const error = new Error('El enlace de recuperación no es válido o ya expiró');
    error.status = 400;
    throw error;
  }

  const contrasenaCifrada = await bcrypt.hash(contrasena, RONDAS_BCRYPT);

  await authRepository.actualizarContrasena(registro.id_usuario, contrasenaCifrada);

  // RN-04: el enlace sirve una sola vez
  await authRepository.marcarTokenUsado(registro.id_token);

  console.warn('Contrasena restablecida para el usuario', registro.id_usuario);
}

module.exports = {
  iniciarSesion,
  obtenerPerfil,
  registrar,
  solicitarRecuperacion,
  validarTokenRecuperacion,
  restablecerContrasena
};
