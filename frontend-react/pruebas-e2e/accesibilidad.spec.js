// ============================================
// ACCESIBILIDAD.SPEC.JS — auditoria automatica con axe-core
//
// Es el equivalente de la auditoria que ya tenia el frontend original, y no
// se puede hacer en jsdom: casi la mitad de las reglas de axe miden contraste
// de color, tamaños y orden visual, y para eso hace falta un motor de
// maquetado. En jsdom esas reglas no se evaluan o devuelven «incompleto», con
// lo que la auditoria pasaria sin haber mirado lo que importa.
//
// Lo que esto comprueba es lo que una maquina puede comprobar: etiquetas,
// nombres accesibles, contraste, estructura. No sustituye a usar la pantalla
// con el teclado ni a un lector de pantalla.
// ============================================

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { prepararSesion, simularApi } from './ayudas.js';

const REGLAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Audita la pantalla que este cargada y devuelve las faltas. */
async function auditar(page) {
  const resultado = await new AxeBuilder({ page }).withTags(REGLAS).analyze();

  return resultado.violations.map((falta) => ({
    regla: falta.id,
    impacto: falta.impact,
    donde: falta.nodes.map((n) => n.target.join(' ')).slice(0, 3)
  }));
}

// Las pantallas con sesion de empresa. Cada una se audita ya cargada: una
// auditoria sobre el «Cargando…» no mira la pantalla.
const CON_SESION = [
  { ruta: '/', listo: (page) => page.getByLabel('Dirección pública del negocio') },
  { ruta: '/perfil', listo: (page) => page.getByRole('heading', { name: 'Perfil del negocio' }) },
  { ruta: '/contenido', listo: (page) => page.getByRole('heading', { name: 'Contenido del perfil' }) },
  { ruta: '/codigo-qr', listo: (page) => page.getByRole('heading', { name: 'Tu código QR' }) },
  { ruta: '/actividad', listo: (page) => page.getByRole('heading', { name: 'Actividad' }) },
  { ruta: '/configuracion', listo: (page) => page.getByRole('heading', { name: 'Tu cuenta' }) }
];

const DE_ADMINISTRADOR = [
  { ruta: '/usuarios', listo: (page) => page.getByRole('heading', { name: 'Gestión de usuarios' }) },
  { ruta: '/administracion', listo: (page) => page.getByRole('heading', { name: 'Administración' }) }
];

const SIN_SESION = [
  { ruta: '/login', listo: (page) => page.getByRole('heading', { name: 'Iniciar sesión' }) },
  { ruta: '/registro', listo: (page) => page.getByRole('heading', { name: 'Crear una cuenta' }) },
  { ruta: '/recuperar', listo: (page) => page.getByRole('heading', { name: /contraseña/i }) },
  { ruta: '/p/panaderia-la-espiga', listo: (page) => page.getByRole('heading', { name: 'Panadería La Espiga' }) },
  { ruta: '/esto-no-existe', listo: (page) => page.getByRole('heading', { name: 'Esta página no existe' }) }
];

for (const { ruta, listo } of CON_SESION) {
  test(`${ruta} no tiene faltas de accesibilidad`, async ({ page }) => {
    await prepararSesion(page);
    await page.goto(ruta);
    await expect(listo(page)).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });
}

for (const { ruta, listo } of DE_ADMINISTRADOR) {
  test(`${ruta} no tiene faltas de accesibilidad`, async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto(ruta);
    await expect(listo(page)).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });
}

for (const { ruta, listo } of SIN_SESION) {
  test(`${ruta} no tiene faltas de accesibilidad`, async ({ page }) => {
    await simularApi(page);
    await page.goto(ruta);
    await expect(listo(page)).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });
}

// Los estados que no se ven al cargar y tambien hay que leer: un formulario
// abierto, un mensaje de error, un dialogo.
test.describe('estados que aparecen despues', () => {
  test('el formulario de un bloque nuevo', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');

    await page.getByRole('button', { name: 'Agregar bloque' }).click();
    await expect(page.getByLabel('Título')).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });

  test('un mensaje de error en el login', async ({ page }) => {
    await simularApi(page, { credencialesMalas: 'Correo o contraseña incorrectos' });
    await page.goto('/login');

    await page.getByLabel('Correo electrónico').fill('contacto@laespiga.co');
    await page.getByLabel('Contraseña').fill('mal');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });

  // Va en un <dialog> de verdad para que el navegador se encargue del foco y
  // de Escape. En jsdom hay que ponerle un showModal de pega, asi que lo que
  // haga el dialogo real solo se ve aqui.
  test('el detalle de una cuenta, en su dialogo', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/administracion');

    await page.getByRole('button', { name: 'Ver' }).first().click();

    await expect(page.locator('dialog')).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });

  test('y Escape lo cierra', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/administracion');

    await page.getByRole('button', { name: 'Ver' }).first().click();
    await expect(page.locator('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('dialog')).toBeHidden();
  });
});

// Recorrer la pantalla con el tabulador: el orden tiene que seguir lo que se
// ve, y el foco tiene que verse. jsdom tiene foco, pero no sabe donde esta
// cada cosa ni si el contorno se dibuja.
test.describe('el teclado', () => {
  test('el tabulador recorre el formulario de login en orden', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Correo electrónico')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Contraseña')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeFocused();
  });

  test('lo que tiene el foco se distingue', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');

    const campo = page.getByLabel('Correo electrónico');

    await campo.focus();

    const contorno = await campo.evaluate((el) => {
      const estilo = getComputedStyle(el);

      return {
        outline: estilo.outlineStyle,
        ancho: estilo.outlineWidth,
        sombra: estilo.boxShadow,
        borde: estilo.borderColor
      };
    });

    // Vale cualquiera de las tres formas de marcarlo; lo que no vale es
    // ninguna, que es lo que pasa cuando alguien pone outline: none.
    const seDistingue = (contorno.outline !== 'none' && contorno.ancho !== '0px')
      || contorno.sombra !== 'none';

    expect(seDistingue).toBe(true);
  });
});
