// ============================================
// tests/qr.spec.js
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion, simularApi, sembrarSesion, QR } = require("./ayudas");

// El frontend ahora pide los datos a la API: se simula la respuesta y se deja
// una sesión guardada, para que estas pruebas sigan sin necesitar el backend
// encendido (ver ayudas.js). Va fuera de los describe para que valga en todos.
test.beforeEach(async ({ page }) => {
  await prepararSesion(page);
});


test.describe("Código QR", () => {
  test("cambiar de color repinta el canvas sin errores", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/qr.html");
    await page.click("#color-buttons button:nth-child(3)");
    await page.waitForTimeout(200);
    expect(errors).toHaveLength(0);
  });

  test("el control deslizante de tamaño tiene una etiqueta accesible", async ({ page }) => {
    await page.goto("/qr.html");
    const label = page.locator('label[for="size-slider"]');
    await expect(label).toHaveText("Tamaño");
  });

  test("cambiar el tamaño actualiza el texto mostrado", async ({ page }) => {
    await page.goto("/qr.html");
    await page.locator("#size-slider").fill("1024");
    await expect(page.locator("#size-value")).toHaveText("1024 × 1024 px");
  });

  test("descargar PNG genera un archivo con el nombre del negocio", async ({ page }) => {
    await page.goto("/qr.html");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#download-btn"),
    ]);
    expect(download.suggestedFilename()).toMatch(/^qr-.*\.png$/);
  });

  test("copiar enlace lo pone en el portapapeles", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/qr.html");
    await page.click("#copy-link-btn");
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    // Antes era el dominio inventado qr.<slug>.co; ahora la direccion real
    expect(clipboard).toBe(QR.url);
  });
});

test.describe("Personalización del QR (persistencia real)", () => {
  test("el color, tamaño y formato elegidos sobreviven a recargar la página", async ({ page }) => {
    await page.goto("/qr.html");

    await page.click("#color-buttons button:nth-child(4)"); // verde
    await page.locator("#size-slider").fill("1024");
    await page.click("#format-buttons button:nth-child(2)"); // SVG

    const guardado = await page.evaluate(() => localStorage.getItem("qre-qr-state"));
    expect(guardado).toContain('"size":1024');

    await page.reload();
    await expect(page.locator("#size-value")).toHaveText("1024 × 1024 px");
    await expect(page.locator(".qr-format-btn", { hasText: "SVG" })).toHaveClass(/active/);
    await expect(page.locator(".qr-color-dot").nth(3)).toHaveClass(/active/);
  });
});

// El código lo registra el servidor (RF-07) y las imágenes para descargar las
// genera también él (RF-08). La vista previa se sigue dibujando en el
// navegador, que es instantánea.
test.describe("Código QR contra el servidor", () => {
  test("muestra la dirección pública que asignó el servidor", async ({ page }) => {
    await page.goto("/qr.html");

    // Antes se componía en el navegador como qr.<slug>.co, un dominio que no
    // existe. Ahora es la dirección donde responderá la vista pública.
    const esperada = QR.url.replace(/^https?:\/\//, "");

    await expect(page.locator("#qr-chip-url")).toHaveText(esperada);
    await expect(page.locator("#qr-link-row-url")).toHaveText(esperada);
  });

  test("los enlaces para compartir llevan la dirección real", async ({ page }) => {
    await page.goto("/qr.html");

    await expect(page.locator("#share-whatsapp")).toHaveAttribute("href", new RegExp(encodeURIComponent(QR.url)));
    await expect(page.locator("#share-email")).toHaveAttribute("href", new RegExp(encodeURIComponent(QR.url)));
  });

  test("si el perfil no tiene código, se genera al abrir la pantalla", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, { sinQr: true });
    await sembrarSesion(page);

    // Se registra despues de simularApi a proposito: en Playwright el ultimo
    // route registrado atiende primero, y fallback() pasa el turno al anterior
    const peticiones = [];
    await page.route("**/api/qr**", (route) => {
      peticiones.push(route.request().method());
      route.fallback();
    });

    await page.goto("/qr.html");

    // El GET devuelve 404 y la pantalla lo genera sin preguntar
    await expect.poll(() => peticiones.join(",")).toContain("POST");
    await expect(page.locator("#qr-chip-url")).toHaveText(QR.url.replace(/^https?:\/\//, ""));
  });

  test("si el perfil está vacío, lo explica en lugar de fallar", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, {
      sinQr: true,
      errorAlGenerarQr: "Agregue al menos un bloque de contenido activo antes de generar el código QR"
    });
    await sembrarSesion(page);

    await page.goto("/qr.html");

    await expect(page.locator("#toast")).toContainText("bloque de contenido activo");
  });

  test("descarga el PDF como archivo, no como vista de impresión", async ({ page }) => {
    await page.goto("/qr.html");

    // Antes el PDF abría una pestaña con el diálogo de impresión del
    // navegador y dependía de que la persona eligiera "Guardar como PDF"
    await page.click('.qr-format-btn:has-text("PDF")');

    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#download-btn")
    ]);

    expect(descarga.suggestedFilename()).toBe(`qr-${QR.slug}.pdf`);
  });

  test("descarga el SVG con el nombre que propone el servidor", async ({ page }) => {
    await page.goto("/qr.html");

    await page.click('.qr-format-btn:has-text("SVG")');

    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#download-btn")
    ]);

    expect(descarga.suggestedFilename()).toBe(`qr-${QR.slug}.svg`);
  });
});

