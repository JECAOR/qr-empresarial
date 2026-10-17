// ============================================
// tests/responsive.spec.js
// Verifica que ninguna página se desborde horizontalmente
// en un ancho de móvil típico (390px).
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion } = require("./ayudas");

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
