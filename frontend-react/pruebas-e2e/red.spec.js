// ============================================
// RED.SPEC.JS — la red lenta, o caída a mitad de una operación
//
// Lo que se mira aquí no es que la aplicación funcione, sino qué hace
// mientras NO funciona: si lo dice, si lo dice en castellano, si deja
// reintentar sin volver a escribirlo todo, y si una conexión lenta puede
// hacer que algo se mande dos veces.
//
// Por qué no en jsdom: allí `fetch` es un doble que responde lo que se le
// diga, al instante. No hay «lento» ni «a medias», y un `TypeError` de red
// de verdad —que es lo que distingue estos casos— habría que fingirlo, con
// lo cual la prueba comprobaría la imitación y no el navegador.
// ============================================

import { expect, test } from '@playwright/test';

import { esperarPanel, prepararSesion, simularApi, PERFIL } from './ayudas.js';

/** Corta una ruta como si no hubiera conexión. */
const cortar = (page, patron, metodo = 'POST') =>
  page.route(patron, async (ruta) => {
    if (ruta.request().method() === metodo) return ruta.abort('internetdisconnected');

    await ruta.fallback();
  });

/** Retrasa una ruta, dejándola llegar. */
const frenar = (page, patron, ms) =>
  page.route(patron, async (ruta) => {
    await new Promise((seguir) => setTimeout(seguir, ms));
    await ruta.fallback();
  });

test.describe('cuando no hay conexion', () => {
  // REGRESION. fetch rechaza con un TypeError cuyo mensaje lo pone el
  // navegador: «Failed to fetch» en Chrome, «Load failed» en Safari. Ese
  // texto acababa en pantalla tal cual, en inglés y sin decir qué hacer.
  test('lo dice en castellano, no «Failed to fetch»', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await cortar(page, '**/api/contenido');

    await page.getByRole('button', { name: 'Agregar bloque' }).first().click();
    await page.getByLabel('Categoría').selectOption({ index: 1 });
    await page.getByLabel('Título').fill('Sin red');
    await page.getByLabel('Destino').fill('https://ejemplo.co');
    await page.locator('.bloque-form button[type=submit]').click();

    const aviso = page.getByRole('alert');

    await expect(aviso).toContainText('No se pudo conectar con el servidor');
    await expect(aviso).not.toContainText('fetch');
  });

  // Volver a escribirlo todo porque se cayó la red sería el castigo
  // equivocado: lo que se tecleó no tiene la culpa.
  test('lo escrito sigue ahi, para reintentar', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await cortar(page, '**/api/contenido');

    await page.getByRole('button', { name: 'Agregar bloque' }).first().click();
    await page.getByLabel('Categoría').selectOption({ index: 1 });
    await page.getByLabel('Título').fill('Sin red');
    await page.getByLabel('Destino').fill('https://ejemplo.co');
    await page.locator('.bloque-form button[type=submit]').click();

    await expect(page.getByRole('alert')).toBeVisible();

    await expect(page.getByLabel('Título')).toHaveValue('Sin red');
    await expect(page.locator('.bloque-form button[type=submit]')).toBeEnabled();
  });

  // La pantalla que ve quien escanea el código no pasa por el mismo sitio
  // que el panel: tiene su propia llamada.
  test('la pagina publica tampoco habla en ingles', async ({ page }) => {
    await simularApi(page);
    await cortar(page, '**/api/publico/**', 'GET');

    await page.goto(`/p/${PERFIL.slug}`);

    await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servidor');
  });

  // Y la descarga del código tampoco: devuelve un Blob, no JSON, y por eso
  // va por otra funcion.
  test('ni la descarga del codigo', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/codigo-qr');
    await expect(page.getByAltText('Vista previa del código QR')).toBeVisible();

    await cortar(page, '**/api/qr/imagen**', 'GET');

    await page.getByText('PNG').click();

    await expect(page.getByRole('alert')).toContainText('No se pudo conectar con el servidor');
  });
});

test.describe('cuando la red va lenta', () => {
  // Con la red rápida no se llega a pulsar dos veces; con la red de un móvil
  // en un sótano, sí. Si el botón no se apagara, el negocio acabaría con el
  // bloque duplicado.
  test('no se puede mandar dos veces el mismo bloque', async ({ page }) => {
    await prepararSesion(page);

    let creaciones = 0;

    await page.route('**/api/contenido', async (ruta) => {
      if (ruta.request().method() === 'POST') {
        creaciones += 1;
        await new Promise((seguir) => setTimeout(seguir, 1200));
      }

      await ruta.fallback();
    });

    await page.goto('/contenido');
    await esperarPanel(page);

    await page.getByRole('button', { name: 'Agregar bloque' }).first().click();
    await page.getByLabel('Categoría').selectOption({ index: 1 });
    await page.getByLabel('Título').fill('Una sola vez');
    await page.getByLabel('Destino').fill('https://ejemplo.co');

    const guardar = page.locator('.bloque-form button[type=submit]');

    await guardar.click();

    await expect(guardar).toBeDisabled();
    await expect(guardar).toHaveText('Guardando…');

    // Se insiste, como haría cualquiera que no ve respuesta
    await guardar.click({ force: true, timeout: 2000 }).catch(() => {});
    await guardar.click({ force: true, timeout: 2000 }).catch(() => {});

    await expect(page.getByRole('status')).toBeVisible();

    expect(creaciones).toBe(1);
  });

  // Lo mismo con las flechas: dos pulsaciones seguidas sobre una lista que
  // todavia no ha confirmado la primera.
  test('ni reordenar dos veces mientras la primera viaja', async ({ page }) => {
    await prepararSesion(page);

    let ordenes = 0;

    await page.route('**/api/contenido/orden', async (ruta) => {
      ordenes += 1;
      await new Promise((seguir) => setTimeout(seguir, 1200));
      await ruta.fallback();
    });

    await page.goto('/contenido');
    await esperarPanel(page);

    const bajar = page.getByRole('button', { name: 'Bajar Escríbenos por WhatsApp' });

    await bajar.click();
    await expect(bajar).toBeDisabled();

    await bajar.click({ force: true, timeout: 2000 }).catch(() => {});

    await expect(page.getByRole('status')).toBeVisible();

    expect(ordenes).toBe(1);
  });

  // Mientras tanto hay que decir que se está haciendo algo, o se pulsa otra
  // vez por no saber si se registró.
  test('mientras tanto se dice que esta pasando algo', async ({ page }) => {
    await prepararSesion(page);
    await frenar(page, '**/api/qr/imagen**', 900);

    await page.goto('/codigo-qr');

    await expect(page.getByText('Dibujando…')).toBeVisible();
    await expect(page.getByAltText('Vista previa del código QR')).toBeVisible();
  });
});
