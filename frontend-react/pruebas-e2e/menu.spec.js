// ============================================
// MENU.SPEC.JS — el contenido por secciones y la pantalla del menú (RF-05)
//
// Dos cosas que el frontend original tenía y el de React no:
//
//   - La API devuelve el contenido agrupado por secciones y las pantallas
//     públicas lo tiraban: lo pintaban todo en una lista plana. El dueño
//     reparte su contenido en tres pestañas y el visitante no las veía.
//   - No existía la pantalla del menú. El original tenía menu.html, con su
//     botón desde el perfil público.
//
// Por qué no en jsdom: que el contenido quede AGRUPADO es estructura del DOM
// y se prueba allí, que es mil veces más rápido. Lo que no se puede probar
// allí es el recorrido: que el botón navegue de verdad sin recargar, que la
// pantalla del menú aguante una recarga y un enlace directo, que Atrás
// vuelva al perfil, que el título de la pestaña y los colores del negocio
// lleguen a esta pantalla, y que el clic en un enlace del menú salga por
// sendBeacon, que en jsdom no existe.
// ============================================

import { expect, test } from '@playwright/test';

import { simularApi, PERFIL } from './ayudas.js';

const DEL_NEGOCIO = `/p/${PERFIL.slug}`;
const SU_MENU = `${DEL_NEGOCIO}/menu`;

test.describe('la pagina del negocio', () => {
  test('separa el contenido por secciones, con sus nombres', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    await expect(page.getByRole('heading', { name: 'Menú principal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Promociones' })).toBeVisible();
  });

  // Antes todo caia en la misma lista: una promocion y un dato de contacto
  // salian con el mismo aspecto, uno detras de otro.
  test('cada bloque queda dentro de su seccion', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    const menu = page.locator('section.publicado__seccion').filter({
      has: page.getByRole('heading', { name: 'Menú principal' })
    });

    await expect(menu.getByText('Escríbenos por WhatsApp')).toBeVisible();
    await expect(menu.getByText('Combo desayuno')).toHaveCount(0);
  });

  // El orden es el de las pestañas del panel: quien lo ordena alli espera
  // verlo asi, y el objeto de la respuesta no garantiza ningun orden.
  test('las secciones salen en el orden del panel', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    // toHaveText con un arreglo compara la lista entera y reintenta hasta que
    // la pantalla acabe de dibujarse. Con allTextContents(), que lee una vez
    // y no espera, esta prueba fallaba de vez en cuando con la lista vacía.
    await expect(page.locator('.publicado__titulo'))
      .toHaveText(['Menú principal', 'Promociones']);
  });

  // Una seccion sin contenido visible no se anuncia. "Reservaciones" no tiene
  // bloques en los datos de prueba.
  test('una seccion sin contenido no saca su titulo', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    await expect(page.getByRole('heading', { name: 'Menú principal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reservaciones' })).toHaveCount(0);
  });

  // Un bloque desactivado no sale en la vista publica, y tampoco debe salir
  // dentro de su seccion: es la regla de siempre, comprobada ahora que los
  // bloques pasan por el agrupado.
  test('un bloque desactivado sigue sin salir', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    await expect(page.getByRole('heading', { name: 'Menú principal' })).toBeVisible();
    await expect(page.getByText('Pedidos para llevar')).toHaveCount(0);
  });
});

