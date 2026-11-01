// ============================================
// PLAYWRIGHT.CONFIG.JS — las pruebas de extremo a extremo del frontend React
//
// Las 439 pruebas de Vitest corren en jsdom, que no es un navegador: no
// aplica CSS, no tiene arrastre nativo, no descarga archivos, no tiene
// sendBeacon, y sobre todo envuelve cada evento en act(), con lo que aplica
// los cambios de React entre uno y otro. Eso esconde justo los defectos que
// dependen del momento en que React aplica un cambio.
//
// Lo que hay en pruebas-e2e/ es lo que solo contesta un navegador de verdad.
// No se repite aqui lo que ya comprueba Vitest.
//
// Para correrlas: ver pruebas-e2e/README.md
// ============================================

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './pruebas-e2e',
  fullyParallel: true,
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  // Se compila en cada corrida y a una carpeta aparte. Lo primero porque
  // estas pruebas miran el paquete que se publica, no el codigo fuente, y un
  // dist viejo daria por buena una pantalla que ya no existe. Lo segundo
  // porque dist/ es lo que publica Express: dejarselo con la configuracion de
  // las pruebas le cambiaria la direccion de la API sin avisar.
  webServer: {
    command: 'npm run build -- --mode e2e --outDir dist-e2e'
      + ' && npx vite preview --mode e2e --outDir dist-e2e --port 4174 --strictPort',
    url: 'http://localhost:4174/login',
    reuseExistingServer: false,
    timeout: 120000,
  },

  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',

    // Estas pruebas corren contra el paquete compilado, donde main.jsx SI
    // registra el service worker. Un service worker activo responderia a las
    // peticiones desde su cache y las sacaria del alcance de page.route(),
    // con lo que los datos simulados de ayudas.js dejarian de aplicarse y
    // los fallos no tendrian nada que ver con lo que la prueba mira.
    //
    // Que se registra de verdad lo comprueba pwa.spec.js, que lo hace en su
    // propio contexto con los service workers permitidos.
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'Escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      testIgnore: /movil\.spec\.js/,
    },
    // Igual que en la suite del frontend original: devices["iPhone 13"] emula
    // WebKit, y este entorno no pudo instalar un WebKit real. Se queda el
    // viewport y el "es un movil", que es lo que necesitan las pruebas del
    // CSS, con el motor que si hay.
    {
      name: 'Movil',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },

      // Las del CSS, y de paso la auditoria de accesibilidad: en una
      // pantalla estrecha cambian el contraste de algunos fondos, el orden
      // visual y el tamaño de lo que hay que pulsar, que son tres de las
      // cosas que axe mide.
      testMatch: /(movil|accesibilidad)\.spec\.js/,
    },
  ],
});
