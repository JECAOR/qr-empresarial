// ============================================
// DESARROLLO.SPEC.JS — el doble paso de StrictMode, en un navegador
//
// `<StrictMode>` monta cada componente, ejecuta sus efectos, los limpia y los
// vuelve a ejecutar. Lo hace a propósito y SOLO en desarrollo: es la forma
// que tiene React de sacar a la luz un efecto que no sabe limpiarse, porque
// ese mismo efecto fallará igual cuando el componente se vuelva a montar en
// producción, que pasa cada vez que se navega.
//
// Estas pruebas corren contra el servidor de desarrollo —el único sitio de
// toda la suite donde no se mira el paquete compilado— porque React quita
// StrictMode al compilar: contra `vite preview` no habría doble paso que
// comprobar, y las pruebas pasarían sin haber mirado nada.
//
// Por qué no en jsdom: allí se puede envolver un componente en <StrictMode> y
// montarlo, y eso ya se hace —PaginaEscaneadaPage.test.jsx tiene su prueba—.
// Lo que no se puede es comprobarlo sobre la aplicación entera, arrancando
// como arranca de verdad, con su enrutador, su contexto de sesión y sus
// peticiones saliendo a la red. Es la diferencia entre probar la guarda de un
// efecto y probar que la pantalla, montada dos veces, no miente.
//
// La primera prueba es la que sostiene a las demás: si StrictMode dejara de
// duplicar, las otras pasarían sin comprobar nada.
// ============================================

import { expect, test } from '@playwright/test';

import { esperarPanel, prepararSesion, simularApi, PERFIL } from './ayudas.js';

/** Cuenta las peticiones GET a una ruta, dejándolas seguir su curso. */
async function contar(page, patron) {
  const vistas = [];

  await page.route(patron, async (ruta) => {
    if (ruta.request().method() === 'GET') vistas.push(ruta.request().url());

    await ruta.fallback();
  });

  return vistas;
}

test.describe('el doble paso existe', () => {
  // Sin esto, las demás pruebas de este archivo no demuestran nada: podrían
  // estar corriendo contra una aplicación que monta una sola vez.
  test('en desarrollo, el efecto que pide el perfil se ejecuta dos veces', async ({ page }) => {
    await simularApi(page);

    const peticiones = await contar(page, '**/api/publico/**');

    await page.goto(`/p/${PERFIL.slug}`);
    await expect(page.getByRole('heading', { name: PERFIL.nombreNegocio })).toBeVisible();

    await expect.poll(() => peticiones.length).toBe(2);
  });

  // Es lo que explica el comentario de main.jsx, y la razón de que en la
  // pestaña Network se vean dos peticiones al abrir: no es un error.
  test('tambien el que confirma la sesion', async ({ page }) => {
    await prepararSesion(page);

    const peticiones = await contar(page, '**/api/usuarios/me');

    await page.goto('/contenido');
    await esperarPanel(page);

    await expect.poll(() => peticiones.length).toBe(2);
  });
});

test.describe('y aun asi no se cuenta de mas (RF-11)', () => {
  // REGRESION. El efecto que informa la visita se ejecuta dos veces, pero la
  // primera pasada se limpia antes de que llegue su respuesta: su bandera
  // `vigente` queda en false y esa respuesta se descarta sin informar nada.
  // Sin esa bandera, cada visita contaria doble en desarrollo —y, lo que
  // importa de verdad, tambien al volver a montar la pantalla en produccion.
  test('una visita se informa una sola vez', async ({ page }) => {
    await simularApi(page);

    const peticiones = await contar(page, '**/api/publico/**');

    await page.goto(`/p/${PERFIL.slug}`);
    await expect(page.getByRole('heading', { name: PERFIL.nombreNegocio })).toBeVisible();

    // Primero se espera a que las DOS pasadas hayan pedido el perfil: contar
    // los eventos antes seria contar los de una sola.
    await expect.poll(() => peticiones.length).toBe(2);
    await expect.poll(() => page.eventos.length).toBe(1);

    expect(page.eventos[0]).toMatchObject({ slug: PERFIL.slug, tipo: 'visita' });
  });

  test('y un escaneo tampoco se duplica', async ({ page }) => {
    await simularApi(page);

    const peticiones = await contar(page, '**/api/publico/**');

    await page.goto(`/p/${PERFIL.slug}?qr=1`);
    await expect(page.getByRole('heading', { name: PERFIL.nombreNegocio })).toBeVisible();

    await expect.poll(() => peticiones.length).toBe(2);
    await expect.poll(() => page.eventos.length).toBe(1);

    expect(page.eventos[0]).toMatchObject({ tipo: 'escaneo' });
  });

  test('el menu del negocio no informa visita ninguna', async ({ page }) => {
    await simularApi(page);

    const peticiones = await contar(page, '**/api/publico/**');

    await page.goto(`/p/${PERFIL.slug}/menu`);
    await expect(page.getByRole('heading', { level: 1, name: PERFIL.nombreNegocio }))
      .toBeVisible();

    await expect.poll(() => peticiones.length).toBe(2);
    expect(page.eventos).toEqual([]);
  });
});

test.describe('los efectos que tocan algo de fuera', () => {
  // REGRESION. El dialogo se cerraba solo nada mas abrirse. close() dispara
  // el evento close, que borraba el estado, y la limpieza del efecto lo
  // llamaba: con StrictMode esa limpieza corre entre las dos pasadas, asi que
  // el dialogo se abria, se cerraba y volvia a dibujarse vacio.
  test('el dialogo de una cuenta se queda abierto', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });

    await page.goto('/administracion');
    await page.getByRole('button', { name: 'Ver' }).first().click();

    await expect(page.locator('dialog[open]')).toBeVisible();

    // Y sigue abierto un momento despues: si la limpieza lo cerrara, se
    // cerraria enseguida y no al instante.
    await expect(page.locator('dialog[open]')).toBeVisible({ timeout: 2000 });
  });

  // El color de marca se aplica en un efecto con limpieza: la pasada que se
  // descarta repone el tema guardado. Si las dos pasadas se pisaran, la
  // pantalla se quedaria con el color de la limpieza y no con el del negocio.
  test('el color de marca queda aplicado, no revertido', async ({ page }) => {
    await simularApi(page, { tema: 'terracota' });

    await page.goto(`/p/${PERFIL.slug}`);
    await expect(page.getByRole('heading', { name: PERFIL.nombreNegocio })).toBeVisible();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'terracota');
  });

  // El titulo lo pone un efecto sin limpieza: con dos pasadas se escribe dos
  // veces el mismo valor, que es inofensivo. Se comprueba que acabe bien.
  test('el titulo de la pestaña acaba siendo el del negocio', async ({ page }) => {
    await simularApi(page);

    await page.goto(`/p/${PERFIL.slug}`);

    await expect(page).toHaveTitle(`${PERFIL.nombreNegocio} · QR Empresarial`);
  });
});
