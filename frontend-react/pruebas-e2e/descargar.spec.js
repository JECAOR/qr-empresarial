// ============================================
// DESCARGAR.SPEC.JS — el codigo QR: archivos, vista previa y portapapeles
//
// Nada de esto existe en jsdom. La descarga del RF-08 no se puede hacer con
// un <a href> normal -la ruta exige el token y una etiqueta de enlace no
// manda cabeceras-, asi que la pantalla se trae el archivo como blob y crea
// un enlace con URL.createObjectURL. En jsdom hay que poner un
// createObjectURL de pega, y lo que se comprueba alli es que la pantalla
// llamo a su servicio: nunca se guarda un archivo, nadie mira sus bytes, y
// un cambio que rompiera la descarga de verdad pasaria desapercibido.
//
// Aqui el navegador descarga, se abre el archivo y se miran sus primeros
// bytes. El portapapeles y la vista previa en blob: son igual de inservibles
// en jsdom.
// ============================================

import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { ADMINISTRADOR, prepararSesion } from './ayudas.js';

/** Abre la pantalla del codigo con uno ya generado. */
async function abrirQr(page, opciones = {}) {
  await prepararSesion(page, opciones);
  await page.goto('/codigo-qr');

  await expect(page.getByRole('heading', { name: 'Tu código QR' })).toBeVisible();
}

/** Los primeros bytes del archivo que guardo el navegador. */
async function primerosBytes(descarga, cuantos = 8) {
  const ruta = await descarga.path();

  return (await readFile(ruta)).subarray(0, cuantos);
}

test.describe('descargar el codigo', () => {
  // Las firmas son las de verdad: un PNG empieza por \x89PNG, un PDF por
  // %PDF. Comprobar solo el nombre del archivo dejaria pasar una descarga
  // que guardara el JSON de un error con extension .png.
  const FORMATOS = [
    { boton: 'PNG', extension: 'png', firma: Buffer.from([0x89, 0x50, 0x4E, 0x47]) },
    { boton: 'SVG', extension: 'svg', firma: Buffer.from('<svg') },
    { boton: 'PDF', extension: 'pdf', firma: Buffer.from('%PDF') }
  ];

  for (const formato of FORMATOS) {
    test(`en ${formato.boton}, con el nombre que manda el servidor`, async ({ page }) => {
      await abrirQr(page);

      const esperando = page.waitForEvent('download');

      await page.getByRole('button', { name: formato.boton }).click();

      const descarga = await esperando;

      // El nombre sale de Content-Disposition, que el servidor expone a
      // proposito con Access-Control-Expose-Headers. Sin eso el archivo se
      // guardaria como «codigo-qr» a secas.
      expect(descarga.suggestedFilename())
        .toBe(`codigo-qr-panaderia-la-espiga.${formato.extension}`);

      const bytes = await primerosBytes(descarga, formato.firma.length);

      expect(bytes.equals(formato.firma)).toBe(true);
    });
  }

  test('y lo avisa en pantalla', async ({ page }) => {
    await abrirQr(page);

    const esperando = page.waitForEvent('download');

    await page.getByRole('button', { name: 'PNG' }).click();
    await esperando;

    await expect(page.getByRole('status'))
      .toHaveText('Descargado codigo-qr-panaderia-la-espiga.png');
  });

  test('si el servidor falla, lo dice y no descarga nada', async ({ page }) => {
    await abrirQr(page, { errorAlDescargar: 'No se pudo generar la imagen' });

    let descargas = 0;

    page.on('download', () => { descargas += 1; });

    await page.getByRole('button', { name: 'PNG' }).click();

    await expect(page.getByRole('alert')).toHaveText('No se pudo generar la imagen');
    expect(descargas).toBe(0);
  });
});

