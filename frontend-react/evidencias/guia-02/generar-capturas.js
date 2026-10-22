// ============================================
// GENERAR-CAPTURAS.JS — las pantallas de la Guía 02
//
// Recorre la aplicación como lo haría una persona —entra, gestiona cuentas,
// se topa con el acceso denegado— y guarda una captura de cada paso. Contra
// el servidor de verdad, con los datos de database/seed.sql.
//
// Crea una cuenta de prueba, la edita, la restringe y la elimina, de modo que
// deja la base como la encontró. Las capturas se sobrescriben en cada
// ejecución.
//
//   1. cd backend && npm run dev
//   2. cd frontend-react && npm run dev
//   3. node frontend-react/evidencias/guia-02/generar-capturas.js
// ============================================

import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..", "..", "..");

const { chromium } = require(path.join(RAIZ, "frontend", "node_modules", "playwright"));

const ORIGEN = process.env.ORIGEN || "http://localhost:5173";

const ADMIN = { correo: "admin@caferaices.co", contrasena: "Clave123*" };
const EMPRESA = { correo: "contacto@laespiga.co", contrasena: "Clave123*" };

const PRUEBA = {
  nombre: "Floristeria El Jardin",
  correo: "capturas.eljardin@ejemplo.co",
  contrasena: "Jardin2026*"
};

const ESCRITORIO = { width: 1100, height: 900 };
const MOVIL = { width: 390, height: 844 };

let n = 0;

async function capturar(pagina, nombre, completa = true) {
  n += 1;

  const archivo = path.join(__dirname, `${String(n).padStart(2, "0")}-${nombre}.png`);

  await pagina.screenshot({ path: archivo, fullPage: completa });

  console.log(`  ${String(n).padStart(2, "0")}  ${nombre}`);
}

/** Entra por el formulario, como una persona. */
async function entrar(pagina, cuenta) {
  await pagina.goto(`${ORIGEN}/login`);
  await pagina.fill("#correo", cuenta.correo);
  await pagina.fill("#contrasena", cuenta.contrasena);
  await pagina.click('button[type="submit"]');
}

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: ESCRITORIO });

  // Las confirmaciones se aceptan solas: aqui no hay nadie para pulsarlas
  pagina.on("dialog", (dialogo) => dialogo.accept());

  // --- 01. La pantalla de entrada ---
  await pagina.goto(`${ORIGEN}/login`);
  await pagina.waitForSelector(".login__tarjeta");
  await capturar(pagina, "login");

  // --- 02. Credenciales equivocadas ---
  await pagina.fill("#correo", EMPRESA.correo);
  await pagina.fill("#contrasena", "ClaveEquivocada1*");
  await pagina.click('button[type="submit"]');
  await pagina.waitForSelector('[role="alert"]');
  await capturar(pagina, "login-credenciales-invalidas");

  // --- 03. La gestion de usuarios ---
  await entrar(pagina, ADMIN);
  await pagina.waitForURL(/usuarios/);
  await pagina.waitForSelector(".tabla tbody tr");
  await capturar(pagina, "usuarios-listado");

  // --- 04. El detalle de una cuenta (GET /usuarios/:id) ---
  await pagina.locator('.tabla tbody tr:nth-child(2) button:has-text("Ver")').click();
  await pagina.waitForSelector(".detalle");
  await capturar(pagina, "usuarios-detalle");

  await pagina.locator('.detalle button:has-text("Cerrar")').click();

  // --- 05. El formulario de alta (POST /usuarios) ---
  await pagina.locator('button:has-text("Nueva cuenta")').click();
  await pagina.waitForSelector(".formulario");
  await pagina.fill('input[name="nombre"]', PRUEBA.nombre);
  await pagina.fill('input[name="correo"]', PRUEBA.correo);
  await pagina.fill('input[name="contrasena"]', PRUEBA.contrasena);
  await capturar(pagina, "usuarios-formulario-alta");

  await pagina.locator('.formulario button[type="submit"]').click();
  await pagina.waitForSelector('[role="status"]');

  const fila = pagina.locator(".tabla tbody tr", { hasText: PRUEBA.nombre });

  // --- 06. Creada (PUT y PATCH sobre ella) ---
  await capturar(pagina, "usuarios-cuenta-creada");

  await fila.locator('button:has-text("Restringir")').click();
  await pagina.waitForSelector('[role="status"]');
  await capturar(pagina, "usuarios-cuenta-restringida");

  // Se deja la base como estaba
  await fila.locator('button:has-text("Eliminar")').click();
  await pagina.waitForSelector('[role="status"]');

  // --- 07. El listado en movil ---
  const movil = await navegador.newPage({ viewport: MOVIL });

  movil.on("dialog", (dialogo) => dialogo.accept());

  await entrar(movil, ADMIN);
  await movil.waitForURL(/usuarios/);
  await movil.waitForSelector(".tabla tbody tr");
  await capturar(movil, "usuarios-movil");

  // --- 08. Acceso denegado, con una cuenta de empresa ---
  const empresa = await navegador.newPage({ viewport: ESCRITORIO });

  await entrar(empresa, EMPRESA);
  await empresa.waitForURL((url) => !url.pathname.startsWith("/login"));
  await empresa.goto(`${ORIGEN}/usuarios`);
  await empresa.waitForURL(/acceso-denegado/);
  await capturar(empresa, "acceso-denegado");

  await navegador.close();

  console.log(`\n  ${n} capturas en evidencias/guia-02/`);
})();
