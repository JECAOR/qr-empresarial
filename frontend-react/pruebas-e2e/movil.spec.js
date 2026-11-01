// ============================================
// MOVIL.SPEC.JS — lo que decide el CSS en una pantalla estrecha
//
// Vitest corre con css: false, y jsdom no tiene motor de maquetado: no
// calcula anchos, no aplica media queries y getComputedStyle devuelve los
// valores por defecto. Todo lo de este archivo es invisible alli.
//
// Importa mas que en otra aplicacion: a esta se llega escaneando un codigo
// con el telefono, asi que la pantalla estrecha es el caso normal, no el
// excepcional.
//
// Corre solo en el proyecto «Movil» de playwright.config.js, con el viewport
// y el user agent de un iPhone 13 sobre Chromium.
// ============================================

import { expect, test } from '@playwright/test';

import { ADMINISTRADOR, prepararSesion, simularApi } from './ayudas.js';

const PANTALLAS = [
  '/',
  '/perfil',
  '/contenido',
  '/codigo-qr',
  '/actividad',
  '/configuracion',
  '/p/panaderia-la-espiga',
  '/p/panaderia-la-espiga/menu',
  '/login',
  '/registro'
];

test.describe('ninguna pantalla se desborda a lo ancho', () => {
  // Un desbordamiento horizontal en un movil obliga a arrastrar la pantalla
  // de lado para leer, y es el defecto de maquetado que mas se cuela: en el
  // escritorio no se nota.
  for (const ruta of PANTALLAS) {
    test(ruta, async ({ page }) => {
      await prepararSesion(page);
      await page.goto(ruta);

      // Se espera a que haya contenido: medir mientras dice «Cargando…» no
      // mide la pantalla.
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');

      const desborde = await page.evaluate(() => ({
        documento: document.documentElement.scrollWidth,
        ventana: document.documentElement.clientWidth,
        culpables: [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
      }));

      expect(desborde.culpables).toEqual([]);
      expect(desborde.documento).toBeLessThanOrEqual(desborde.ventana);
    });
  }
});

test.describe('la tabla de usuarios se convierte en tarjetas', () => {
  // Una tabla de seis columnas no cabe en 375 px. En lugar de dejarla
  // desplazarse de lado, el CSS la vuelve una lista de tarjetas y pone el
  // nombre de cada columna delante del dato con td::before y data-label.
  //
  // Nada de esto se puede comprobar sin motor de maquetado: en jsdom el
  // thead se ve, el ::before no existe y data-label es un atributo sin
  // efecto.
  test('el encabezado se esconde y cada dato lleva su etiqueta', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/usuarios');

    await expect(page.getByRole('heading', { name: 'Gestión de usuarios' })).toBeVisible();

    await expect(page.locator('.tabla thead')).toBeHidden();

    const celda = page.locator('.tabla tbody tr').first().locator('td').first();

    const etiqueta = await celda.evaluate(
      (el) => getComputedStyle(el, '::before').content
    );

    expect(etiqueta).toBe('"ID"');
  });

  test('en una pantalla ancha vuelve a ser una tabla', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/usuarios');

    await expect(page.locator('.tabla thead')).toBeHidden();

    await page.setViewportSize({ width: 1100, height: 800 });

    await expect(page.locator('.tabla thead')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Correo' })).toBeVisible();

    const celda = page.locator('.tabla tbody tr').first().locator('td').first();

    expect(await celda.evaluate((el) => getComputedStyle(el, '::before').content))
      .toBe('none');
  });

  // El dato sigue siendo el mismo: la etiqueta la pinta el CSS, no se
  // duplica en el HTML. Si se hubiera resuelto metiendo el nombre de la
  // columna en un <span>, el lector de pantalla lo leeria dos veces.
  test('el nombre de la columna no esta en el texto de la celda', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/usuarios');

    const celda = page.locator('.tabla tbody tr').first().locator('td').first();

    await expect(celda).toHaveText(String(ADMINISTRADOR.idUsuario));
  });
});

test.describe('la barra de navegacion', () => {
  // Con ocho enlaces no caben en una fila junto a la marca y el boton de
  // salir. El CSS los baja a una fila propia (order: 3, flex-basis: 100%) en
  // lugar de dejarlos salir de la pantalla.
  test('los enlaces bajan a su propia fila', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/');

    const marca = await page.locator('.barra__marca').boundingBox();
    const enlaces = await page.locator('.barra__nav').boundingBox();

    expect(enlaces.y).toBeGreaterThan(marca.y + marca.height - 1);
    expect(enlaces.width).toBeGreaterThan(300);
  });

  test('todos los enlaces se pueden pulsar', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/');

    const enlaces = page.locator('.barra__nav a');

    await expect(enlaces).toHaveCount(8);

    for (const enlace of await enlaces.all()) {
      const caja = await enlace.boundingBox();

      expect(caja.width).toBeGreaterThan(0);
      expect(caja.height).toBeGreaterThan(0);
    }
  });
});

