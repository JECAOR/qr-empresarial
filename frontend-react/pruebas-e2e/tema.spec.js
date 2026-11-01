// ============================================
// TEMA.SPEC.JS — el color de marca del negocio (RF-12)
//
// REGRESION, y de las gordas: el selector de color funcionaba, el servidor
// guardaba el valor y la API lo devolvia, pero NINGUNA pantalla de React lo
// aplicaba. Se elegia un color y no cambiaba nada. El frontend original si lo
// hacia, con js/theme.js y un data-theme en el <html>.
//
// Por que no en jsdom: Vitest corre con css: false, asi que alli se puede
// comprobar que se escribe el atributo, pero no que ese atributo PINTE —que
// exista el bloque html[data-theme="teal"] en global.css, que la barra tome
// su color de --color-primary y que la tipografia cambie con el tema. Eso
// necesita un motor que maquete.
//
// Los colores de aqui son los de global.css a proposito: si alguien cambia
// la paleta, estas pruebas lo dicen en lugar de seguir pasando con cualquier
// color.
// ============================================

import { expect, test } from '@playwright/test';

import { esperarPanel, prepararSesion, simularApi, PERFIL } from './ayudas.js';

const PINTADO = {
  indigo: 'rgb(79, 70, 229)',
  teal: 'rgb(11, 125, 115)',
  terracota: 'rgb(194, 65, 12)'
};

// Cada tema trae su propia tipografia, igual que en el frontend original: el
// color solo no distingue bastante dos negocios.
const TIPOGRAFIA = {
  indigo: 'Plus Jakarta Sans',
  teal: 'DM Sans',
  terracota: 'Poppins'
};

/** El color con el que el navegador acabo pintando la barra. */
const colorDeLaBarra = (page) =>
  page.locator('.barra').evaluate((barra) => getComputedStyle(barra).backgroundColor);

test.describe('el panel toma el color del negocio', () => {
  test('la barra se pinta con el color de marca, no con el de la aplicacion', async ({ page }) => {
    await prepararSesion(page, { tema: 'teal' });
    await page.goto('/contenido');
    await esperarPanel(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'teal');
    expect(await colorDeLaBarra(page)).toBe(PINTADO.teal);
  });

  test('el de defecto no pone atributo y deja los colores del :root', async ({ page }) => {
    await prepararSesion(page, { tema: 'indigo' });
    await page.goto('/contenido');
    await esperarPanel(page);

    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
    expect(await colorDeLaBarra(page)).toBe(PINTADO.indigo);
  });

  // Se comprueba en las tres pantallas con barra, y no solo en una: los
  // colores viven en variables del :root, y bastaria que una hoja de estilos
  // volviera a declarar el color a mano para que esa pantalla se quedara
  // fuera del tema.
  for (const ruta of ['/', '/perfil', '/contenido', '/codigo-qr', '/actividad', '/configuracion']) {
    test(`${ruta} tambien`, async ({ page }) => {
      await prepararSesion(page, { tema: 'terracota' });
      await page.goto(ruta);
      await esperarPanel(page);

      expect(await colorDeLaBarra(page)).toBe(PINTADO.terracota);
    });
  }

  // La hoja de Google no se descarga en estas pruebas -no se sale a
  // internet-, asi que lo que se comprueba es que el tema cambie la familia
  // que el navegador pide, no que el archivo de la fuente llegue.
  for (const [tema, familia] of Object.entries(TIPOGRAFIA)) {
    test(`el tema ${tema} pide la tipografia ${familia}`, async ({ page }) => {
      await prepararSesion(page, { tema });
      await page.goto('/contenido');
      await esperarPanel(page);

      const pedida = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

      expect(pedida).toContain(familia);
    });
  }
});

