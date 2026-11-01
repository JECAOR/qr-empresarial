// ============================================
// RECARGAR.SPEC.JS — recargar, abrir enlaces directos y volver atras
//
// Una aplicacion de una sola pagina no tiene un archivo por pantalla: todas
// sus direcciones las resuelve el enrutador en el navegador. El fallo clasico
// al publicarla es que funcione navegando y de 404 al recargar, y es de los
// que no aparecen probando a mano.
//
// El backend tiene su propia prueba de esto (backend/tests/frontend-publicado
// .test.js), pero esa comprueba el codigo HTTP y el HTML que entrega Express.
// Lo que no puede comprobar es lo que pasa despues: que React, al arrancar
// desde cero en esa direccion, dibuje la pantalla que toca y recupere la
// sesion. Eso necesita un navegador.
//
// jsdom tampoco sirve: su enrutador es un MemoryRouter, no hay historial del
// navegador ni recarga posible, y sessionStorage se limpia entre pruebas.
// ============================================

import { expect, test } from '@playwright/test';

import { entrarPorElFormulario, esperarPanel, prepararSesion, simularApi } from './ayudas.js';

// Lo que tiene que verse en cada direccion al llegar de golpe. La portada
// no lleva encabezado propio: lo primero suyo es el buscador.
const PANTALLAS = [
  { ruta: '/', seña: (page) => page.getByLabel('Dirección pública del negocio') },
  { ruta: '/perfil', seña: (page) => page.getByRole('heading', { name: 'Perfil del negocio' }) },
  { ruta: '/contenido', seña: (page) => page.getByRole('heading', { name: 'Contenido del perfil' }) },
  { ruta: '/codigo-qr', seña: (page) => page.getByRole('heading', { name: 'Tu código QR' }) },
  { ruta: '/actividad', seña: (page) => page.getByRole('heading', { name: 'Actividad' }) },
  { ruta: '/configuracion', seña: (page) => page.getByRole('heading', { name: 'Tu cuenta' }) }
];

test.describe('recargar una pantalla privada', () => {
  for (const { ruta, seña } of PANTALLAS) {
    test(`${ruta} se dibuja al recargarla`, async ({ page }) => {
      await prepararSesion(page);
      await page.goto(ruta);

      await expect(seña(page)).toBeVisible();

      await page.reload();

      // Lo que importa de la recarga: sigue en la misma direccion Y la
      // pantalla se dibuja. Un 200 con el index.html bastaria para lo
      // primero y no para lo segundo.
      await expect(page).toHaveURL(ruta);
      await expect(seña(page)).toBeVisible();
    });
  }

  // La sesion vive en sessionStorage, que sobrevive a una recarga de la misma
  // pestaña. AuthContext no se fia de lo guardado: vuelve a preguntar al
  // servidor quien eres, y esta prueba comprueba que ese camino funciona
  // tambien al arrancar en frio.
  test('la sesion sobrevive a la recarga y se confirma contra el servidor', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');
    await entrarPorElFormulario(page);
    await esperarPanel(page);

    const confirmaciones = [];

    page.on('request', (peticion) => {
      if (peticion.url().endsWith('/api/usuarios/me')) confirmaciones.push(peticion.url());
    });

    await page.reload();

    await esperarPanel(page);
    expect(confirmaciones).toHaveLength(1);
  });

  // Decision de diseño, no accidente: en sessionStorage y no en
  // localStorage, asi que cada pestaña tiene su sesion y cerrar la pestaña
  // la cierra. Es lo que no se puede comprobar en jsdom, donde no hay
  // pestañas.
  test('otra pestaña no hereda la sesion', async ({ page, context }) => {
    await simularApi(page);
    await page.goto('/login');
    await entrarPorElFormulario(page);
    await esperarPanel(page);

    const otra = await context.newPage();

    await simularApi(otra);
    await otra.goto('/contenido');

    await expect(otra).toHaveURL('/login');
    await expect(otra.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

    await otra.close();
  });

  // Mientras no se sabe si hay sesion no se decide nada. Sin eso, recargar
  // una pantalla privada enseñaria un salto al login antes de volver.
  test('al recargar no se ve pasar el login', async ({ page }) => {
    await prepararSesion(page);

    // La confirmacion de la sesion se retiene para poder mirar la pantalla
    // en ese momento, que es cuando se veria el parpadeo.
    let responder;
    const detenido = new Promise((resolver) => { responder = resolver; });

    await page.route('**/api/usuarios/me', async (ruta) => {
      await detenido;
      await ruta.fallback();
    });

    await page.goto('/contenido');

    await expect(page.getByText('Verificando sesión…')).toBeVisible();
    await expect(page).toHaveURL('/contenido');

    responder();

    await expect(page.getByRole('heading', { name: 'Contenido del perfil' })).toBeVisible();
  });

  // Un token que el servidor ya no acepta -caducado o revocado- no debe
  // dejar la pantalla a medias: se cierra la sesion y se manda al login.
  test('un token que el servidor rechaza acaba en el login', async ({ page }) => {
    await prepararSesion(page);

    await page.route('**/api/usuarios/me', (ruta) => ruta.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Token inválido o expirado' })
    }));

    await page.goto('/contenido');

    await expect(page).toHaveURL('/login');
  });
});

