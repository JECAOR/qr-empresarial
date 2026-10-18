// ============================================
// tests/accessibility.spec.js
// Corre axe-core contra cada página. Si algo rompe el
// contraste de color, quita una etiqueta, o quita un
// landmark semántico, esta prueba lo va a atrapar.
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion, prepararSesionAdmin } = require("./ayudas");
const AxeBuilder = require("@axe-core/playwright").default;

const PAGINAS = [
  "login.html", "register.html", "forgot-password.html", "restablecer.html",
  "dashboard.html", "contenido.html", "qr.html", "configuracion.html",
  "public.html", "menu.html", "404.html",
];

// Las pantallas privadas necesitan sesión, y el frontend ya consulta la API:
// se simula la respuesta para no depender del backend (ver ayudas.js).
test.beforeEach(async ({ page }) => {
  await prepararSesion(page);
});

// admin.html se mira el rol antes de dibujar nada: con una sesion de empresa
// redirige al dashboard (RN-22), asi que se prueba aparte y con su sesion.
const PAGINAS_ADMIN = ["admin.html"];


for (const pagina of PAGINAS) {
  test(`${pagina} no tiene violaciones de accesibilidad (WCAG 2 A/AA)`, async ({ page }) => {
    await page.goto(`/${pagina}`);
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "best-practice"])
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        `Violaciones en ${pagina}:`,
        results.violations.map((v) => `${v.id} (${v.nodes.length} elementos)`)
      );
    }
    expect(results.violations).toEqual([]);
  });
}

// Los 3 temas de color se verifican aparte, sobre una página representativa,
// porque el color de marca cambia por completo entre uno y otro.
for (const tema of ["indigo", "teal", "terracota"]) {
  test(`dashboard.html con tema ${tema} cumple contraste de color`, async ({ page }) => {
    await page.goto("/dashboard.html");
    await page.evaluate((t) => localStorage.setItem("qre-theme", t), tema);
    await page.reload();
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}

for (const pagina of PAGINAS_ADMIN) {
  test(`${pagina} no tiene violaciones de accesibilidad (WCAG 2 A/AA)`, async ({ page }) => {
    await page.unroute("**/api/**");
    await prepararSesionAdmin(page);

    await page.goto(`/${pagina}`);
    await page.waitForTimeout(400);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "best-practice"])
      .analyze();

    if (results.violations.length > 0) {
      console.log(
        `Violaciones en ${pagina}:`,
        results.violations.map((v) => `${v.id} (${v.nodes.length} elementos)`)
      );
    }

    expect(results.violations).toEqual([]);
  });
}