test.describe('el boton del menu completo', () => {
  test('lleva al menu sin recargar la pagina', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    // Si el navegador recargara, esta marca se perdería: el botón es un
    // enlace del enrutador, no una dirección que se vuelve a pedir.
    await page.evaluate(() => { window.__sinRecargar = true; });

    await page.getByRole('link', { name: 'Ver menú completo' }).click();

    await expect(page).toHaveURL(SU_MENU);
    await expect(page.getByRole('heading', { level: 1, name: PERFIL.nombreNegocio }))
      .toBeVisible();
    expect(await page.evaluate(() => window.__sinRecargar)).toBe(true);
  });

  test('no se ofrece si el negocio no publico nada en el menu', async ({ page }) => {
    await simularApi(page, { sinMenu: true });
    await page.goto(DEL_NEGOCIO);

    await expect(page.getByRole('heading', { name: 'Promociones' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver menú completo' })).toHaveCount(0);
  });

  // Se pulsa con el pulgar, recien salida la camara del codigo.
  test('se puede acertar con el dedo', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    const caja = await page.getByRole('link', { name: 'Ver menú completo' }).boundingBox();

    expect(caja.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('la pantalla del menu', () => {
  test('enseña solo los bloques del menu', async ({ page }) => {
    await simularApi(page);
    await page.goto(SU_MENU);

    await expect(page.getByText('Escríbenos por WhatsApp')).toBeVisible();
    await expect(page.getByText('Horneamos cada mañana')).toBeVisible();

    // Si se colara una promoción, esta pantalla sería la página pública otra
    // vez y no habría razón para que existiera.
    await expect(page.getByText('Combo desayuno')).toHaveCount(0);
  });

  test('se titula con el negocio', async ({ page }) => {
    await simularApi(page);
    await page.goto(SU_MENU);

    await expect(page).toHaveTitle(`Menú de ${PERFIL.nombreNegocio} · QR Empresarial`);
  });

  // Aqui se puede llegar por un enlace directo, y entonces no hay atras.
  test('aguanta un enlace directo y una recarga', async ({ page }) => {
    await simularApi(page);
    await page.goto(SU_MENU);

    await expect(page.getByRole('heading', { level: 1, name: PERFIL.nombreNegocio }))
      .toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { level: 1, name: PERFIL.nombreNegocio }))
      .toBeVisible();
    await expect(page.getByText('Escríbenos por WhatsApp')).toBeVisible();
  });

  test('volver al perfil lleva al de este negocio', async ({ page }) => {
    await simularApi(page);
    await page.goto(SU_MENU);

    await page.getByRole('link', { name: 'Volver al perfil' }).click();

    await expect(page).toHaveURL(DEL_NEGOCIO);
    await expect(page.getByRole('heading', { name: 'Menú principal' })).toBeVisible();
  });

  test('y el Atras del navegador tambien', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    await page.getByRole('link', { name: 'Ver menú completo' }).click();
    await expect(page).toHaveURL(SU_MENU);

    await page.goBack();

    await expect(page).toHaveURL(DEL_NEGOCIO);
    await expect(page.getByRole('heading', { name: 'Promociones' })).toBeVisible();
  });

  test('lo dice cuando el negocio no publico menu', async ({ page }) => {
    await simularApi(page, { sinMenu: true });
    await page.goto(SU_MENU);

    await expect(page.getByText('Este negocio todavía no ha publicado su menú.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver al perfil' })).toBeVisible();
  });

  test('y que el perfil no existe, cuando no existe', async ({ page }) => {
    await simularApi(page, { perfilPublicoNoDisponible: true });
    await page.goto(SU_MENU);

    await expect(page.getByRole('alert')).toContainText('no está disponible');
  });

  // Los colores son del negocio (RF-12), igual que en su pagina.
  test('se ve con los colores del negocio', async ({ page }) => {
    await simularApi(page, { tema: 'terracota' });
    await page.goto(SU_MENU);

    await expect(page.getByRole('heading', { level: 1, name: PERFIL.nombreNegocio }))
      .toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'terracota');
  });
});

test.describe('los clics del menu (RF-11)', () => {
  // El frontend original NO los contaba: la misma lista de enlaces se medía
  // en la página pública y se perdía al entrar al menú, que es justo donde un
  // restaurante pone los suyos. Van por sendBeacon, que jsdom no tiene.
  test('un clic en un enlace del menu se cuenta', async ({ page }) => {
    await simularApi(page);
    await page.goto(SU_MENU);

    await page.getByRole('link', { name: 'https://wa.me/573001234567' }).click();

    await expect.poll(() => page.eventos.length).toBe(1);

    expect(page.eventos[0]).toMatchObject({
      slug: PERFIL.slug,
      tipo: 'clic',
      idEnlace: 41
    });
  });

  test('pulsar un bloque de texto no cuenta nada', async ({ page }) => {
    await simularApi(page);
    await page.goto(SU_MENU);

    await page.getByText('Horneamos cada mañana').click();

    await expect(page.getByText('Horneamos cada mañana')).toBeVisible();
    expect(page.eventos).toEqual([]);
  });

  // Quien llega aqui viene de la pagina del negocio, donde ya se conto una
  // visita: contarla otra vez haria que un visitante apareciera como dos.
  test('abrir el menu no cuenta una visita', async ({ page }) => {
    await simularApi(page);
    await page.goto(SU_MENU);

    await expect(page.getByText('Escríbenos por WhatsApp')).toBeVisible();

    expect(page.eventos).toEqual([]);
  });

  // El boton es un enlace de la propia aplicacion: no es un enlace del
  // negocio y no debe ensuciar la medida de los que si lo son.
  test('el boton del menu no se cuenta como clic de un enlace', async ({ page }) => {
    await simularApi(page);
    await page.goto(DEL_NEGOCIO);

    await expect.poll(() => page.eventos.length).toBe(1); // la visita

    await page.getByRole('link', { name: 'Ver menú completo' }).click();
    await expect(page).toHaveURL(SU_MENU);

    expect(page.eventos.filter((e) => e.tipo === 'clic')).toEqual([]);
  });
});
