// ============================================
// TESTS/FRONTEND-PUBLICADO.TEST.JS — las pantallas que sirve Express
//
// El backend no solo expone la API: publica tambien el frontend, y desde que
// hay dos -el original y el de React- cual se sirve lo decide la variable
// FRONTEND. Lo que se prueba aqui es que esa eleccion no rompa la API ni deje
// sin pantalla a quien escanea un codigo.
//
// Las rutas de React -/perfil, /contenido- no son archivos: las resuelve su
// enrutador en el navegador. Sin el reenvio, recargar cualquiera de ellas
// daria un 404 del servidor, que es el fallo mas facil de dejar pasar al
// publicar una aplicacion de una sola pagina: funciona navegando y se rompe
// al recargar.
// ============================================

const fs = require('fs');
const path = require('path');

const request = require('supertest');

const app = require('../src/app');
const frontend = require('../src/config/frontend');
const { crearCuenta, agregarBloque, como } = require('./ayudas');

const hayCompilado = fs.existsSync(frontend.CARPETA);

// Sin frontend-react/dist no hay nada que servir. Se avisa en lugar de dar
// una lista de fallos que no dicen que falta compilar.
const siCompilado = hayCompilado ? describe : describe.skip;

if (!hayCompilado) {
  console.warn(
    `\n  Se omiten las pruebas del frontend publicado: falta ${frontend.CARPETA}.`
    + '\n  Compilelo con: cd frontend-react && npm install && npm run build\n'
  );
}

describe('la configuracion del frontend', () => {
  it('publica el de React salvo que se pida el clasico', () => {
    expect(frontend.EN_REACT).toBe(true);
    expect(frontend.CARPETA).toMatch(/frontend-react[\\/]dist$/);
  });

  // React no sirve archivos .html: sus direcciones las resuelve el enrutador,
  // y el enlace del correo de recuperacion tiene que apuntar a una que exista.
  it('el enlace de recuperacion apunta a una ruta de React', () => {
    expect(frontend.RUTA_RESTABLECER).toBe('/restablecer');
  });

  // Se recarga el modulo con la variable puesta: la lee una sola vez, al
  // cargarse, asi que cambiarla despues no tendria efecto.
  it('con FRONTEND=clasico publica el frontend original', () => {
    const antes = process.env.FRONTEND;

    process.env.FRONTEND = 'clasico';
    jest.resetModules();

    const clasico = require('../src/config/frontend');

    expect(clasico.EN_REACT).toBe(false);
    expect(clasico.CARPETA).toMatch(/[\\/]frontend$/);
    expect(clasico.PANTALLA_PUBLICA).toMatch(/public\.html$/);

    // Alli cada pantalla si es un archivo, y el enlace del correo tiene que
    // apuntar al que existe.
    expect(clasico.RUTA_RESTABLECER).toBe('/restablecer.html');

    process.env.FRONTEND = antes;
    jest.resetModules();
  });

  it('revisar() avisa si falta lo que hay que publicar', () => {
    const problema = frontend.revisar();

    if (hayCompilado) {
      expect(problema).toBeNull();
    } else {
      expect(problema).toMatch(/npm run build/);
    }
  });
});

siCompilado('las pantallas', () => {
  it('la portada entrega la aplicacion', async () => {
    const respuesta = await request(app).get('/');

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('id="root"');
  });

  // Son las direcciones que resuelve el enrutador de React. Sin el reenvio,
  // recargarlas daria 404.
  it.each(['/perfil', '/contenido', '/codigo-qr', '/actividad', '/configuracion',
    '/usuarios', '/administracion', '/login', '/registro', '/restablecer'])(
    'recargar %s entrega la aplicacion, no un 404',
    async (ruta) => {
      const respuesta = await request(app).get(ruta);

      expect(respuesta.status).toBe(200);
      expect(respuesta.text).toContain('id="root"');
    }
  );

  it('una direccion inventada tambien: la pantalla de React dira que no existe', async () => {
    const respuesta = await request(app).get('/esto-no-existe-en-ninguna-parte');

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('id="root"');
  });

  // Entregar el index.html donde se pedia un .js dejaria al navegador
  // intentando ejecutar HTML, y el error no diria que falta el archivo.
  it('un archivo que no existe sigue siendo 404', async () => {
    const respuesta = await request(app).get('/assets/no-existe-este-archivo.js');

    expect(respuesta.status).toBe(404);
  });

  // A un POST a una ruta que no existe hay que decirle que no existe, no
  // entregarle una pagina.
  it('el reenvio solo responde a GET', async () => {
    const respuesta = await request(app).post('/una-ruta-cualquiera');

    expect(respuesta.status).toBe(404);
  });

  it('los iconos y la imagen de vista previa se sirven', async () => {
    const respuesta = await request(app).get('/assets/og-image.png');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/image\/png/);
  });
});

describe('la API no la tapa el frontend', () => {
  it('/api/health responde JSON', async () => {
    const respuesta = await request(app).get('/api/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('ok');
  });

  // Quien llama a la API espera JSON. Devolverle el index.html le haria
  // reventar al convertirlo, y el error no diria que la ruta no existe.
  it('una ruta /api que no existe responde JSON, no la pantalla', async () => {
    const respuesta = await request(app).get('/api/esto-no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ message: 'Recurso no encontrado' });
    expect(respuesta.text).not.toContain('id="root"');
  });
});

siCompilado('la pagina del codigo QR (/p/:slug)', () => {
  let slug;

  // Se crea el negocio aqui en lugar de usar el de database/seed.sql: la base
  // de pruebas no lo tiene, y apoyarse en datos sembrados hace que la prueba
  // falle por algo que no es lo que mira.
  beforeAll(async () => {
    const cuenta = await crearCuenta({ nombreNegocio: 'Panaderia De Prueba' });

    // Sin al menos un bloque activo el servidor se niega a generar el codigo
    await agregarBloque(cuenta.token);
    await como(cuenta.token).post('/api/qr');

    slug = cuenta.slug;
  });

  // Las etiquetas de vista previa las arma el servidor porque los robots que
  // las leen -WhatsApp, Telegram, Google- no ejecutan JavaScript. Con React
  // esto importa mas que antes: la pantalla se dibuja entera en el navegador,
  // asi que sin esto no habria nada que leer.
  it('inyecta las etiquetas del negocio en el HTML', async () => {
    const respuesta = await request(app).get(`/p/${slug}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('og:title" content="Panaderia De Prueba"');
    expect(respuesta.text).toContain('id="root"');
  });

  // Responder distinto revelaria que slugs estan registrados.
  it('un negocio que no existe recibe la misma pantalla, con etiquetas neutras', async () => {
    const respuesta = await request(app).get('/p/no-existe-este-negocio-de-prueba');

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('id="root"');
    expect(respuesta.text).toContain('noindex');
  });

  it('deja las marcas fuera del HTML servido', async () => {
    const respuesta = await request(app).get(`/p/${slug}`);

    expect(respuesta.text).not.toContain('METADATOS:INICIO');
  });

  it('el index.html compilado conserva las marcas', () => {
    const html = fs.readFileSync(path.join(frontend.CARPETA, 'index.html'), 'utf8');

    expect(html).toContain('<!-- METADATOS:INICIO -->');
    expect(html).toContain('<!-- METADATOS:FIN -->');
  });
});
