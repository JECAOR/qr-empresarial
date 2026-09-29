// ============================================
// tests/pwa.spec.js
// Verifica que el sitio sea una PWA instalable de verdad:
// manifest válido, service worker activo, y funcionamiento
// real sin conexión (no solo la teoría).
// ============================================
const { test, expect } = require("@playwright/test");

test.describe("PWA", () => {
  test("el manifest.json es válido y tiene los íconos requeridos", async ({ page }) => {
    await page.goto("/login.html");
    const manifest = await page.evaluate(async () => {
      const res = await fetch("/manifest.json");
      return { status: res.status, data: await res.json() };
    });
    expect(manifest.status).toBe(200);
    expect(manifest.data.name).toBeTruthy();
    expect(manifest.data.display).toBe("standalone");
    const tamaños = manifest.data.icons.map((i) => i.sizes);
    expect(tamaños).toContain("192x192");
    expect(tamaños).toContain("512x512");
  });

  test("el service worker se registra y queda activo", async ({ page }) => {
    await page.goto("/dashboard.html");
    const estado = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      // "activating" es un estado transitorio válido justo al resolver
      // ready — lo que importa es que el registro se logró de verdad.
      return reg.active ? reg.active.state : "sin activar";
    });
    expect(["activating", "activated"]).toContain(estado);
  });

  test("una página ya visitada sigue funcionando sin conexión", async ({ page, context }) => {
    await page.goto("/dashboard.html");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(300);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".dash-banner-title")).toBeVisible();
  });

  test("una página nunca visitada también funciona sin conexión (app shell precargado)", async ({ page, context }) => {
    // Solo se visita login.html — el service worker debe precargar el
    // resto del sitio de todas formas (ver APP_SHELL en service-worker.js).
    await page.goto("/login.html");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(300);

    await context.setOffline(true);
    await page.goto("/qr.html");
    await expect(page.locator("#qr-canvas")).toBeVisible();
  });
});
