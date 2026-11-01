// ============================================
// TITULOS.SPEC.JS — el titulo de la pestana en cada pantalla
//
// REGRESION. Bajo React hay un solo index.html, asi que las trece pantallas
// compartian su <title> y la pestana decia «QR Empresarial — perfil público»
// tambien en el login, en el panel y en la gestion de usuarios. El frontend
// original tenia doce titulos distintos, uno por archivo.
//
// Por que no en jsdom: lo que pone el titulo es un efecto, y en jsdom se
// puede comprobar por pantalla, montandola sola. Lo que no se puede es
// comprobar lo que de verdad falla aqui —que al NAVEGAR de una pantalla a
// otra el titulo cambie, y que al recargar o abrir un enlace directo la
// pantalla ponga el suyo y no el del HTML estatico-. Eso necesita un
// navegador con historial y recarga de verdad.
// ============================================

import { expect, test } from '@playwright/test';

import { esperarPanel, prepararSesion, simularApi, PERFIL } from './ayudas.js';

const MARCA = 'QR Empresarial';

// Las del panel llevan el mismo nombre que su enlace en la barra: la pestana
// y el menu no deberian llamar a la misma pantalla de dos maneras.
const DEL_PANEL = [
  { ruta: '/', titulo: 'Perfil público' },
  { ruta: '/perfil', titulo: 'Mi negocio' },
  { ruta: '/contenido', titulo: 'Contenido' },
  { ruta: '/codigo-qr', titulo: 'Código QR' },
  { ruta: '/actividad', titulo: 'Actividad' },
  { ruta: '/configuracion', titulo: 'Configuración' }
];

const SIN_SESION = [
  { ruta: '/login', titulo: 'Iniciar sesión' },
  { ruta: '/registro', titulo: 'Crear cuenta' },
  { ruta: '/recuperar', titulo: 'Recuperar contraseña' },
  { ruta: '/restablecer', titulo: 'Nueva contraseña' }
];

test.describe('cada pantalla dice cual es', () => {
  for (const { ruta, titulo } of SIN_SESION) {
    test(`${ruta} → ${titulo}`, async ({ page }) => {
      await simularApi(page);
      await page.goto(ruta);

      await expect(page).toHaveTitle(`${titulo} · ${MARCA}`);
    });
  }

  for (const { ruta, titulo } of DEL_PANEL) {
    test(`${ruta} → ${titulo}`, async ({ page }) => {
      await prepararSesion(page);
      await page.goto(ruta);
      await esperarPanel(page);

      await expect(page).toHaveTitle(`${titulo} · ${MARCA}`);
    });
  }

  test('/usuarios → Usuarios', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/usuarios');

    await expect(page).toHaveTitle(`Usuarios · ${MARCA}`);
  });

  test('/administracion → Administración', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/administracion');

    await expect(page).toHaveTitle(`Administración · ${MARCA}`);
  });

  // Una direccion que no existe tampoco debe decir que es el perfil publico.
  test('una direccion inventada → Página no encontrada', async ({ page }) => {
    await simularApi(page);
    await page.goto('/esto-no-existe');

    await expect(page).toHaveTitle(`Página no encontrada · ${MARCA}`);
  });

  // Se llega aqui con sesion de empresa a una pantalla de administrador.
  test('/usuarios sin ser administrador → Acceso denegado', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/usuarios');

    await expect(page).toHaveTitle(`Acceso denegado · ${MARCA}`);
  });
});

test.describe('al navegar', () => {
  // Es lo que no se puede comprobar en jsdom: que el titulo siga a la
  // pantalla. Un efecto que se pusiera solo al montar la aplicacion dejaria
  // el primer titulo puesto para siempre.
  test('el titulo cambia al pasar de una pantalla a otra', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await expect(page).toHaveTitle(`Contenido · ${MARCA}`);

    await page.getByRole('navigation').getByRole('link', { name: 'Código QR' }).click();
    await expect(page).toHaveTitle(`Código QR · ${MARCA}`);

    await page.getByRole('navigation').getByRole('link', { name: 'Mi negocio' }).click();
    await expect(page).toHaveTitle(`Mi negocio · ${MARCA}`);
  });

  test('y al volver atras tambien', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');
    await esperarPanel(page);

    await page.getByRole('navigation').getByRole('link', { name: 'Actividad' }).click();
    await expect(page).toHaveTitle(`Actividad · ${MARCA}`);

    await page.goBack();

    await expect(page).toHaveTitle(`Contenido · ${MARCA}`);
  });
});

test.describe('la pagina del codigo QR', () => {
  // Aqui el titulo es el nombre del negocio, no el de una pantalla: es la
  // pagina de ese negocio. El servidor ya lo escribe en el HTML para los
  // robots que no ejecutan JavaScript, y la pantalla pone el mismo.
  test('se titula con el nombre del negocio', async ({ page }) => {
    await simularApi(page);
    await page.goto(`/p/${PERFIL.slug}`);

    await expect(page.getByRole('heading', { name: PERFIL.nombreNegocio })).toBeVisible();
    await expect(page).toHaveTitle(`${PERFIL.nombreNegocio} · ${MARCA}`);
  });

  // Estas pruebas corren contra vite preview, que entrega el index.html tal
  // cual: no hay servidor que inyecte nada. Lo que se comprueba es que la
  // pantalla no lo deje en el titulo generico cuando el negocio no existe.
  test('un negocio que no existe no se queda con el titulo de otro', async ({ page }) => {
    await simularApi(page, { perfilPublicoNoDisponible: true });
    await page.goto(`/p/${PERFIL.slug}`);

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveTitle(MARCA);
  });
});