test.describe('la vista previa', () => {
  // Se pide al servidor en lugar de dibujarla en el navegador para que lo
  // que se ve sea exactamente el archivo que se descarga. Llega como blob y
  // se enseña con una URL de objeto: en jsdom esa URL es una cadena de pega
  // y la imagen nunca se carga.
  test('se enseña con una URL de objeto y la imagen carga', async ({ page }) => {
    await abrirQr(page);

    const imagen = page.getByAltText('Vista previa del código QR');

    await expect(imagen).toBeVisible();
    await expect(imagen).toHaveAttribute('src', /^blob:/);

    // naturalWidth > 0 significa que el navegador decodifico la imagen. Con
    // un blob invalido la etiqueta estaria ahi y esto seria 0.
    expect(await imagen.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  });

  // Se espera a que el deslizador deje de moverse antes de pedir otra: sin
  // la espera habria una peticion por cada paso del recorrido.
  test('se vuelve a pedir una sola vez al mover el tamaño', async ({ page }) => {
    await abrirQr(page);

    await expect(page.getByAltText('Vista previa del código QR')).toBeVisible();

    const pedidas = [];

    page.on('request', (peticion) => {
      if (peticion.url().includes('/qr/imagen')) pedidas.push(peticion.url());
    });

    const deslizador = page.getByLabel('Tamaño');

    // Cuatro pasos seguidos con el teclado, mas rapido que los 250 ms de
    // espera: tienen que acabar en una sola peticion, la del valor final.
    await deslizador.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await expect(page.locator('figcaption')).toHaveText('480 × 480 px');
    await expect.poll(() => pedidas.length).toBe(1);

    expect(pedidas[0]).toContain('tamano=480');
  });

  test('cambiar el color pide la vista previa con ese color', async ({ page }) => {
    await abrirQr(page);

    await expect(page.getByAltText('Vista previa del código QR')).toBeVisible();

    const pedidas = [];

    page.on('request', (peticion) => {
      if (peticion.url().includes('/qr/imagen')) pedidas.push(peticion.url());
    });

    await page.getByLabel('Esmeralda').click();

    await expect.poll(() => pedidas.length).toBe(1);

    // Sin la almohadilla: la manda qrService, que la quita porque en una
    // cadena de consulta tendria que ir escapada y el servidor la espera
    // limpia.
    expect(pedidas[0]).toContain('color=0B7D73');
  });
});

test.describe('la direccion publica', () => {
  // La API devuelve la ruta relativa; el origen lo pone el frontend con
  // VITE_API_URL, que Vite incrusta al compilar. Esto comprueba el paquete
  // compilado, no una variable de entorno de las pruebas.
  test('se enseña completa, no como ruta relativa', async ({ page }) => {
    await abrirQr(page);

    await expect(page.locator('.qr__direccion'))
      .toHaveText('http://localhost:4174/p/panaderia-la-espiga');
  });

  test('se copia al portapapeles', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await abrirQr(page);

    await page.getByRole('button', { name: 'Copiar enlace' }).click();

    await expect(page.getByRole('status')).toHaveText('Enlace copiado');

    const copiado = await page.evaluate(() => navigator.clipboard.readText());

    expect(copiado).toBe('http://localhost:4174/p/panaderia-la-espiga');
  });

  test('el enlace «Abrirla» lleva a la pagina del codigo', async ({ page }) => {
    await abrirQr(page);

    await expect(page.getByRole('link', { name: 'Abrirla' }))
      .toHaveAttribute('href', 'http://localhost:4174/p/panaderia-la-espiga');
  });
});

// El reporte de la administracion baja por el mismo camino -descargar() del
// apiClient- pero con otro tipo de archivo. Si el nombre dejara de leerse de
// la cabecera, aqui se veria igual.
test('la administracion descarga el reporte de usuarios', async ({ page }) => {
  await prepararSesion(page, { comoAdministrador: true });
  await page.goto('/administracion');

  await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();

  const esperando = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Descargar reporte' }).click();

  const descarga = await esperando;

  expect(descarga.suggestedFilename()).toBe('usuarios-2026-10-31.csv');

  const contenido = (await readFile(await descarga.path())).toString('utf8');

  // Las celdas van entre comillas porque el nombre de un negocio puede
  // llevar una coma, y con ella sola la fila se partiria.
  expect(contenido.split('\n')[0]).toContain('"escaneos","visitas","clics"');
  expect(contenido).toContain(`"${ADMINISTRADOR.correo}"`);
});

test.describe('cuando todavia no hay codigo', () => {
  test('ofrece generarlo y no enseña opciones de descarga', async ({ page }) => {
    await abrirQr(page, { sinQr: true });

    await expect(page.getByRole('button', { name: 'Generar mi código' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PNG' })).toBeHidden();
  });

  test('generarlo deja la pantalla lista para descargar', async ({ page }) => {
    await abrirQr(page, { sinQr: true });

    await page.getByRole('button', { name: 'Generar mi código' }).click();

    await expect(page.getByRole('status')).toHaveText('Código generado');
    await expect(page.getByRole('button', { name: 'PNG' })).toBeVisible();
    await expect(page.getByAltText('Vista previa del código QR')).toBeVisible();
  });
});