test.describe('elegir un color', () => {
  test('se ve aplicado en el momento y sin recargar la pagina', async ({ page }) => {
    await prepararSesion(page, { tema: 'indigo' });
    await page.goto('/perfil');
    await esperarPanel(page);

    // Una marca en la pagina: si el navegador recargara, se perderia. Es lo
    // que hacia el frontend original -location.reload() despues de guardar-
    // y lo que aqui no hace falta, porque los colores son variables CSS.
    await page.evaluate(() => { window.__sinRecargar = true; });

    expect(await colorDeLaBarra(page)).toBe(PINTADO.indigo);

    await page.getByRole('button', { name: /Terracota/ }).click();

    await expect(page.getByRole('status')).toContainText('Color de marca actualizado');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'terracota');

    expect(await colorDeLaBarra(page)).toBe(PINTADO.terracota);
    expect(await page.evaluate(() => window.__sinRecargar)).toBe(true);
  });

  test('sigue puesto al recargar', async ({ page }) => {
    await prepararSesion(page, { tema: 'indigo' });
    await page.goto('/perfil');
    await esperarPanel(page);

    await page.getByRole('button', { name: /Esmeralda/ }).click();
    await expect(page.getByRole('status')).toBeVisible();

    await page.reload();
    await esperarPanel(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'teal');
  });

  // Sin la cache en localStorage se veria la aplicacion en indigo durante lo
  // que tarda GET /perfiles/me, y luego cambiar de color. Esto se mide
  // deteniendo esa respuesta: lo que haya puesto en el <html> mientras la
  // peticion sigue en el aire es lo que vera una persona en una conexion
  // lenta.
  test('al recargar no se ve un parpadeo de colores', async ({ page }) => {
    await prepararSesion(page, { tema: 'terracota' });
    await page.goto('/contenido');
    await esperarPanel(page);

    let seguirConElPerfil;
    const perfilDetenido = new Promise((seguir) => { seguirConElPerfil = seguir; });

    await page.route('**/api/perfiles/me', async (ruta) => {
      await perfilDetenido;
      await ruta.fallback();
    });

    await page.reload({ waitUntil: 'commit' });

    // El perfil todavia no ha contestado y el color ya esta puesto
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'terracota');

    seguirConElPerfil();
    await esperarPanel(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'terracota');
  });

  test('al salir se va con la sesion', async ({ page }) => {
    await prepararSesion(page, { tema: 'teal' });
    await page.goto('/contenido');
    await esperarPanel(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'teal');

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    // En un equipo compartido -el del mostrador- el color de un negocio no
    // tiene que seguir pintando la pantalla de quien entre despues.
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('qre_tema'))).toBeNull();
  });
});

test.describe('quien escanea el codigo', () => {
  // Es el sentido del requisito: los colores que ve quien escanea son los
  // del negocio. Sin sesion, que es como llega.
  test('ve la pagina con los colores del negocio', async ({ page }) => {
    await simularApi(page, { tema: 'terracota' });
    await page.goto(`/p/${PERFIL.slug}`);

    await expect(page.getByRole('heading', { name: PERFIL.nombreNegocio })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'terracota');
  });

  test('y con su tipografia', async ({ page }) => {
    await simularApi(page, { tema: 'teal' });
    await page.goto(`/p/${PERFIL.slug}`);

    await expect(page.getByRole('heading', { name: PERFIL.nombreNegocio })).toBeVisible();

    const pedida = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

    expect(pedida).toContain('DM Sans');
  });

  // El color es de ese negocio. Guardarlo pintaria con el el panel propio la
  // proxima vez que se abriera la aplicacion en este navegador, que es justo
  // lo que le pasa a quien escanea un codigo ajeno y luego entra al suyo.
  test('el color del negocio ajeno no se queda guardado', async ({ page }) => {
    await simularApi(page, { tema: 'terracota' });
    await page.goto(`/p/${PERFIL.slug}`);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'terracota');

    expect(await page.evaluate(() => localStorage.getItem('qre_tema'))).toBeNull();
  });

  test('un perfil que no existe no cambia los colores', async ({ page }) => {
    await simularApi(page, { tema: 'terracota' });
    await page.goto('/p/este-negocio-no-existe');

    await expect(page.getByRole('alert')).toBeVisible();
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
  });
});
