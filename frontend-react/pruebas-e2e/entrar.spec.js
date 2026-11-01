// ============================================
// ENTRAR.SPEC.JS — a donde se llega despues de entrar
//
// Esto es lo que trajo estas pruebas al proyecto. En jsdom, la prueba de
// «vuelve a la pantalla de la que me echaron» FALLABA, y no por un defecto:
// LoginPage tiene dos caminos de salida que compiten.
//
//   1. navegar(ubicacion.state.desde) justo despues del await
//   2. <Navigate to={destino(usuario)}> que se dibuja porque ya hay sesion
//
// Los dos ocurren en el mismo tic. En un navegador React los agrupa, dibuja
// una sola vez con la sesion Y la direccion nueva, y LoginPage ya no esta
// montado cuando le tocaria devolver su <Navigate>: gana el 1. En jsdom,
// act() vacia la cola de React entre el await y la navegacion, con lo que el
// 2 se dibuja primero y gana. El resultado de la prueba dependia del entorno,
// no del codigo.
//
// La prueba de Vitest se dejo a proposito mirando otra cosa -espia
// useNavigate y comprueba a donde MANDA-, que es lo unico que jsdom puede
// contestar con sentido. A donde se LLEGA se comprueba aqui.
// ============================================

import { expect, test } from '@playwright/test';

import {
  ADMINISTRADOR, USUARIO, entrarPorElFormulario, esperarPanel, sembrarSesion, simularApi
} from './ayudas.js';

test.describe('la direccion a la que se llega', () => {
  test('una cuenta de empresa aterriza en la portada', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');
    await entrarPorElFormulario(page);

    await expect(page).toHaveURL('/');
    await esperarPanel(page);
  });

  // Mandar a todo el mundo a /usuarios hacia que una empresa entrara bien y
  // aterrizara en «Acceso denegado», que parece un error del sistema.
  test('un administrador aterriza en la gestion de usuarios', async ({ page }) => {
    await simularApi(page, { comoAdministrador: true });
    await page.goto('/login');
    await entrarPorElFormulario(page, { correo: ADMINISTRADOR.correo });

    await expect(page).toHaveURL('/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
  });

  // LA PRUEBA DEL ENCABEZADO. Se escribe la direccion de una pantalla
  // privada sin sesion, la guardia manda al login recordando de donde se
  // venia, y al entrar hay que volver ALLI y no a la portada.
  test('quien fue echado de una pantalla privada vuelve a ella', async ({ page }) => {
    await simularApi(page);
    await page.goto('/contenido');

    await expect(page).toHaveURL('/login');

    await entrarPorElFormulario(page);

    await expect(page).toHaveURL('/contenido');
    await expect(page.getByRole('heading', { name: 'Contenido del perfil' })).toBeVisible();
  });

  // La misma cosa en otra pantalla, porque la direccion la pone la guardia a
  // partir de ubicacion.pathname: si se hubiera quedado escrita a mano, esta
  // fallaria.
  test('y tambien si la pantalla era la del codigo QR', async ({ page }) => {
    await simularApi(page);
    await page.goto('/codigo-qr');
    await expect(page).toHaveURL('/login');

    await entrarPorElFormulario(page);

    await expect(page).toHaveURL('/codigo-qr');
    await expect(page.getByRole('heading', { name: 'Tu código QR' })).toBeVisible();
  });

  // Un administrador echado de /usuarios tambien vuelve alli, que es donde
  // iba, y no a /usuarios «porque es administrador»: son la misma direccion
  // por casualidad, asi que se prueba con /configuracion.
  test('un administrador echado de Configuracion vuelve a Configuracion', async ({ page }) => {
    await simularApi(page, { comoAdministrador: true });
    await page.goto('/configuracion');
    await expect(page).toHaveURL('/login');

    await entrarPorElFormulario(page, { correo: ADMINISTRADOR.correo });

    await expect(page).toHaveURL('/configuracion');
  });
});