// RF-07 y RF-09: publicar o retirar la página.
//
// El endpoint PATCH /api/qr/estado existía desde el módulo 4, con sus reglas
// y sus nueve pruebas de backend, y ninguna pantalla lo usaba: el dueño no
// tenía forma de retirar su página. Peor: la regla del módulo 3 no le deja
// quitar su último bloque mientras el código esté encendido, así que quedaba
// atrapado sin salida. La documentación de la v1.9.1 llegó a decir que
// apagarlo era «la vía para retirar la página a propósito» — y esa vía no
// existía en la aplicación.
test.describe("Publicar y retirar la página", () => {
  test("la etiqueta dice el estado real, no «En línea» siempre", async ({ page }) => {
    await page.goto("/qr.html");

    // Estaba escrita a mano en el HTML y no cambiaba nunca
    await expect(page.locator("#qr-estado")).toHaveText("● Publicada");
    await expect(page.locator("#qr-estado")).toHaveClass("pill-online");
  });

  test("retirar pide confirmación y explica qué implica", async ({ page }) => {
    await page.goto("/qr.html");

    await page.click("#qr-visibilidad-btn");

    await expect(page.locator("#qr-confirmar")).toBeVisible();
    await expect(page.locator("#qr-confirmar-texto"))
      .toContainText("dejarán de llevar a ninguna parte");

    // Mientras no se confirme, no ha pasado nada
    await expect(page.locator("#qr-estado")).toHaveText("● Publicada");
  });

  test("cancelar deja la página publicada", async ({ page }) => {
    await page.goto("/qr.html");

    await page.click("#qr-visibilidad-btn");
    await page.click("#qr-confirmar-cancelar");

    await expect(page.locator("#qr-confirmar")).toBeHidden();
    await expect(page.locator("#qr-estado")).toHaveText("● Publicada");
  });

  test("al confirmar, el servidor la retira de verdad", async ({ page }) => {
    await page.goto("/qr.html");

    await page.click("#qr-visibilidad-btn");
    await page.click("#qr-confirmar-aceptar");

    await expect(page.locator("#qr-estado")).toHaveText("● Retirada");
    await expect(page.locator("#qr-estado")).toHaveClass("pill-offline");
    await expect(page.locator("#qr-visibilidad-btn")).toHaveText("Publicar mi página");

    // Se comprueba contra el servidor, no contra la etiqueta repintada
    await expect
      .poll(async () => page.evaluate(async () => (await Api.miQr()).data.activo))
      .toBe(false);
  });

  test("y vuelve a publicarse", async ({ page }) => {
    await page.goto("/qr.html");

    await page.click("#qr-visibilidad-btn");
    await page.click("#qr-confirmar-aceptar");
    await expect(page.locator("#qr-estado")).toHaveText("● Retirada");

    await page.click("#qr-visibilidad-btn");
    await expect(page.locator("#qr-confirmar-texto")).toContainText("volverá a responder");
    await page.click("#qr-confirmar-aceptar");

    await expect(page.locator("#qr-estado")).toHaveText("● Publicada");
  });

  // La tarjeta traía el botón escrito en el HTML, sin texto y ya clicable, y
  // la etiqueta traía la clase verde. Quien lo pulsara antes de que llegara
  // la respuesta disparaba la acción contraria: el manejador leía un estado
  // que todavía era null, así que ofrecía "Publicar" sobre una página que ya
  // estaba publicada.
  test("mientras no se sepa el estado, no hay botón que pulsar", async ({ page }) => {
    let soltar;
    const respuestaRetenida = new Promise((listo) => { soltar = listo; });

    // Se registra despues del simulador: Playwright da prioridad al ultimo
    await page.route("**/api/qr", async (ruta) => {
      await respuestaRetenida;
      await ruta.fallback();
    });

    await page.goto("/qr.html");

    await expect(page.locator("#qr-visibilidad-btn")).toBeHidden();
    await expect(page.locator("#qr-estado")).toBeHidden();

    soltar();

    await expect(page.locator("#qr-estado")).toHaveText("● Publicada");
    await expect(page.locator("#qr-visibilidad-btn")).toHaveText("Retirar mi página");
  });

  test("si el servidor rechaza publicarla, se avisa y no miente el estado", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, { sinContenidoActivo: true });
    await sembrarSesion(page);

    await page.goto("/qr.html");

    await page.click("#qr-visibilidad-btn");
    await page.click("#qr-confirmar-aceptar");
    await expect(page.locator("#qr-estado")).toHaveText("● Retirada");

    // Ahora el perfil está vacío: publicarlo llevaría a una página en blanco
    await page.click("#qr-visibilidad-btn");
    await page.click("#qr-confirmar-aceptar");

    await expect(page.locator("#toast")).toContainText("contenido activo");
    await expect(page.locator("#qr-estado")).toHaveText("● Retirada");
  });
});

test.describe("Compartir el enlace", () => {
  test("el botón de Instagram copia el enlace propio [regresión]", async ({ page }) => {
    await page.goto("/qr.html");

    // Era un enlace fijo a instagram.com/fondalacosecha.co, el negocio de
    // ejemplo: cualquier cuenta real abría el Instagram de otro
    await expect(page.locator('a[href*="instagram.com/fondalacosecha"]')).toHaveCount(0);

    await page.evaluate(() => {
      window.__copiado = null;
      navigator.clipboard.writeText = async (texto) => { window.__copiado = texto; };
    });

    await page.click("#share-instagram");

    const copiado = await page.evaluate(() => window.__copiado);

    expect(copiado).toBe(QR.url);
  });
});
