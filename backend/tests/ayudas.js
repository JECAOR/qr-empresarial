// ============================================
// TESTS/AYUDAS.JS — lo que repiten casi todas las pruebas
//
// Cada prueba crea las cuentas que necesita en lugar de apoyarse en datos
// sembrados: asi se lee entera sin ir a buscar a otro archivo que hay en la
// base, y no se rompe cuando otra prueba cambia esos datos.
// ============================================

const request = require('supertest');

const app = require('../src/app');

const CLAVE = 'Clave123*';

let contador = 0;

/** Un correo distinto en cada llamada, para no chocar con el RN-01. */
function correoNuevo(prefijo = 'cuenta') {
  contador += 1;
  return `${prefijo}.${Date.now()}.${contador}@ejemplo.co`;
}

/**
 * Registra una cuenta de empresa y devuelve con que entrar.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.nombreNegocio] - Si se pasa, se crea el perfil.
 * El registro no devuelve token: responde con los datos de la cuenta, y la
 * sesion se abre despues. Se hacen los dos pasos aqui porque casi ninguna
 * prueba quiere comprobar eso, solo necesita una cuenta con la que entrar.
 *
 * @returns {Promise<{token: string, correo: string, contrasena: string, id: number, slug: string}>}
 */
async function crearCuenta({ nombreNegocio = 'Negocio de Prueba' } = {}) {
  const correo = correoNuevo();

  const registro = await request(app)
    .post('/api/auth/registro')
    .send({
      nombre: 'Persona de Prueba',
      correo,
      contrasena: CLAVE,
      negocio: { nombreNegocio }
    });

  if (registro.status !== 201) {
    throw new Error(`No se pudo registrar la cuenta: ${registro.status} ${registro.text}`);
  }

  return {
    token: await entrar(correo),
    id: registro.body.data.idUsuario,
    slug: registro.body.data.slug,
    correo,
    contrasena: CLAVE
  };
}

/** Inicia sesion y devuelve el token. */
async function entrar(correo, contrasena = CLAVE) {
  const respuesta = await request(app).post('/api/auth/login').send({ correo, contrasena });

  if (respuesta.status !== 200) {
    throw new Error(`No se pudo iniciar sesion: ${respuesta.status} ${respuesta.text}`);
  }

  return respuesta.body.data.token;
}

/** Agrega un bloque de contenido y devuelve su identificador compuesto. */
async function agregarBloque(token, datos = {}) {
  const respuesta = await request(app)
    .post('/api/contenido')
    .set('Authorization', `Bearer ${token}`)
    .send({
      tipo: 'enlace',
      titulo: 'Un enlace',
      detalle: 'https://ejemplo.co',
      idCategoria: 4,
      seccion: 'menu',
      ...datos
    });

  if (respuesta.status !== 201) {
    throw new Error(`No se pudo agregar el bloque: ${respuesta.status} ${respuesta.text}`);
  }

  return respuesta.body.data.id;
}

/** Atajo para una peticion autenticada. */
function como(token) {
  const con = (metodo) => (ruta) =>
    request(app)[metodo](ruta).set('Authorization', `Bearer ${token}`);

  return {
    get: con('get'),
    post: con('post'),
    put: con('put'),
    patch: con('patch'),
    delete: con('delete')
  };
}

module.exports = { app, request, CLAVE, correoNuevo, crearCuenta, entrar, agregarBloque, como };
