// ============================================
// tests/qr.spec.js
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion } = require("./ayudas");

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
    expect(clipboard).toMatch(/^https:\/\/qr\./);
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
