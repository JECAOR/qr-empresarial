// ============================================
// tests/auth.spec.js
// Login, Registro (3 pasos) y Recuperar contraseña
// ============================================
const { test, expect } = require("@playwright/test");

test.describe("Login", () => {
  test("bloquea el envío con campos vacíos y muestra los errores", async ({ page }) => {
    await page.goto("/login.html");
    await page.click('button[type="submit"]');
    await expect(page.locator(".form-field.has-error")).toHaveCount(2);
    // No debe haber navegado
    await expect(page).toHaveURL(/login\.html/);
  });

  test("el botón de mostrar/ocultar contraseña funciona con teclado", async ({ page }) => {
    await page.goto("/login.html");
    await page.click("#email");
    await page.keyboard.press("Tab"); // -> password
    await page.keyboard.press("Tab"); // -> toggle button
    await expect(page.locator(".toggle-password")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
  });

  test("con datos válidos navega al dashboard", async ({ page }) => {
    await page.goto("/login.html");
    await page.fill("#email", "camila@fondalacosecha.co");
    await page.fill("#password", "Abcdefgh123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard\.html/);
  });

  test("el enlace de olvidé mi contraseña lleva a la página correcta", async ({ page }) => {
    await page.goto("/login.html");
    await page.click("text=¿Olvidaste?");
    await expect(page).toHaveURL(/forgot-password\.html/);
  });
});

test.describe("Registro (3 pasos)", () => {
  test("completa el flujo completo y conserva los datos al ir y volver", async ({ page }) => {
    await page.goto("/register.html");

    // Paso 1 — no debe avanzar si falta algo
    await page.click('[data-next="2"]');
    await expect(page.locator(".step-item.active .step-label")).toHaveText("Cuenta");

    await page.fill("#fullname", "Camila Restrepo");
    await page.fill("#reg-email", "camila@fondalacosecha.co");
    await page.fill("#password", "Abcdefgh123!");
    await page.fill("#confirm-password", "Abcdefgh123!");
    await page.check("#terms");
    await page.click('[data-next="2"]');

    await expect(page.locator("#step-title")).toHaveText("Cuéntanos de tu negocio");

    // Paso 2
    await page.fill("#reg-biz-name", "Fonda La Cosecha");
    await page.fill("#reg-biz-address", "Cra. 35 #8A-45, El Poblado, Medellín");
    await page.fill("#reg-biz-phone", "+57 300 456 7890");
    await page.click('[data-next="3"]');

    await expect(page.locator("#step-title")).toHaveText("Elige tu plan");
    // El plan Pro debe venir preseleccionado
    await expect(page.locator("#plan-pro")).toBeChecked();

    // Volver atrás no debe perder lo que ya se llenó
    await page.click('[data-back="2"]');
    await expect(page.locator("#reg-biz-name")).toHaveValue("Fonda La Cosecha");

    // Terminar el flujo
    await page.click('[data-next="3"]');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard\.html/);
  });

  test("el medidor de fuerza de contraseña reacciona a lo que se escribe", async ({ page }) => {
    await page.goto("/register.html");
    await page.fill("#password", "abc");
    await expect(page.locator("#password-strength-label")).toHaveText("Débil");
    await page.fill("#password", "Abcdefghij123!");
    await expect(page.locator("#password-strength-label")).toHaveText("Fuerte");
  });
});

test.describe("Recuperar contraseña", () => {
  test("muestra confirmación con el correo ingresado", async ({ page }) => {
    await page.goto("/forgot-password.html");
    await page.fill("#forgot-email", "camila@fondalacosecha.co");
    await page.click('#forgot-form button[type="submit"]');
    await expect(page.locator("#sent-step")).toBeVisible();
    await expect(page.locator("#sent-message")).toContainText("camila@fondalacosecha.co");
  });
});
