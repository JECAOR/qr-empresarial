// ============================================
// ESCANEADA.SPEC.JS — la pagina del codigo QR y el conteo del RF-11
//
// Los eventos se mandan con navigator.sendBeacon, que jsdom no tiene: la
// prueba de Vitest tiene que ponerle uno de pega y comprobar con que se
// llamo. Eso dice que la pantalla pidio informar el evento, no que el
// navegador lo entregue.
//
// Aqui se mira la peticion que sale de verdad. El motivo de usar sendBeacon
// -que el navegador la entrega aunque la pagina ya se este yendo al enlace
// pulsado- solo se puede comprobar en un navegador.
//
// Nota sobre el doble conteo: en desarrollo, StrictMode invoca dos veces los
// efectos, y ahi es donde hace falta la bandera `vigente` del efecto. Estas
// pruebas corren contra el paquete compilado, donde StrictMode no duplica
// nada, asi que no sustituyen a la prueba de Vitest que cubre ese caso: lo
// que comprueban es que, cargando la pagina como la carga quien escanea,
// sale exactamente un evento.
// ============================================

import { expect, test } from '@playwright/test';

import { prepararSesion, simularApi } from './ayudas.js';

/** Abre la pagina del negocio y espera a que este dibujada. */
async function abrir(page, direccion) {
  await page.goto(direccion);

  await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();
}

test.describe('lo que se cuenta al llegar', () => {
  // La imagen del codigo QR lleva ?qr=1; el enlace que alguien copia y pega
  // por WhatsApp, no. Son las dos primeras medidas que pide el RF-11, y
  // distinguirlas es lo que permite saber si el codigo impreso sirve de algo.
  test('con ?qr=1 se cuenta un escaneo', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga?qr=1');

    await expect.poll(() => page.eventos).toEqual([
      { slug: 'panaderia-la-espiga', tipo: 'escaneo' }
    ]);
  });

  test('sin el parametro se cuenta una visita', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga');

    await expect.poll(() => page.eventos).toEqual([
      { slug: 'panaderia-la-espiga', tipo: 'visita' }
    ]);
  });

  // Solo el valor "1" cuenta como escaneo. Un ?qr=0 que se contara como
  // escaneo inflaria la cifra que mide si el codigo impreso funciona.
  test('un ?qr distinto de 1 es una visita', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga?qr=0');

    await expect.poll(() => page.eventos.map((e) => e.tipo)).toEqual(['visita']);
  });

  test('cada carga cuenta una sola vez', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga?qr=1');

    await page.waitForTimeout(400);

    expect(page.eventos).toHaveLength(1);
  });

  test('recargar cuenta otra vez', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga?qr=1');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();

    await expect.poll(() => page.eventos.length).toBe(2);
  });

  // Contar la visita a una direccion inventada ensuciaria las estadisticas
  // de nadie, y de paso revelaria que la direccion se consulto.
  test('un negocio que no existe no cuenta nada', async ({ page }) => {
    await simularApi(page);
    await page.goto('/p/no-existe-este-negocio');

    await expect(page.getByRole('alert')).toBeVisible();
    await page.waitForTimeout(400);

    expect(page.eventos).toEqual([]);
  });
});

test.describe('los clics en los enlaces', () => {
  // Los enlaces abren otra pestaña, y en esta suite la red externa esta
  // cortada: se cierra la pestaña que se abra para no dejarla por ahi.
  test.beforeEach(async ({ page }) => {
    page.on('popup', (otra) => otra.close().catch(() => {}));
  });

  test('se cuenta el clic con el numero del enlace', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga?qr=1');

    await page.getByRole('link', { name: 'https://wa.me/573001234567' }).click();

    await expect.poll(() => page.eventos.filter((e) => e.tipo === 'clic')).toEqual([
      { slug: 'panaderia-la-espiga', tipo: 'clic', idEnlace: 41 }
    ]);
  });

  // El identificador que usa la API es «enlace-41»: los dos contadores de la
  // base empiezan en 1, y sin el prefijo no se sabria de que tabla es. La
  // pantalla manda solo el numero, que es lo que espera el endpoint.
  test('manda solo el numero, no el identificador con prefijo', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga');

    await page.getByRole('link', { name: 'https://instagram.com/laespiga' }).click();

    await expect.poll(() => page.eventos.filter((e) => e.tipo === 'clic')).toEqual([
      { slug: 'panaderia-la-espiga', tipo: 'clic', idEnlace: 43 }
    ]);
  });

  test('dos clics se cuentan por separado', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga');

    await page.getByRole('link', { name: 'https://wa.me/573001234567' }).click();
    await page.getByRole('link', { name: 'https://maps.app.goo.gl/espiga' }).click();

    await expect.poll(() => page.eventos.filter((e) => e.tipo === 'clic').map((e) => e.idEnlace))
      .toEqual([41, 42]);
  });

  // El conteo va por delegacion sobre el contenedor. Pulsar en cualquier
  // otro sitio de la tarjeta -el titulo, la categoria- no es un clic en el
  // enlace y no debe contarse.
  test('pulsar el titulo de la tarjeta no cuenta como clic', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga');

    await page.getByRole('heading', { name: 'Escríbenos por WhatsApp' }).click();
    await page.waitForTimeout(300);

    expect(page.eventos.filter((e) => e.tipo === 'clic')).toEqual([]);
  });

  test('un bloque de texto no tiene nada que contar', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga');

    await page.getByText('Masa madre de fermentación lenta.').click();
    await page.waitForTimeout(300);

    expect(page.eventos.filter((e) => e.tipo === 'clic')).toEqual([]);
  });

  // No se impide la navegacion: el enlace conserva su destino y su
  // target, y el evento se manda igual. Contar el clic a costa de que el
  // enlace no abra seria el peor cambio posible en esta pantalla.
  test('el enlace sigue llevando a su destino', async ({ page }) => {
    await simularApi(page);
    await abrir(page, '/p/panaderia-la-espiga');

    const enlace = page.getByRole('link', { name: 'https://wa.me/573001234567' });

    await expect(enlace).toHaveAttribute('href', 'https://wa.me/573001234567');
    await expect(enlace).toHaveAttribute('target', '_blank');
    await expect(enlace).toHaveAttribute('rel', /noopener/);
  });
});

// RF-11. El panel del dueño enseña el mismo perfil con las mismas tarjetas,
// y a proposito NO informa nada: si lo hiciera, cada vez que el dueño abriera
// su propia pantalla subiria sus visitas y sus clics, y las estadisticas que
// usa para decidir no medirian a sus clientes sino a el.
test.describe('el panel del dueño no cuenta nada', () => {
  test('abrir la portada con sesion no informa eventos', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();
    await page.waitForTimeout(400);

    expect(page.eventos).toEqual([]);
  });

  test('ni pulsar sus enlaces desde la portada', async ({ page }) => {
    page.on('popup', (otra) => otra.close().catch(() => {}));

    await prepararSesion(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();

    await page.getByRole('link', { name: 'https://wa.me/573001234567' }).click();
    await page.waitForTimeout(300);

    expect(page.eventos).toEqual([]);
  });
});
