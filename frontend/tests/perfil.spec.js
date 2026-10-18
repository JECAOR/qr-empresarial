// ============================================
// tests/perfil.spec.js — perfil empresarial (RF-04 y RF-10)
//
// Antes los datos del negocio vivían solo en el navegador. Ahora el servidor
// es la fuente de verdad: la guardia los trae al abrir cualquier pantalla
// privada y Configuración los guarda con PUT /api/perfiles/me.
//
// Como el resto de la suite, estas pruebas no necesitan el backend: la API se
// simula en ayudas.js.
// ============================================
const { test, expect } = require("@playwright/test");
const { simularApi, sembrarSesion, prepararSesion, simularImagenes, PERFIL } = require("./ayudas");

test.describe("Sincronización del perfil con el servidor", () => {
  test("Configuración se llena con el perfil que devuelve la API", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");

    await expect(page.locator("#biz-name")).toHaveValue(PERFIL.nombreNegocio);
    await expect(page.locator("#biz-category")).toHaveValue(PERFIL.categoria);
    await expect(page.locator("#biz-phone")).toHaveValue(PERFIL.telefono);
    await expect(page.locator("#biz-hours")).toHaveValue(PERFIL.horario);
    await expect(page.locator("#biz-image")).toHaveValue(PERFIL.imagen);
  });

  test("el nombre del servidor reemplaza el que había en caché", async ({ page }) => {
    await simularApi(page);
    await sembrarSesion(page);

    // Se deja en el navegador un nombre distinto del que responde la API,
    // como le pasaría a alguien que editó su perfil desde otro dispositivo
    await page.addInitScript(() => {
      window.localStorage.setItem("qre-business", JSON.stringify({ name: "Nombre viejo en caché" }));
    });

    await page.goto("/dashboard.html");

    await expect(page.locator(".sidebar-user-name")).toHaveText(PERFIL.nombreNegocio);
  });

  test("si la cuenta no tiene perfil, la pantalla sigue funcionando", async ({ page }) => {
    // Le pasa a las cuentas que creó el administrador y a las registradas
    // antes de que el registro creara el perfil
    await simularApi(page, { sinPerfil: true });
    await sembrarSesion(page);

    await page.goto("/configuracion.html");

    await expect(page).toHaveURL(/configuracion\.html/);
    // El formulario queda con los datos locales, listo para crear el perfil
    await expect(page.locator("#business-form")).toBeVisible();
  });
});

test.describe("Guardar el perfil (RF-04)", () => {
  test.beforeEach(async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");
  });

  test("guarda los cambios y avisa", async ({ page }) => {
    await page.fill("#biz-name", "Fonda La Cosecha Renovada");
    await page.fill("#biz-hours", "Lun-Dom 10:00–22:00");
    await page.click('#business-form button[type="submit"]');

    await expect(page.locator("#business-saved-toast")).toContainText("Cambios guardados");
  });

  test("el nombre nuevo aparece en la barra lateral sin recargar", async ({ page }) => {
    await page.fill("#biz-name", "Fonda La Cosecha Renovada");
    await page.click('#business-form button[type="submit"]');

    await expect(page.locator(".sidebar-user-name")).toHaveText("Fonda La Cosecha Renovada");
  });

  test("el slug no cambia aunque cambie el nombre", async ({ page }) => {
    await page.fill("#biz-name", "Otro Nombre Completamente Distinto");
    await page.click('#business-form button[type="submit"]');

    await expect(page.locator("#business-saved-toast")).toContainText("Cambios guardados");

    // Lo decide el servidor: los códigos QR ya impresos deben seguir
    // funcionando (RF-09)
    const slug = await page.evaluate(() => getBusinessData().slug);
    expect(slug).toBe(PERFIL.slug);
  });

  test("muestra el error del servidor si rechaza el guardado", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, { errorAlGuardarPerfil: "El formato del correo de contacto no es válido" });

    await page.fill("#biz-name", "Fonda La Cosecha");
    await page.click('#business-form button[type="submit"]');

    await expect(page.locator("#business-saved-toast")).toContainText("correo de contacto");
  });
});

test.describe("Validación antes de guardar (RF-10)", () => {
  test.beforeEach(async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");
  });

  test("no deja guardar sin el nombre del negocio", async ({ page }) => {
    await page.fill("#biz-name", "");
    await page.click('#business-form button[type="submit"]');

    const campo = page.locator("#biz-name")
      .locator("xpath=ancestor::div[contains(@class,'form-field')]");
    await expect(campo).toHaveClass(/has-error/);
    await expect(page.locator("#business-saved-toast")).toContainText("Revise los campos");
  });

  test("no deja guardar una imagen que no es una dirección web", async ({ page }) => {
    await page.fill("#biz-image", "esto-no-es-una-url");
    await page.click('#business-form button[type="submit"]');

    const campo = page.locator("#biz-image")
      .locator("xpath=ancestor::div[contains(@class,'form-field')]");
    await expect(campo).toHaveClass(/has-error/);
  });

  test("acepta la imagen cuando sí es una dirección web", async ({ page }) => {
    await page.fill("#biz-image", "https://ejemplo.co/otro-logo.png");
    await page.click('#business-form button[type="submit"]');

    await expect(page.locator("#business-saved-toast")).toContainText("Cambios guardados");
  });
});

test.describe("Logo en la barra lateral", () => {
  test("muestra el logo del negocio en lugar de las iniciales", async ({ page }) => {
    await prepararSesion(page);
    await simularImagenes(page);

    // El perfil simulado trae imagen (ver ayudas.js)
    await page.goto("/dashboard.html");

    const logo = page.locator(".sidebar-avatar-img");
    await expect(logo).toHaveAttribute("src", PERFIL.imagen);
  });

  test("sin logo se queda con las iniciales", async ({ page }) => {
    await simularApi(page, {});
    await sembrarSesion(page);

    // Se deja en caché un negocio sin imagen
    await page.addInitScript(() => {
      window.localStorage.setItem("qre-business", JSON.stringify({ name: "Sin Logo", image: "" }));
    });

    await page.goto("/dashboard.html");

    // Antes de que llegue el perfil del servidor, la barra se dibuja con lo
    // que hay en caché: ahí deben salir las iniciales
    await expect(page.locator(".sidebar-avatar")).not.toHaveText("");
  });
});
