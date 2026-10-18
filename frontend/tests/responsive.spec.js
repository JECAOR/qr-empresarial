// ============================================
// tests/responsive.spec.js
// Verifica que ninguna página se desborde horizontalmente
// en un ancho de móvil típico (390px).
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion, prepararSesionAdmin } = require("./ayudas");

const PAGINAS = [
  "login.html", "register.html", "forgot-password.html", "restablecer.html",
  "dashboard.html", "contenido.html", "qr.html", "configuracion.html",
  "public.html", "menu.html",
];

// Las pantallas privadas necesitan sesión, y el frontend ya consulta la API:
// se simula la respuesta para no depender del backend (ver ayudas.js).
test.beforeEach(async ({ page }) => {
  await prepararSesion(page);
});

// admin.html se mira el rol antes de dibujar nada: con una sesion de empresa
// redirige al dashboard (RN-22), asi que se prueba aparte y con su sesion.
const PAGINAS_ADMIN = ["admin.html"];


test.use({ viewport: { width: 390, height: 844 } });

for (const pagina of PAGINAS) {
  test(`${pagina} no se desborda horizontalmente en móvil`, async ({ page }) => {
    await page.goto(`/${pagina}`);
    await page.waitForTimeout(300);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // Se tolera 1px de margen por redondeo de subpíxeles.
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
}

for (const pagina of PAGINAS_ADMIN) {
  test(`${pagina} no se desborda horizontalmente en móvil`, async ({ page }) => {
    await page.unroute("**/api/**");
    await prepararSesionAdmin(page);

    await page.goto(`/${pagina}`);
    await page.waitForTimeout(400);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
}

// La rejilla de las cuatro tarjetas del panel no desbordaba la página —nada
// hacía scroll—, pero las tarjetas sumaban más ancho del que tenía la
// rejilla y la última, «Tasa de conversión», quedaba cortada contra el borde
// derecho. Chart.js fija el ancho del lienzo en píxeles, y en una rejilla eso
// empuja a la columna a crecer. Lo destapó una captura de la evidencia.
test.describe("El panel cabe en pantallas anchas", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("las cuatro tarjetas caben dentro de la rejilla [regresión]", async ({ page }) => {
    await page.goto("/dashboard.html");

    await expect(page.locator(".kpi-card")).toHaveCount(4);
    await page.waitForTimeout(300);

    const { rejilla, ultima } = await page.evaluate(() => ({
      rejilla: document.querySelector(".kpi-grid").getBoundingClientRect().right,
      ultima: document.querySelectorAll(".kpi-card")[3].getBoundingClientRect().right
    }));

    expect(ultima).toBeLessThanOrEqual(rejilla + 1);
  });
});