test.describe('las pantallas que cambian de forma', () => {
  // El codigo y sus opciones estan en dos columnas en el escritorio. En el
  // movil se apilan: si no, el codigo quedaria de 40 px de ancho.
  test('el codigo QR y sus opciones se apilan', async ({ page }) => {
    await simularApi(page);
    await prepararSesion(page);
    await page.goto('/codigo-qr');

    await expect(page.getByAltText('Vista previa del código QR')).toBeVisible();

    const lienzo = await page.locator('.qr__lienzo').boundingBox();
    const opciones = await page.locator('.qr__opciones').boundingBox();

    expect(opciones.y).toBeGreaterThan(lienzo.y + lienzo.height - 1);
  });

  // Compartir es lo siguiente que se hace despues de generar el codigo, y se
  // hace desde el telefono: los tres tienen que poder pulsarse con el pulgar.
  // El minimo son los 24 px del criterio 2.5.8 de la WCAG 2.2.
  test('las formas de compartir se pueden pulsar con el dedo', async ({ page }) => {
    await simularApi(page);
    await prepararSesion(page);
    await page.goto('/codigo-qr');

    await expect(page.getByAltText('Vista previa del código QR')).toBeVisible();

    for (const nombre of ['WhatsApp', 'Correo', 'Instagram']) {
      const caja = await page.getByRole(nombre === 'Instagram' ? 'button' : 'link',
        { name: nombre, exact: true }).boundingBox();

      expect(caja.height, nombre).toBeGreaterThanOrEqual(24);
    }
  });

  // Los tres botones de formato tambien, por el mismo motivo: en una fila
  // de 375 px el texto de ayuda de cada uno no cabria.
  test('los formatos de descarga quedan uno por fila', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/codigo-qr');

    const botones = page.locator('.qr__formatos button');

    await expect(botones).toHaveCount(3);

    const cajas = await Promise.all((await botones.all()).map((b) => b.boundingBox()));

    expect(cajas[1].y).toBeGreaterThan(cajas[0].y);
    expect(cajas[2].y).toBeGreaterThan(cajas[1].y);
  });

  // La grafica se dibuja en coordenadas propias y el SVG la escala al ancho
  // que tenga, para no tener que medir el contenedor ni volver a dibujar al
  // girar el telefono. Esto comprueba que de verdad se escala.
  test('la grafica se escala al ancho de la pantalla', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/actividad');

    const grafica = page.locator('.grafica__lienzo');

    await expect(grafica).toBeVisible();

    const estrecha = await grafica.boundingBox();

    expect(estrecha.width).toBeLessThanOrEqual(375);

    await page.setViewportSize({ width: 1100, height: 800 });

    const ancha = await grafica.boundingBox();

    expect(ancha.width).toBeGreaterThan(estrecha.width);
  });

  // REGRESION. Las flechas son lo unico que queda para mover un bloque con
  // el dedo -el arrastre de HTML no funciona al tacto-, y median 22 x 20 px:
  // por debajo de los 24 x 24 que exige el criterio 2.5.8 de la WCAG 2.2, y
  // dificiles de acertar justo donde son imprescindibles.
  //
  // Se comprueba el minimo de la norma y no el tamaño que tienen hoy: lo que
  // esta prueba defiende es el criterio, no la decision de diseño.
  const MINIMO_WCAG = 24;

  test('las flechas de reordenar se pueden acertar con el dedo', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');

    const bajar = page.getByLabel('Bajar Escríbenos por WhatsApp');

    await expect(bajar).toBeVisible();

    const caja = await bajar.boundingBox();

    expect(caja.width).toBeGreaterThanOrEqual(MINIMO_WCAG);
    expect(caja.height).toBeGreaterThanOrEqual(MINIMO_WCAG);
  });

  test('y funcionan al tacto', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');

    await page.getByLabel('Bajar Escríbenos por WhatsApp').tap();

    await expect(page.getByRole('status')).toHaveText('Orden actualizado');

    expect((await page.locator('.bloque__titulo').allInnerTexts())[0].trim())
      .toBe('Cómo llegar');
  });
});
