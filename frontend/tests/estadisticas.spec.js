// ============================================
// tests/estadisticas.spec.js — estadísticas del panel (RF-11)
//
// El requisito pide tres medidas: escaneos del QR, visitas al perfil y clics
// en enlaces. Antes el panel las mostraba escritas a mano en dashboard.js
// —2.847 escaneos, una semana inventada—, así que estas pruebas son en buena
// parte la regresión de eso.
//
// Se comprueban las dos mitades del módulo: que el panel pinte lo que
// responde el servidor, y que la vista pública informe los eventos.
// ============================================
const { test, expect } = require("@playwright/test");
const { simularApi, sembrarSesion, prepararSesion, ESTADISTICAS } = require("./ayudas");

test.describe("Panel con estadísticas reales", () => {
  test.beforeEach(async ({ page }) => {
    await prepararSesion(page);
  });

  test("las cuatro tarjetas muestran lo que responde el servidor", async ({ page }) => {
    await page.goto("/dashboard.html");

    const tarjetas = page.locator(".kpi-card");
    await expect(tarjetas).toHaveCount(4);

    // Los miles se separan como se leen en Colombia
    await expect(tarjetas.nth(0)).toContainText("Escaneos del QR");
    await expect(tarjetas.nth(0).locator(".kpi-value")).toHaveText("248");

    await expect(tarjetas.nth(1)).toContainText("Visitas al perfil");
    await expect(tarjetas.nth(1).locator(".kpi-value")).toHaveText("96");

    await expect(tarjetas.nth(2)).toContainText("Clics en enlaces");
    await expect(tarjetas.nth(2).locator(".kpi-value")).toHaveText("73");

    await expect(tarjetas.nth(3).locator(".kpi-value")).toHaveText("21.2%");
  });

  test("ya no muestra las cifras de ejemplo [regresión]", async ({ page }) => {
    await page.goto("/dashboard.html");

    // Eran las que venían escritas en dashboard.js
    await expect(page.locator("text=2,847")).toHaveCount(0);
    await expect(page.locator("text=1,932")).toHaveCount(0);
    await expect(page.locator("text=45.1%")).toHaveCount(0);

    // Y la tarjeta decía "Visitantes únicos", que no se puede saber con lo
    // que se guarda: la tabla de eventos no identifica a quien visita
    await expect(page.locator("text=Visitantes únicos")).toHaveCount(0);
  });

  test("la gráfica usa la serie del servidor", async ({ page }) => {
    await page.goto("/dashboard.html");

    const serie = await page.evaluate(() => ({
      etiquetas: estadisticas.serie.map((d) => d.etiqueta),
      escaneos: estadisticas.serie.map((d) => d.escaneos)
    }));

    expect(serie.etiquetas).toEqual(ESTADISTICAS.serie.map((d) => d.etiqueta));
    expect(serie.escaneos).toEqual(ESTADISTICAS.serie.map((d) => d.escaneos));
  });

  test("sin perfil, la pantalla se queda en cero y no falla", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, { sinEstadisticas: true });
    await sembrarSesion(page);

    await page.goto("/dashboard.html");

    // Es preferible a mostrar cifras de ejemplo, que es lo que hacía antes
    await expect(page.locator(".kpi-card").first().locator(".kpi-value")).toHaveText("0");
  });
});

test.describe("La vista pública informa los eventos", () => {
  const SLUG = "fonda-la-cosecha";

  test("un escaneo se distingue de una visita directa", async ({ page }) => {
    await simularApi(page);

    // La imagen del código lleva ?qr=1; el enlace que se comparte, no
    await page.goto(`/public.html?slug=${SLUG}&qr=1`);
    await expect.poll(() => page.eventosInformados.map((e) => e.tipo)).toContain("escaneo");
  });

  test("una visita sin la marca del código se cuenta como visita", async ({ page }) => {
    await simularApi(page);

    await page.goto(`/public.html?slug=${SLUG}`);
    await expect.poll(() => page.eventosInformados.map((e) => e.tipo)).toContain("visita");
  });

  test("pulsar un enlace informa el clic con su identificador", async ({ page }) => {
    await simularApi(page);
    await page.goto(`/public.html?slug=${SLUG}`);

    // El primer bloque del contenido simulado es un enlace
    const enlace = page.locator("a.profile-block[data-id]").first();
    await expect(enlace).toBeVisible();

    // Se evita que el navegador salga de la página
    await enlace.evaluate((el) => el.removeAttribute("target"));
    await enlace.evaluate((el) => el.addEventListener("click", (e) => e.preventDefault()));
    await enlace.click();

    await expect.poll(() => page.eventosInformados.filter((e) => e.tipo === "clic").length)
      .toBeGreaterThan(0);

    const clic = page.eventosInformados.find((e) => e.tipo === "clic");
    expect(Number.isInteger(clic.idEnlace)).toBe(true);
  });

  test("un bloque de texto no informa clics", async ({ page }) => {
    await simularApi(page);
    await page.goto(`/public.html?slug=${SLUG}`);

    // Los textos se pintan como <div>: no llevan a ninguna parte, así que no
    // hay clic que contar
    const texto = page.locator(".profile-block:not(a)").first();
    await texto.click();

    await page.waitForTimeout(400);
    expect(page.eventosInformados.filter((e) => e.tipo === "clic")).toHaveLength(0);
  });
});
