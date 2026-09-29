// ============================================
// playwright.config.js
// Configuración de las pruebas automatizadas del proyecto QR Empresarial.
// Para correrlas: ver tests/README.md
// ============================================

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 1,
  reporter: [["html", { open: "never" }], ["list"]],

  // Levanta un servidor local del propio proyecto antes de correr las
  // pruebas, y lo apaga automáticamente al terminar — no hace falta
  // tenerlo corriendo a mano.
  webServer: {
    command: "npx http-server . -p 4173 -s",
    url: "http://localhost:4173/login.html",
    reuseExistingServer: !process.env.CI,
  },

  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    // Nota: devices["iPhone 13"] emula Safari/WebKit por defecto. Aquí se
    // fuerza a Chromium (con el mismo viewport y "es un móvil") porque este
    // entorno de desarrollo no pudo instalar un WebKit real (ver tests/README.md).
    // Si tú sí tienes WebKit instalado, puedes quitar "browserName" para
    // volver a la emulación real de Safari.
    {
      name: "Mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