test.describe('el historial del navegador', () => {
  // La navegacion al entrar se hace con replace a proposito. Sin eso, el
  // boton Atras devolveria a la pantalla de login de alguien que ya tiene
  // sesion: no se rompe nada, pero es un sitio donde no hay nada que hacer.
  test('atras no devuelve al formulario de login', async ({ page }) => {
    await simularApi(page);
    await page.goto('/');

    await page.getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL('/login');

    await entrarPorElFormulario(page);
    await expect(page).toHaveURL('/');
    await esperarPanel(page);

    await page.goBack();

    await expect(page).not.toHaveURL(/\/login/);
  });

  // Navegar por la barra si deja rastro: volver atras es lo que espera
  // cualquiera, y una aplicacion de una sola pagina lo pierde si usa replace
  // en todas partes.
  test('atras deshace la navegacion por la barra', async ({ page }) => {
    await simularApi(page);
    await sembrarSesion(page);
    await page.goto('/');

    await page.getByRole('navigation').getByRole('link', { name: 'Contenido' }).click();
    await expect(page).toHaveURL('/contenido');

    await page.getByRole('navigation').getByRole('link', { name: 'Código QR' }).click();
    await expect(page).toHaveURL('/codigo-qr');

    await page.goBack();
    await expect(page).toHaveURL('/contenido');

    await page.goForward();
    await expect(page).toHaveURL('/codigo-qr');
  });

  // Cerrar sesion borra el token. Pulsar Atras puede devolver la direccion
  // de la pantalla privada, pero no su contenido: la guardia vuelve a echar.
  test('despues de salir, atras no devuelve la pantalla privada', async ({ page }) => {
    await simularApi(page);
    await sembrarSesion(page);
    await page.goto('/contenido');

    await expect(page.getByRole('heading', { name: 'Contenido del perfil' })).toBeVisible();

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL('/login');

    await page.goBack();

    await expect(page.getByRole('heading', { name: 'Contenido del perfil' })).toBeHidden();
  });
});

test.describe('lo que no deja pasar', () => {
  test('con la contrasena mal se queda en el login y lo dice', async ({ page }) => {
    await simularApi(page, { credencialesMalas: 'Correo o contraseña incorrectos' });
    await page.goto('/login');

    await entrarPorElFormulario(page);

    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
    await expect(page).toHaveURL('/login');
  });

  // El formulario es un <form> de verdad, no un div con un boton: Enter
  // dentro de un campo lo envia. En jsdom se puede comprobar que el submit
  // salta; que el navegador lo dispare con Enter es cosa del navegador.
  test('Enter en el campo de la contrasena envia el formulario', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');

    await page.getByLabel('Correo electrónico').fill(USUARIO.correo);
    await page.getByLabel('Contraseña').fill('Clave-de-pruebas-1');
    await page.getByLabel('Contraseña').press('Enter');

    await expect(page).toHaveURL('/');
    await esperarPanel(page);
  });

  // El required de HTML lo valida el navegador, no React: jsdom no lo
  // aplica, asi que alli el formulario se enviaria con los campos vacios.
  test('el navegador no deja enviarlo vacio', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');

    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL('/login');
    await expect(page.getByLabel('Correo electrónico')).toBeFocused();
  });

  test('quien ya tiene sesion no se queda en el login', async ({ page }) => {
    await simularApi(page);
    await sembrarSesion(page);

    await page.goto('/login');

    await expect(page).toHaveURL('/');
    await esperarPanel(page);
  });

  // La guardia de rol. No es seguridad -el 403 lo pone Express-, es no
  // ofrecer una puerta que no lleva a ninguna parte.
  test('una empresa que escribe /usuarios recibe Acceso denegado', async ({ page }) => {
    await simularApi(page);
    await sembrarSesion(page);

    await page.goto('/usuarios');

    await expect(page).toHaveURL('/acceso-denegado');
  });

  test('la barra no le ofrece Usuarios a una empresa', async ({ page }) => {
    await simularApi(page);
    await sembrarSesion(page);
    await page.goto('/');

    const barra = page.getByRole('navigation');

    await expect(barra.getByRole('link', { name: 'Contenido' })).toBeVisible();
    await expect(barra.getByRole('link', { name: 'Usuarios' })).toBeHidden();
  });

  test('y si le ofrece al administrador', async ({ page }) => {
    await simularApi(page, { comoAdministrador: true });
    await sembrarSesion(page, ADMINISTRADOR);
    await page.goto('/');

    const barra = page.getByRole('navigation');

    await expect(barra.getByRole('link', { name: 'Usuarios' })).toBeVisible();
    await expect(barra.getByRole('link', { name: 'Administración' })).toBeVisible();
  });
});
