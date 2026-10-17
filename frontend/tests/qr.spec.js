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
