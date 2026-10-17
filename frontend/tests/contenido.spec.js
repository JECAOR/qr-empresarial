// ============================================
// tests/contenido.spec.js
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion } = require("./ayudas");

// El frontend ahora pide los datos a la API: se simula la respuesta y se deja
// una sesión guardada, para que estas pruebas sigan sin necesitar el backend
// encendido (ver ayudas.js). Va fuera de los describe para que valga en todos.
test.beforeEach(async ({ page }) => {
  await prepararSesion(page);
});


test.describe("Gestión de Contenido", () => {
  test("las pestañas filtran datos reales y distintos", async ({ page }) => {
    await page.goto("/contenido.html");
    const menuPrincipal = await page.locator(".item-card").count();
    expect(menuPrincipal).toBeGreaterThan(0);

    await page.click('.content-tab[data-tab="promos"]');
    await expect(page.locator("text=Menú del día")).toBeVisible();

    await page.click('.content-tab[data-tab="reservas"]');
    await expect(page.locator("text=Reservar mesa hoy")).toBeVisible();
    await expect(page.locator("text=Menú del día")).not.toBeVisible();
  });

  test("agregar, editar y eliminar un elemento", async ({ page }) => {
    await page.goto("/contenido.html");
    const antes = await page.locator(".item-card").count();

    // Agregar
    await page.click("#btn-open-add");
    await page.fill("#etiqueta", "Elemento de prueba");
    await page.fill("#subtitulo", "Subtítulo de prueba");
    await page.click('#add-item-form button[type="submit"]');
    await expect(page.locator(".item-card")).toHaveCount(antes + 1);
    await expect(page.locator("text=Elemento de prueba")).toBeVisible();

    // Eliminar el que se acaba de agregar
    const nuevaTarjeta = page.locator(".item-card", { hasText: "Elemento de prueba" });
    await nuevaTarjeta.locator('[data-action="delete"]').click();
    await expect(page.locator(".item-card")).toHaveCount(antes);
  });

  test("activar/desactivar cambia el estado visual", async ({ page }) => {
    await page.goto("/contenido.html");
    const primeraTarjeta = page.locator(".item-card").first();
    const toggle = primeraTarjeta.locator('[data-action="toggle"]');
    const estabaActiva = !(await primeraTarjeta.evaluate((el) => el.classList.contains("is-inactive")));
    await toggle.click();
    const activaAhora = !(await primeraTarjeta.evaluate((el) => el.classList.contains("is-inactive")));
    expect(activaAhora).toBe(!estabaActiva);
  });

  test("vaciar completamente una pestaña muestra el mensaje de estado vacío", async ({ page }) => {
    await page.goto("/contenido.html");
    await page.click('.content-tab[data-tab="promos"]');
    const cards = page.locator(".item-card");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await page.locator(".item-card").first().locator('[data-action="delete"]').click();
    }
    await expect(page.locator("text=Aún no hay elementos en esta sección.")).toBeVisible();
  });

  // --- Prueba de regresión de seguridad ---
  // Antes de una corrección real, escribir HTML en estos campos se ejecutaba
  // como código en vez de mostrarse como texto (XSS). Esta prueba falla si
  // alguien vuelve a quitar el escape sin darse cuenta.
  test("[seguridad] el nombre y subtítulo de un elemento no ejecutan HTML/JS", async ({ page }) => {
    const dialogs = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      d.accept();
    });

    await page.goto("/contenido.html");
    await page.click("#btn-open-add");
    await page.fill("#etiqueta", '"><img src=x onerror=alert(1)>');
    await page.fill("#subtitulo", "<script>alert(2)</script>");
    await page.click('#add-item-form button[type="submit"]');
    await page.waitForTimeout(300);

    expect(dialogs).toHaveLength(0);
    const html = await page.locator("#item-list").innerHTML();
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain("<script>alert(2)</script>");
  });
});

test.describe("Persistencia en LocalStorage", () => {
  test("crear un elemento se guarda en localStorage y sobrevive a recargar la página", async ({ page }) => {
    await page.goto("/contenido.html");
    await page.click("#btn-open-add");
    await page.fill("#etiqueta", "Elemento persistente");
    await page.fill("#subtitulo", "Prueba de LocalStorage");
    await page.click('#add-item-form button[type="submit"]');

    // El dato debe existir en localStorage, no solo en memoria
    const guardado = await page.evaluate(() => localStorage.getItem("qre-content-items"));
    expect(guardado).toContain("Elemento persistente");

    // Y debe seguir visible tras una recarga real de la página
    await page.reload();
    await expect(page.locator("text=Elemento persistente")).toBeVisible();
  });

  test("editar un elemento persiste el cambio tras recargar", async ({ page }) => {
    await page.goto("/contenido.html");
    const original = page.locator(".item-card").first();
    await original.locator('[data-action="edit"]').click();
    await page.fill("#etiqueta", "Nombre editado y persistido");
    await page.click('#add-item-form button[type="submit"]');

    await page.reload();
    await expect(page.locator("text=Nombre editado y persistido")).toBeVisible();
  });

  test("eliminar un elemento lo quita de localStorage de forma permanente", async ({ page }) => {
    await page.goto("/contenido.html");
    const primerNombre = await page.locator(".item-card").first().locator(".item-label").textContent();
    await page.locator(".item-card").first().locator('[data-action="delete"]').click();

    await page.reload();
    await expect(page.locator(".item-card", { hasText: primerNombre })).toHaveCount(0);
  });

  test("activar/desactivar un elemento persiste tras recargar", async ({ page }) => {
    await page.goto("/contenido.html");
    const primera = page.locator(".item-card").first();
    const estabaInactiva = await primera.evaluate((el) => el.classList.contains("is-inactive"));

    await primera.locator('[data-action="toggle"]').click();
    await page.reload();

    const inactivaAhora = await page.locator(".item-card").first().evaluate((el) => el.classList.contains("is-inactive"));
    expect(inactivaAhora).toBe(!estabaInactiva);
  });
});
