// ============================================
// ARRASTRAR.SPEC.JS — reordenar el contenido con el raton
//
// jsdom no tiene arrastre nativo: no hay dataTransfer, y la prueba de Vitest
// tiene que despachar dragStart y drop a mano con fireEvent, que ademas los
// envuelve en act(). Eso comprueba que los manejadores hacen su cuenta, no
// que arrastrar con el raton funcione.
//
// Aqui el arrastre lo hace el navegador de verdad, con sus tres eventos y su
// orden. Se prueba despacio y con los tres eventos seguidos, que es el caso
// que el comentario del componente daba por roto -y no lo esta: ver la nota
// en ListaBloques.jsx, donde se corrigio esa afirmacion despues de medirla
// aqui-.
// ============================================

import { expect, test } from '@playwright/test';

import { prepararSesion } from './ayudas.js';

const EN_ORDEN = [
  'Escríbenos por WhatsApp',
  'Cómo llegar',
  'Síguenos en Instagram',
  'Horneamos cada mañana',
  'Pedidos para llevar'
];

/** Abre Contenido con la seccion «Menú principal» ya cargada. */
async function abrirContenido(page, opciones = {}) {
  await prepararSesion(page, opciones);
  await page.goto('/contenido');

  await expect(page.getByRole('heading', { name: 'Contenido del perfil' })).toBeVisible();

  const filas = page.getByRole('listitem');

  await expect(filas).toHaveCount(EN_ORDEN.length);

  return filas;
}

/** Los titulos que se ven, en el orden en que se ven. */
async function titulos(filas) {
  return (await filas.locator('.bloque__titulo').allInnerTexts()).map((t) => t.trim());
}

test.describe('arrastrar con el raton', () => {
  test('mover el tercero al primer puesto reordena la lista', async ({ page }) => {
    const filas = await abrirContenido(page);

    await filas.nth(2).dragTo(filas.nth(0));

    await expect(page.getByRole('status')).toHaveText('Orden actualizado');

    // El orden que se ve sale de volver a pedir la lista al servidor, no de
    // tocar el estado local: lo que enseña la pantalla es lo que el servidor
    // acepto.
    expect(await titulos(filas)).toEqual([
      'Síguenos en Instagram',
      'Escríbenos por WhatsApp',
      'Cómo llegar',
      'Horneamos cada mañana',
      'Pedidos para llevar'
    ]);
  });

  test('manda la seccion entera en el orden nuevo', async ({ page }) => {
    const filas = await abrirContenido(page);

    await filas.nth(2).dragTo(filas.nth(0));

    expect(page.ordenes).toEqual([[
      'enlace-43', 'enlace-41', 'enlace-42', 'elemento-44', 'elemento-45'
    ]]);
  });

  // Los tres eventos uno detras de otro, sin pausas: es lo mas parecido a
  // «en el mismo tic» que puede hacer un navegador. Reordena igual.
  test('tambien con los tres eventos seguidos', async ({ page }) => {
    const filas = await abrirContenido(page);

    const origen = await filas.nth(4).boundingBox();
    const destino = await filas.nth(0).boundingBox();

    await page.mouse.move(origen.x + 20, origen.y + 10);
    await page.mouse.down();
    await page.mouse.move(destino.x + 20, destino.y + 10);
    await page.mouse.up();

    expect(page.ordenes).toEqual([[
      'elemento-45', 'enlace-41', 'enlace-42', 'enlace-43', 'elemento-44'
    ]]);
  });

  test('mover el primero al ultimo puesto', async ({ page }) => {
    const filas = await abrirContenido(page);

    await filas.nth(0).dragTo(filas.nth(4));

    expect(await titulos(filas)).toEqual([
      'Cómo llegar',
      'Síguenos en Instagram',
      'Horneamos cada mañana',
      'Pedidos para llevar',
      'Escríbenos por WhatsApp'
    ]);
  });

  // Un bloque desactivado se sigue pudiendo mover: su orden importa para
  // cuando se vuelva a activar.
  test('un bloque desactivado tambien se arrastra', async ({ page }) => {
    const filas = await abrirContenido(page);

    await expect(filas.nth(4)).toHaveClass(/bloque--apagado/);

    await filas.nth(4).dragTo(filas.nth(1));

    expect((await titulos(filas))[1]).toBe('Pedidos para llevar');
  });

  test('soltar donde se cogio no manda nada', async ({ page }) => {
    const filas = await abrirContenido(page);

    await filas.nth(1).dragTo(filas.nth(1));

    expect(page.ordenes).toEqual([]);
    expect(await titulos(filas)).toEqual(EN_ORDEN);
  });

  // La seccion que no se esta viendo no se toca. Si se mandaran todos los
  // bloques, el de Promociones acabaria con un orden que nadie pidio.
  test('solo manda los bloques de la seccion que se esta viendo', async ({ page }) => {
    const filas = await abrirContenido(page);

    await page.getByRole('button', { name: /Promociones/ }).click();

    await expect(filas).toHaveCount(1);

    await page.getByRole('button', { name: /Menú principal/ }).click();
    await expect(filas).toHaveCount(EN_ORDEN.length);

    await filas.nth(1).dragTo(filas.nth(0));

    expect(page.ordenes[0]).not.toContain('enlace-46');
    expect(page.ordenes[0]).toHaveLength(EN_ORDEN.length);
  });
});

