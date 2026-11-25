// ============================================
// TESTS/ARRANQUE.TEST.JS — lo que decide el arranque, y el manejo de errores
//
// Tres cosas que no se ejecutaban nunca y que solo se notan en produccion,
// que es el peor sitio para enterarse:
//
//   - El CORS de produccion. En desarrollo se acepta cualquier origen, y es
//     la unica rama que corrian las pruebas. La de produccion —la que de
//     verdad protege— no la habia ejecutado nadie.
//   - El middleware de errores con un fallo inesperado: el que decide que un
//     "Duplicate entry ... for key usuario.correo" no salga a la calle.
//   - Los avisos de despliegue de config/frontend.js, que son lo que se lee
//     cuando el servidor no arranca.
//
// La aplicacion lee NODE_ENV y CORS_ORIGINS al cargarse, asi que para probar
// produccion hay que volver a cargarla con otro entorno. Se hace en un
// registro de modulos aparte, y se cierra a mano el pool que esa copia crea:
// si no, Jest se queda con una conexion abierta al terminar.
// ============================================

const request = require('supertest');

const frontend = require('../src/config/frontend');
const contenidoRepository = require('../src/modules/contenido/contenido.repository');
const { crearCuenta, como } = require('./ayudas');

const ENTORNO = { ...process.env };

/** Carga una copia de la aplicacion con el entorno que se le diga. */
function cargarApp(entorno) {
  let app;
  let pool;

  Object.assign(process.env, entorno);

  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    app = require('../src/app');
    // eslint-disable-next-line global-require
    pool = require('../src/config/database');
  });

  return { app, cerrar: () => pool.end() };
}

afterEach(() => {
  process.env = { ...ENTORNO };
  jest.restoreAllMocks();
});

describe('el CORS de produccion', () => {
  // En desarrollo vale cualquier origen para no registrar cada puerto que se
  // use al probar. En produccion eso dejaria que cualquier pagina de
  // internet llamara a la API con la sesion de quien la visita.
  test('solo deja pasar los origenes de CORS_ORIGINS', async () => {
    const { app, cerrar } = cargarApp({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://qrempresarial.co, https://www.qrempresarial.co'
    });

    try {
      const permitido = await request(app)
        .get('/api/health')
        .set('Origin', 'https://qrempresarial.co');

      expect(permitido.headers['access-control-allow-origin'])
        .toBe('https://qrempresarial.co');

      const ajeno = await request(app)
        .get('/api/health')
        .set('Origin', 'https://pagina-cualquiera.co');

      expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await cerrar();
    }
  });

  // Los espacios de la lista se quitan: "a, b" tiene que valer igual que
  // "a,b", porque asi es como se escribe una variable de entorno a mano.
  test('los espacios de la lista no cuentan', async () => {
    const { app, cerrar } = cargarApp({
      NODE_ENV: 'production',
      CORS_ORIGINS: '  https://uno.co ,  https://dos.co  '
    });

    try {
      const respuesta = await request(app)
        .get('/api/health')
        .set('Origin', 'https://dos.co');

      expect(respuesta.headers['access-control-allow-origin']).toBe('https://dos.co');
    } finally {
      await cerrar();
    }
  });

  // Sin la variable, la lista queda vacia y no pasa nadie de fuera. Es lo
  // que debe ser: cerrarse, no abrirse. Y no deja el servicio inutil, porque
  // Express publica el frontend desde el mismo origen y eso no es CORS.
  test('sin la variable no pasa ningun origen de fuera', async () => {
    const { app, cerrar } = cargarApp({ NODE_ENV: 'production', CORS_ORIGINS: '' });

    try {
      const deFuera = await request(app)
        .get('/api/health')
        .set('Origin', 'https://qrempresarial.co');

      expect(deFuera.headers['access-control-allow-origin']).toBeUndefined();

      // El mismo origen sigue funcionando: no se rompe el despliegue normal
      const mismoOrigen = await request(app).get('/api/health');

      expect(mismoOrigen.status).toBe(200);
    } finally {
      await cerrar();
    }
  });

  test('en desarrollo sigue valiendo cualquiera', async () => {
    const { app, cerrar } = cargarApp({ NODE_ENV: 'development', CORS_ORIGINS: '' });

    try {
      const respuesta = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5500');

      expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:5500');
    } finally {
      await cerrar();
    }
  });

  // Ahi viaja el nombre del archivo en la descarga del codigo QR (RF-08).
  // Sin exponerla, el navegador no la deja leer y el archivo se guarda con
  // un nombre generico.
  test('Content-Disposition se expone en los dos entornos', async () => {
    for (const NODE_ENV of ['production', 'development']) {
      const { app, cerrar } = cargarApp({ NODE_ENV, CORS_ORIGINS: 'https://uno.co' });

      try {
        const respuesta = await request(app)
          .get('/api/health')
          .set('Origin', 'https://uno.co');

        expect(respuesta.headers['access-control-expose-headers'])
          .toContain('Content-Disposition');
      } finally {
        await cerrar();
      }
    }
  });
});