test.describe('enlaces que se abren de golpe', () => {
  test('la pagina del codigo QR se dibuja sin pasar por la aplicacion', async ({ page }) => {
    await simularApi(page);
    await page.goto('/p/panaderia-la-espiga');

    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();

    // Fuera de Layout a proposito: quien escanea no viene a navegar, y una
    // barra con «Mi negocio» y «Salir» solo le confundiria.
    await expect(page.getByRole('navigation')).toBeHidden();
  });

  test('y se vuelve a dibujar igual al recargarla', async ({ page }) => {
    await simularApi(page);
    await page.goto('/p/panaderia-la-espiga?qr=1');

    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL('/p/panaderia-la-espiga?qr=1');
    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();
  });

  test('un negocio que no existe lo dice, y no manda a ninguna parte', async ({ page }) => {
    await simularApi(page);
    await page.goto('/p/no-existe-este-negocio');

    await expect(page.getByRole('alert')).toHaveText('Este perfil no está disponible');
    await expect(page).toHaveURL('/p/no-existe-este-negocio');
  });
});

test.describe('una direccion que no existe', () => {
  // Antes el enrutador mandaba cualquier ruta desconocida a la portada sin
  // decir nada, y quien escribia mal una direccion creia haber llegado.
  test('se dice, y la direccion se queda escrita', async ({ page }) => {
    await simularApi(page);
    await page.goto('/esta-direccion-no-existe');

    await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
    await expect(page).toHaveURL('/esta-direccion-no-existe');
  });

  test('tambien si lleva varios tramos', async ({ page }) => {
    await simularApi(page);
    await page.goto('/contenido/bloque/41/editar');

    await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
  });

  test('desde ahi se puede volver al inicio', async ({ page }) => {
    await simularApi(page);
    await page.goto('/esta-direccion-no-existe');

    await page.getByRole('link', { name: 'Ir al inicio' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByLabel('Dirección pública del negocio')).toBeVisible();
  });

  // La pantalla dice que la direccion de un negocio es del tipo /p/nombre y
  // que, si no existe, esa pagina lo dice. Se comprueba que sea verdad: un
  // texto de ayuda que miente es peor que no tenerlo.
  test('lo que aconseja la pantalla funciona', async ({ page }) => {
    await simularApi(page);
    await page.goto('/panaderia-la-espiga');

    await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
    await expect(page.getByText('/p/nombre-del-negocio')).toBeVisible();

    await page.goto('/p/panaderia-la-espiga');

    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();
  });
});