test.describe('cuando el servidor no acepta el orden', () => {
  test('lo dice y deja la lista como estaba', async ({ page }) => {
    const filas = await abrirContenido(page, {
      errorAlOrdenar: 'Otro dispositivo cambió este contenido'
    });

    await filas.nth(2).dragTo(filas.nth(0));

    await expect(page.getByRole('alert')).toHaveText('Otro dispositivo cambió este contenido');
    expect(await titulos(filas)).toEqual(EN_ORDEN);
  });

  // Mientras el servidor contesta, la lista queda bloqueada: arrastrar otra
  // vez mandaria un segundo orden calculado sobre el anterior.
  test('mientras guarda no se puede arrastrar', async ({ page }) => {
    const filas = await abrirContenido(page);

    // Un manejador propio, registrado despues del de ayudas.js, que es el
    // que gana: retiene la respuesta para poder mirar la pantalla a medias.
    let soltar;
    const detenido = new Promise((resolver) => { soltar = resolver; });

    await page.route('**/api/contenido/orden', async (ruta) => {
      await detenido;
      await ruta.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"ok"}' });
    });

    await filas.nth(2).dragTo(filas.nth(0));

    await expect(filas.first()).toHaveAttribute('draggable', 'false');
    await expect(page.getByRole('button', { name: 'Agregar bloque' })).toBeDisabled();

    soltar();

    await expect(filas.first()).toHaveAttribute('draggable', 'true');
  });
});

// Las flechas existen porque el arrastre de HTML no funciona con el dedo. Que
// hagan la misma cuenta lo comprueba Vitest; que el navegador las deje usar
// con el raton y con el teclado, esto.
test.describe('las flechas', () => {
  test('suben un bloque un puesto', async ({ page }) => {
    const filas = await abrirContenido(page);

    await page.getByLabel('Subir Síguenos en Instagram').click();

    expect((await titulos(filas)).slice(0, 3)).toEqual([
      'Escríbenos por WhatsApp',
      'Síguenos en Instagram',
      'Cómo llegar'
    ]);
  });

  test('se alcanzan con el tabulador y responden a Enter', async ({ page }) => {
    const filas = await abrirContenido(page);

    const bajar = page.getByLabel('Bajar Escríbenos por WhatsApp');

    await bajar.focus();
    await expect(bajar).toBeFocused();
    await page.keyboard.press('Enter');

    expect((await titulos(filas)).slice(0, 2)).toEqual([
      'Cómo llegar',
      'Escríbenos por WhatsApp'
    ]);
  });

  test('la del primero y la del ultimo estan apagadas', async ({ page }) => {
    await abrirContenido(page);

    await expect(page.getByLabel('Subir Escríbenos por WhatsApp')).toBeDisabled();
    await expect(page.getByLabel('Bajar Pedidos para llevar')).toBeDisabled();
  });
});
