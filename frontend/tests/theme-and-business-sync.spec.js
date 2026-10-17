// ============================================
// tests/theme-and-business-sync.spec.js
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion, PERFIL } = require("./ayudas");

// El frontend ahora pide los datos a la API: se simula la respuesta y se deja
// una sesión guardada, para que estas pruebas sigan sin necesitar el backend
// encendido (ver ayudas.js). Va fuera de los describe para que valga en todos.
test.beforeEach(async ({ page }) => {
  await prepararSesion(page);
});


test.describe("Temas de color", () => {
  test("las 3 opciones de tema quedan guardadas y se aplican al recargar (escritorio, desde el sidebar)", async ({ page, isMobile }) => {
    test.skip(isMobile, "En móvil se prueba por separado desde Configuración — ver el siguiente test.");

    await page.goto("/dashboard.html");
    for (const tema of ["teal", "terracota", "indigo"]) {
      await page.click(`.sidebar-theme-dot[data-theme-id="${tema}"]`);
      await page.waitForTimeout(300); // el cambio de tema recarga la página
      const guardado = await page.evaluate(() => localStorage.getItem("qre-theme"));
      if (tema === "indigo") {
        const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        expect(attr).toBeNull();
      } else {
        expect(guardado).toBe(tema);
      }
    }
  });

  // El selector de tema del sidebar no existe en el layout móvil (el sidebar
  // se oculta por completo bajo los 780px). Por eso también vive una copia
  // en Configuración — alcanzable en móvil vía "Ajustes" en el nav inferior.
  test("en móvil, el tema se cambia desde Configuración y persiste", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Este camino es específico del layout móvil — en escritorio se prueba en el test anterior.");

    // "Ajustes" debe estar en el nav inferior para poder llegar hasta ahí
    await page.goto("/dashboard.html");
    await expect(page.locator(".mobile-nav-item", { hasText: "Ajustes" })).toBeVisible();

    await page.goto("/configuracion.html");
    await page.click('.theme-option[data-theme-id="teal"]');
    await page.waitForTimeout(300);
    const guardado = await page.evaluate(() => localStorage.getItem("qre-theme"));
    expect(guardado).toBe("teal");

    // Y se aplica también en otras pantallas, no solo en Configuración
    await page.goto("/dashboard.html");
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(attr).toBe("teal");
  });
});

test.describe("Sincronización de datos del negocio entre pantallas", () => {
  test("guardar en Configuración actualiza el sidebar sin recargar", async ({ page }) => {
    await page.goto("/configuracion.html");
    await page.fill("#biz-name", "Sabores del Valle");
    await page.click('#business-form button[type="submit"]');
    await expect(page.locator(".sidebar-user-name")).toHaveText("Sabores del Valle");
  });

  test("el cambio se propaga al Dashboard, Código QR y la página pública", async ({ page }) => {
    await page.goto("/configuracion.html");
    await page.fill("#biz-name", "Sabores del Valle");
    await page.fill("#biz-address", "Calle 10 #43-12, Cali");
    await page.fill("#biz-phone", "+57 315 222 3344");
    await page.fill("#biz-email", "hola@saboresdelvalle.co");
    await page.click('#business-form button[type="submit"]');
    await page.waitForTimeout(200);

    await page.goto("/dashboard.html");
    await expect(page.locator("#dash-biz-name")).toHaveText("Sabores del Valle");

    // La dirección del QR NO sigue al nombre: la decide el servidor cuando se
    // crea el perfil y se mantiene al renombrar, porque un código ya impreso
    // tiene que seguir llevando al mismo sitio (RF-09).
    await expect(page.locator("#dash-qr-url")).toContainText(PERFIL.slug);

    await page.goto("/qr.html");
    await expect(page.locator("#qr-chip-url")).toContainText(PERFIL.slug);

    await page.goto("/public.html");
    await expect(page.locator("#profile-name")).toHaveText("Sabores del Valle");
    await expect(page.locator("#link-reserve")).toHaveAttribute("href", "tel:+573152223344");
    await expect(page.locator("#link-email")).toHaveAttribute("href", "mailto:hola@saboresdelvalle.co");
  });

  // --- Prueba de regresión de seguridad ---
  test("[seguridad] el nombre del negocio no ejecuta HTML/JS en el sidebar", async ({ page }) => {
    const dialogs = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      d.accept();
    });

    await page.goto("/configuracion.html");
    await page.fill("#biz-name", '<img src=x onerror="alert(1)">');
    await page.click('#business-form button[type="submit"]');
    await page.goto("/dashboard.html");
    await page.waitForTimeout(300);

    expect(dialogs).toHaveLength(0);
    await expect(page.locator(".sidebar-user-name")).toHaveText('<img src=x onerror="alert(1)">');
  });
});

test.describe("Notificaciones (persistencia real)", () => {
  test("cambiar un interruptor de notificación sobrevive a recargar la página", async ({ page }) => {
    await page.goto("/configuracion.html");

    // "Resumen semanal" empieza encendido — lo apagamos
    await page.click('.settings-notif-toggle[data-notif-key="weekly"]');
    // "Novedades de QR Empresarial" empieza apagado — lo encendemos
    await page.click('.settings-notif-toggle[data-notif-key="updates"]');

    const guardado = await page.evaluate(() => localStorage.getItem("qre-notifications"));
    expect(guardado).toContain('"weekly":false');
    expect(guardado).toContain('"updates":true');

    await page.reload();
    await expect(page.locator('[data-notif-key="weekly"]')).not.toHaveClass(/on/);
    await expect(page.locator('[data-notif-key="updates"]')).toHaveClass(/on/);
  });
});
