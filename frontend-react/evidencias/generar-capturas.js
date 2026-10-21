// ============================================
// GENERAR-CAPTURAS.JS — las dos capturas de la pantalla
//
// Abre la aplicación de React contra el servidor de verdad y guarda sus dos
// estados: el perfil cargado y el error. Se toman siempre iguales, así que
// se pueden rehacer cuando la pantalla cambie.
//
// Las otras cuatro evidencias no se automatizan: MySQL Workbench, el Runner
// de Postman, la pestaña Network y la terminal de Vite son capturas de esas
// herramientas. Están explicadas en el README de esta carpeta.
//
//   1. cd backend && npm run dev
//   2. cd frontend-react && npm run dev
//   3. node frontend-react/evidencias/generar-capturas.js
//
// Usa el Playwright que ya está instalado en frontend/, para no agregar una
// dependencia a este proyecto solo por esto.
// ============================================

import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Este proyecto es un modulo ES, y Playwright se publica como CommonJS:
// createRequire es el puente. __dirname tampoco existe aqui, se reconstruye.
const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..', '..');

const { chromium } = require(path.join(RAIZ, 'frontend', 'node_modules', 'playwright'));

const ORIGEN = process.env.ORIGEN || 'http://localhost:5173';
const DESTINO = __dirname;

const PANTALLA = { width: 1100, height: 900 };

(async () => {
  await fs.mkdir(DESTINO, { recursive: true });

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: PANTALLA });

  // --- 04. El perfil cargado ---
  await pagina.goto(ORIGEN);
  await pagina.waitForSelector('.ficha__nombre');
  await pagina.waitForSelector('.tarjeta');
  await pagina.waitForTimeout(600);

  const bloques = await pagina.locator('.tarjeta').count();

  if (bloques !== 5) {
    throw new Error(`Se esperaban 5 bloques y hay ${bloques}. ¿Está cargado database/seed.sql?`);
  }

  await pagina.screenshot({
    path: path.join(DESTINO, '04-pantalla-perfil.png'),
    fullPage: true
  });

  console.log(`  04  el perfil cargado, con sus ${bloques} bloques`);

  // --- 05. El error ---
  await pagina.fill('#slug', 'negocio-que-no-existe');
  await pagina.click('button[type="submit"]');
  await pagina.waitForSelector('[role="alert"]');
  await pagina.waitForTimeout(400);

  const mensaje = await pagina.locator('[role="alert"]').textContent();

  await pagina.screenshot({
    path: path.join(DESTINO, '05-pantalla-error.png'),
    fullPage: true
  });

  console.log(`  05  el error: «${mensaje.trim()}»`);

  await navegador.close();

  console.log('\n  Las dos capturas en frontend-react/evidencias/');
})();
