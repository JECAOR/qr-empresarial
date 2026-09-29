// ============================================
// tests/accessibility.spec.js
// Corre axe-core contra cada página. Si algo rompe el
// contraste de color, quita una etiqueta, o quita un
// landmark semántico, esta prueba lo va a atrapar.
// ============================================
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const PAGINAS = [
  "login.html", "register.html", "forgot-password.html", "dashboard.html",
  "contenido.html", "qr.html", "configuracion.html", "public.html",
  "menu.html", "404.html",
];

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
