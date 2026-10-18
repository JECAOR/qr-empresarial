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
