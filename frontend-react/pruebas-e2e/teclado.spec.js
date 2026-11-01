// ============================================
// TECLADO.SPEC.JS — los flujos largos sin ratón
//
// La auditoría de axe comprueba que cada cosa tenga nombre y contraste, y
// `accesibilidad.spec.js` que el tabulador recorra el formulario de entrar.
// Lo que no comprobaba nadie es si se puede TRABAJAR solo con el teclado:
// agregar un bloque, reordenarlo, apagarlo y borrarlo, que son varios pasos
// seguidos sobre una lista que se redibuja entera en cada uno.
//
// REGRESION. Ahí estaba el defecto, y es de los que no se ven con ratón:
// todos esos botones se apagan mientras viaja la petición —disabled— y un
// botón que se apaga teniendo el foco se lo deja al <body>, porque el
// navegador no puede dejárselo a algo deshabilitado. Después de cada acción
// había que tabular desde el principio de la página. Y las flechas son la
// ÚNICA forma de reordenar con el teclado: el arrastre de HTML no responde a
// él, que es justo por lo que existen.
//
// Por qué no en jsdom: el foco de jsdom es una simulación. No apaga nada al
// deshabilitarlo, así que allí este defecto no existe y la prueba pasaría
// sin haber mirado nada.
// ============================================

import { expect, test } from '@playwright/test';

import { esperarPanel, prepararSesion } from './ayudas.js';

/** Qué tiene el foco: su etiqueta accesible, o el aviso de que se perdió. */
const foco = (page) => page.evaluate(() => {
  const e = document.activeElement;

  if (!e || e === document.body) return '(perdido en el body)';

  return e.getAttribute('aria-label')
    || e.className
    || e.tagName.toLowerCase();
});

test.describe('reordenar con el teclado', () => {
  test('la flecha conserva el foco, para poder pulsarla otra vez', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    const bajar = page.getByRole('button', { name: 'Bajar Escríbenos por WhatsApp' });

    await bajar.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toBeVisible();

    expect(await foco(page)).toBe('Bajar Escríbenos por WhatsApp');
  });

  // Es la prueba de que sirve: mover un bloque dos puestos sin tocar nada
  // más. Antes, entre una flecha y la siguiente, había que tabular desde
  // el principio de la página.
  test('dos puestos seguidos, sin tabular entre medias', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    const primero = page.locator('.bloque').first();

    await expect(primero).toContainText('Escríbenos por WhatsApp');

    await page.getByRole('button', { name: 'Bajar Escríbenos por WhatsApp' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page.locator('.bloque').nth(2)).toContainText('Escríbenos por WhatsApp');
  });

  // Al llegar al primer puesto, su flecha de subir se apaga: el foco no
  // puede quedarse ahí, pero tampoco debe irse al body.
  test('si la flecha se apaga, el foco se queda en la lista', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await page.getByRole('button', { name: 'Subir Cómo llegar' }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toBeVisible();

    expect(await foco(page)).toContain('bloques');
  });
});

test.describe('las demas acciones de la lista', () => {
  test('apagar un bloque deja el foco en su boton', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    const boton = page.locator('[data-foco="estado-enlace-41"]');

    await boton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toBeVisible();

    // El mismo botón, que ahora dice lo contrario: se puede volver a pulsar
    await expect(boton).toBeFocused();
    await expect(boton).toHaveText('Activar');
  });

  // El botón desaparece con su bloque. A propósito no se pasa el foco al
  // Eliminar del siguiente: dejaría el dedo sobre un botón destructivo.
  test('eliminar deja el foco en la lista, no en otro Eliminar', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    page.on('dialog', (dialogo) => dialogo.accept());

    await page.locator('[data-foco="eliminar-enlace-41"]').focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toBeVisible();

    expect(await foco(page)).toContain('bloques');
  });
});

test.describe('el formulario', () => {
  test('al guardar, el foco vuelve a Agregar bloque', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await page.getByRole('button', { name: 'Agregar bloque' }).first().click();

    await page.getByLabel('Categoría').selectOption({ index: 1 });
    await page.getByLabel('Título').fill('Hecho con el teclado');
    await page.getByLabel('Destino').fill('https://ejemplo.co');

    await page.locator('.bloque-form button[type=submit]').click();
    await expect(page.getByRole('status')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Agregar bloque' })).toBeFocused();
  });

  test('y al cancelar tambien', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await page.getByRole('button', { name: 'Agregar bloque' }).first().click();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByRole('button', { name: 'Agregar bloque' })).toBeFocused();
  });

  // Se abre con Enter sobre «Editar» y se cierra guardando: el recorrido
  // entero de corregir un bloque, sin tocar el ratón.
  test('editar un bloque, de principio a fin', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await page.getByRole('button', { name: 'Editar' }).first().focus();
    await page.keyboard.press('Enter');

    const titulo = page.getByLabel('Título');

    await expect(titulo).toHaveValue('Escríbenos por WhatsApp');

    await titulo.fill('Escríbenos ya');
    await page.locator('.bloque-form button[type=submit]').click();

    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar bloque' })).toBeFocused();
  });
});