describe('cuando algo falla sin estar previsto', () => {
  // El middleware registra el error entero a proposito, para poder
  // investigarlo. Aqui se silencia para no ensuciar el informe: es parte de
  // lo que se esta probando, no un fallo.
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));

  /** Rompe una consulta cualquiera como la rompe MySQL: sin status. */
  const romperLaBase = (mensaje) => jest
    .spyOn(contenidoRepository, 'listarCategorias')
    .mockRejectedValue(Object.assign(new Error(mensaje), { code: 'ER_DUP_ENTRY' }));

  test('responde 500 sin contar lo que paso por dentro', async () => {
    const { token } = await crearCuenta();

    romperLaBase("Duplicate entry 'ana@ejemplo.co' for key 'usuario.correo'");

    const respuesta = await como(token).get('/api/contenido/categorias');

    expect(respuesta.status).toBe(500);
    expect(respuesta.body.message).toBe('Error interno del servidor');
  });

  // Un mensaje de MySQL dice que tablas y columnas hay, y a veces datos de
  // otras cuentas —el correo del ejemplo de arriba—.
  test('ni el nombre de la tabla, ni el dato que choco', async () => {
    const { token } = await crearCuenta();

    romperLaBase("Duplicate entry 'ana@ejemplo.co' for key 'usuario.correo'");

    const respuesta = await como(token).get('/api/contenido/categorias');

    expect(respuesta.text).not.toContain('usuario.correo');
    expect(respuesta.text).not.toContain('ana@ejemplo.co');
    expect(respuesta.text).not.toContain('Duplicate');
  });

  // Lo contrario seria igual de malo: los errores que SI estan previstos
  // llevan un mensaje escrito para quien lo lee, y taparlo todo lo perderia.
  test('pero un error previsto conserva su mensaje', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Sin categoria'
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toBeTruthy();
    expect(respuesta.body.message).not.toBe('Error interno del servidor');
  });
});

describe('los avisos de despliegue', () => {
  // Es lo que se lee cuando el servidor no arranca, asi que tiene que decir
  // que hacer y no solo que algo falta.
  test('si falta el frontend compilado, dice como compilarlo', () => {
    jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(false);

    const problema = frontend.revisar();

    expect(problema).toMatch(/npm run build/);
    expect(problema).toMatch(/FRONTEND=clasico/);
  });

  test('y con el frontend original dice cual es la carpeta que falta', () => {
    const antes = process.env.FRONTEND;

    process.env.FRONTEND = 'clasico';
    jest.resetModules();

    // eslint-disable-next-line global-require
    const clasico = require('../src/config/frontend');

    jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(false);

    expect(clasico.revisar()).toMatch(/No existe la carpeta del frontend/);

    process.env.FRONTEND = antes;
    jest.resetModules();
  });

  // La carpeta puede estar y la pantalla no: pasa con un dist a medio
  // compilar, y el sintoma seria un 404 al escanear un codigo.
  test('si esta la carpeta pero falta la pantalla publica, lo dice', () => {
    jest.spyOn(require('node:fs'), 'existsSync')
      .mockImplementation((ruta) => !String(ruta).endsWith('index.html'));

    expect(frontend.revisar()).toMatch(/Falta la pantalla publica/);
  });
});
