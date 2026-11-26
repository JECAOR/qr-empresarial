// ============================================
// SESION.SPEC.JS — lo que pasa cuando la sesion se termina sola
//
// Esta es la septima vara de medir del frontend, y encontro un defecto que
// las seis anteriores no podian ver: TODAS mantuvieron la sesion constante.
// La de red cortada hace fallar la CONEXION -un TypeError-, no la SESION. La
// de textos y estados de error miro los errores de la aplicacion y nunca
// mato el token.
//
// Y es trivial de alcanzar: JWT_EXPIRES_IN vale 2 h por defecto, asi que le
// pasa a cualquiera que deje una pestana abierta. Tambien al cambiar la
// contrasena desde otro dispositivo, al cerrar sesion en otra pestana, o si
// un administrador restringe la cuenta.
//
// OJO CON EL METODO. page.goto() recarga la pagina entera, y eso remonta
// AuthContext, cuyo primer efecto SI detectaba el token muerto. La primera
// version de esta investigacion uso goto y concluyo que todo funcionaba:
// era falso. Para ver lo que le pasa a quien ESTA USANDO la aplicacion hay
// que navegar pulsando los enlaces de la barra, que es navegacion de React
// Router sin recarga. Estas pruebas lo hacen asi a proposito.
// ============================================

import { expect, test } from '@playwright/test';

import { USUARIO, esperarPanel, prepararSesion } from './ayudas.js';

/**
 * Mata la sesion: desde ahora el servidor contesta como el middleware real,
 * con el codigo que distingue un 401 de sesion de uno de contrasena.
 */
async function matarLaSesion(page, mensaje = 'Token inválido o vencido') {
  await page.unroute('**/api/**');

  await page.route('**/api/**', (ruta) => ruta.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: mensaje, codigo: 'sesion' })
  }));
}

/** Una sesion abierta, en la portada del panel. */
async function enElPanel(page) {
  await prepararSesion(page);
  await page.goto('/');
  await esperarPanel(page);
}

const barra = (page) => page.getByRole('navigation');

test.describe('cuando la sesion se muere a mitad de uso', () => {
  test('navegar por la barra lleva al login, no a una pantalla muerta', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    await barra(page).getByRole('link', { name: 'Configuración' }).click();

    await expect(page).toHaveURL(/\/login$/);
  });

  // El unico aviso era el mensaje del servidor en crudo, "Token invalido o
  // vencido", suelto en la pantalla. No dice que paso ni que hacer.
  test('y se explica que paso, sin tecnicismos', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    await barra(page).getByRole('link', { name: 'Actividad' }).click();

    const aviso = page.getByRole('status');

    await expect(aviso).toContainText(/Tu sesión terminó/);
    await expect(aviso).not.toContainText(/Token/);
  });

  // Quien llevaba un rato escribiendo tiene derecho a saberlo. Lo contrario
  // es dejarle creer que se guardo.
  test('y que lo que estaba escrito no se guardo', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    await barra(page).getByRole('link', { name: 'Mi negocio' }).click();

    await expect(page.getByRole('status')).toContainText(/no se guardó/);
  });

  test('la barra deja de decir que hay sesion', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    await barra(page).getByRole('link', { name: 'Contenido' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await expect(page.locator('.barra__quien')).toHaveCount(0);
    await expect(page.getByText(USUARIO.nombre)).toHaveCount(0);
  });

  test('y el token no se queda guardado', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    await barra(page).getByRole('link', { name: 'Contenido' }).click();
    await expect(page).toHaveURL(/\/login$/);

    expect(await page.evaluate(() => sessionStorage.getItem('qre_token'))).toBeNull();
  });

  // Antes el boton se quedaba activo y se podia pulsar indefinidamente: cada
  // vez salia el mismo mensaje del servidor y nada cambiaba.
  test('pulsar un boton tambien lleva al login', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/');
    await esperarPanel(page);

    await barra(page).getByRole('link', { name: 'Configuración' }).click();
    await expect(page.getByRole('button', { name: 'Guardar datos' })).toBeVisible();

    await matarLaSesion(page);

    await page.getByRole('button', { name: 'Guardar datos' }).click();

    await expect(page).toHaveURL(/\/login$/);
  });

  // Se vuelve a donde estaba: la direccion de la que lo echaron viaja con el
  // aviso, no en lugar de el.
  test('y al entrar de nuevo se vuelve a donde estaba', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    await barra(page).getByRole('link', { name: 'Actividad' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // El servidor vuelve a funcionar y entra otra vez
    await prepararSesion(page);
    await page.getByLabel('Correo electrónico').fill(USUARIO.correo);
    await page.getByLabel('Contraseña').fill('Clave-de-pruebas-1');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/actividad$/);
  });
});

