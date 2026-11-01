// ============================================
// PWA.SPEC.JS — el icono de la pestana, el manifiesto y el service worker
//
// REGRESION. El <head> del index.html no tenia ninguna etiqueta de icono, asi
// que el navegador solo buscaba /favicon.ico -que no existe- y la pestana
// salia sin icono. Los archivos estaban en public/assets desde el principio:
// apple-touch-icon.png, icon-192.png, icon-512.png, favicon-32.png. Se
// publicaban en dist/assets y nada los enlazaba.
//
// Tampoco habia manifiesto, ni service worker, ni robots.txt. El frontend
// original tenia los cuatro.
//
// Por que no en jsdom: lo del <head> se podria leer como texto, pero no es lo
// que importa. Lo que importa es si el navegador ENCUENTRA lo que esas
// etiquetas prometen -que las rutas respondan 200 y con el tipo correcto- y
// si el service worker llega a registrarse de verdad. Eso solo lo dice un
// navegador pidiendo los archivos.
// ============================================

import { expect, test } from '@playwright/test';

test.describe('el icono de la pestana', () => {
  test('el HTML enlaza los iconos', async ({ page }) => {
    await page.goto('/login');

    const enlaces = await page.locator('link[rel*="icon"]').evaluateAll((nodos) =>
      nodos.map((n) => ({ rel: n.getAttribute('rel'), href: n.getAttribute('href') })));

    expect(enlaces).toEqual(expect.arrayContaining([
      { rel: 'icon', href: '/favicon.svg' },
      { rel: 'icon', href: '/assets/favicon-32.png' },
      { rel: 'apple-touch-icon', href: '/assets/apple-touch-icon.png' }
    ]));
  });

  // Un <link> a un archivo que no esta es peor que no tenerlo: la pestana
  // sigue sin icono y nada lo dice.
  for (const archivo of [
    '/favicon.svg',
    '/assets/favicon-32.png',
    '/assets/apple-touch-icon.png',
    '/assets/icon-192.png',
    '/assets/icon-512.png'
  ]) {
    test(`${archivo} se sirve`, async ({ request }) => {
      const respuesta = await request.get(archivo);

      expect(respuesta.status()).toBe(200);
      expect(respuesta.headers()['content-type']).toMatch(/image\/(svg\+xml|png)/);
    });
  }
});

test.describe('el manifiesto', () => {
  test('esta enlazado y se sirve', async ({ page, request }) => {
    await page.goto('/login');

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');

    const respuesta = await request.get('/manifest.json');

    expect(respuesta.status()).toBe(200);
  });

  // Sin name, sin icono de 192 y sin display standalone, el navegador no
  // ofrece instalar la aplicacion. Son los campos que de verdad mira.
  test('trae lo que el navegador necesita para ofrecer instalarla', async ({ request }) => {
    const manifiesto = await (await request.get('/manifest.json')).json();

    expect(manifiesto.name).toBeTruthy();
    expect(manifiesto.short_name).toBeTruthy();
    expect(manifiesto.display).toBe('standalone');
    expect(manifiesto.start_url).toBe('/login');

    const tamanos = manifiesto.icons.map((i) => i.sizes);

    expect(tamanos).toContain('192x192');
    expect(tamanos).toContain('512x512');
  });

  // Un icono maskable es el que Android recorta a su forma sin dejar bordes
  // blancos alrededor.
  test('incluye un icono maskable', async ({ request }) => {
    const manifiesto = await (await request.get('/manifest.json')).json();

    expect(manifiesto.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  test('sus iconos existen', async ({ request }) => {
    const manifiesto = await (await request.get('/manifest.json')).json();

    for (const icono of manifiesto.icons) {
      const respuesta = await request.get(icono.src);

      expect(respuesta.status(), icono.src).toBe(200);
    }
  });
});

test.describe('robots.txt y el sitemap', () => {
  // Las direcciones de React no son archivos: el servidor entrega el mismo
  // index.html para todas, asi que un robot que pida /contenido recibe un
  // 200 y no un 404. Sin estas reglas indexaria el panel entero.
  test('el panel queda fuera de los buscadores', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();

    for (const privada of ['/contenido', '/codigo-qr', '/configuracion', '/usuarios', '/api/']) {
      expect(robots, privada).toContain(`Disallow: ${privada}`);
    }
  });

  test('las paginas de los negocios si se indexan', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();

    expect(robots).toContain('Allow: /p/');
  });

  test('el sitemap se sirve y es XML', async ({ request }) => {
    const respuesta = await request.get('/sitemap.xml');

    expect(respuesta.status()).toBe(200);
    expect(await respuesta.text()).toContain('<urlset');
  });
});

// Los service workers estan bloqueados para toda la suite -ver
// playwright.config.js-, porque uno activo responderia desde su cache y
// sacaria las peticiones del alcance de page.route(). Aqui se permiten a
// proposito, que es el unico sitio donde se comprueba que se registre.
test.describe('el service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('se registra y queda activo', async ({ page }) => {
    // Sin la API simulada, pero tampoco se sale a internet: el login no pide
    // nada al servidor mientras no haya sesion, y lo unico de fuera son las
    // tipografias de Google.
    await page.context().route(/^https?:\/\/(?!localhost(:|\/|$))/, (ruta) => ruta.abort());

    await page.goto('/login');

    const estado = await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.ready;

      return {
        alcance: new URL(registro.scope).pathname,
        activo: Boolean(registro.active)
      };
    });

    expect(estado.activo).toBe(true);

    // El alcance tiene que ser la raiz: un service worker registrado en
    // /assets/ no cubriria las pantallas.
    expect(estado.alcance).toBe('/');
  });

  // Es lo que de verdad aporta: abrir sin conexion. Se comprueba cortando la
  // red del navegador despues de la primera visita.
  test('la aplicacion abre sin conexion una vez visitada', async ({ page, context }) => {
    await page.context().route(/^https?:\/\/(?!localhost(:|\/|$))/, (ruta) => ruta.abort());

    await page.goto('/login');
    await page.evaluate(() => navigator.serviceWorker.ready);

    // La portada tiene que quedar en la cache: el service worker la precarga
    // al instalarse.
    await context.setOffline(true);

    await page.goto('/');

    await expect(page.locator('#root')).toBeAttached();

    await context.setOffline(false);
  });
});