test.describe('lo que las pantallas NO deben decir', () => {
  // ESTO ERA LO GRAVE, y no el mensaje crudo. Con la sesion muerta, la
  // respuesta vacia se interpretaba como que no habia nada, y cada pantalla
  // lo decia con su texto de "todavia no tienes": Contenido anunciaba que la
  // seccion no tenia bloques, Codigo QR ofrecia "Generar mi codigo" como si
  // nunca se hubiera generado, y Actividad decia que no habia nada que
  // contar. Al dueno de un negocio se le estaba diciendo que su contenido,
  // su codigo y sus estadisticas habian desaparecido.
  //
  // Son buenos textos EN SU CONTEXTO. Ante un fallo de autenticacion
  // afirmaban algo falso y alarmante.
  const pantallas = [
    ['Contenido', /todavía no tiene bloques/i],
    ['Código QR', /Todavía no has generado tu código/i],
    ['Actividad', /Todavía no hay nada que contar/i]
  ];

  for (const [nombre, textoFalso] of pantallas) {
    test(`${nombre} no dice que no hay nada [regresión]`, async ({ page }) => {
      await enElPanel(page);
      await matarLaSesion(page);

      await barra(page).getByRole('link', { name: nombre }).click();
      await expect(page).toHaveURL(/\/login$/);

      await expect(page.getByText(textoFalso)).toHaveCount(0);
    });
  }

  test('ni se ofrece generar un codigo que ya existe [regresión]', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    await barra(page).getByRole('link', { name: 'Código QR' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await expect(page.getByRole('button', { name: /Generar mi código/i })).toHaveCount(0);
  });
});

test.describe('la contrasena equivocada no es una sesion muerta', () => {
  // LA TRAMPA DEL ARREGLO. Cambiar el correo pide confirmar la contrasena, y
  // el servidor responde 401 cuando no es la que es. Si cualquier 401 cerrara
  // la sesion, equivocarse al teclear echaria a la persona de la aplicacion y
  // le haria perder lo que estuviera escribiendo: un defecto peor que el
  // arreglado. Por eso el backend manda un codigo y aqui se distingue.
  test('se queda en la pantalla y se puede reintentar', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/configuracion');
    await expect(page.getByRole('button', { name: 'Guardar datos' })).toBeVisible();

    // Solo esta peticion falla, y sin el codigo de sesion
    await page.route('**/api/usuarios/me', (ruta) => {
      if (ruta.request().method() !== 'PUT') return ruta.fallback();

      return ruta.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'La contraseña no es correcta' })
      });
    });

    await page.getByLabel('Correo electrónico').fill('otro@ejemplo.co');

    // El campo de confirmacion aparece solo al cambiar el correo: pedir la
    // contrasena para cambiar el nombre seria pedirla por nada. Se localiza
    // por su id porque la etiqueta "Tu contraseña" la llevan dos campos de
    // esta pantalla: este y el que confirma la baja de la cuenta.
    await page.locator('#contrasenaDatos').fill('LaQueNoEs1*');
    await page.getByRole('button', { name: 'Guardar datos' }).click();

    await expect(page).toHaveURL(/\/configuracion$/);
    await expect(page.getByText(/La contraseña no es correcta/)).toBeVisible();
  });

  test('y la sesion sigue abierta', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/configuracion');
    await expect(page.getByRole('button', { name: 'Guardar datos' })).toBeVisible();

    await page.route('**/api/usuarios/me', (ruta) => {
      if (ruta.request().method() !== 'PUT') return ruta.fallback();

      return ruta.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'La contraseña no es correcta' })
      });
    });

    await page.getByLabel('Correo electrónico').fill('otro@ejemplo.co');

    // El campo de confirmacion aparece solo al cambiar el correo: pedir la
    // contrasena para cambiar el nombre seria pedirla por nada. Se localiza
    // por su id porque la etiqueta "Tu contraseña" la llevan dos campos de
    // esta pantalla: este y el que confirma la baja de la cuenta.
    await page.locator('#contrasenaDatos').fill('LaQueNoEs1*');
    await page.getByRole('button', { name: 'Guardar datos' }).click();

    await expect(page.getByText(/La contraseña no es correcta/)).toBeVisible();

    expect(await page.evaluate(() => sessionStorage.getItem('qre_token'))).not.toBeNull();
    await expect(page.locator('.barra__quien')).toContainText(USUARIO.nombre);
  });
});

test.describe('salir a proposito no es lo mismo', () => {
  // Quien pulsa Salir sabe por que esta en el login: explicarselo seria
  // ruido, y ademas sugeriria que algo fallo.
  test('no se explica nada en el login', async ({ page }) => {
    await enElPanel(page);

    await page.getByRole('button', { name: 'Salir' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/Tu sesión terminó/)).toHaveCount(0);
  });

  // El motivo del cierre se guarda en AuthContext, y sin limpiarlo al entrar
  // se quedaria ahi: la siguiente vez que esta persona saliera a proposito,
  // el login le diria que su sesion termino sola. Seria mentira, y de las
  // que hacen dudar de si algo se guardo.
  test('aunque antes se hubiera muerto una sesion', async ({ page }) => {
    await enElPanel(page);
    await matarLaSesion(page);

    // Se muere, lo echan al login y el aviso aparece: hasta aqui, bien
    await barra(page).getByRole('link', { name: 'Contenido' }).click();
    await expect(page.getByRole('status')).toContainText(/Tu sesión terminó/);

    // Entra de nuevo
    await prepararSesion(page);
    await page.getByLabel('Correo electrónico').fill(USUARIO.correo);
    await page.getByLabel('Contraseña').fill('Clave-de-pruebas-1');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await esperarPanel(page);

    // Y ahora sale por su propia voluntad
    await page.getByRole('button', { name: 'Salir' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/Tu sesión terminó/)).toHaveCount(0);
  });
});
