// ============================================
// GENERAR-CAPTURAS.JS — las trece pantallas del frontend en React
//
// Recorre la aplicación entera como lo haría una persona, contra el servidor
// de verdad y con los datos de database/seed.sql. No usa datos simulados: una
// pantalla dibujada con cifras inventadas no demuestra nada.
//
// Crea una cuenta de prueba para las pantallas que la necesitan y la elimina
// al terminar, de modo que deja la base como la encontró.
//
//   1. mysql -u root -p --default-character-set=utf8mb4 qr_empresarial < database/seed.sql
//   2. cd backend && npm run dev
//   3. cd frontend-react && npm run dev
//   4. node frontend-react/evidencias/generar-capturas.js
// ============================================

import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, "..", "..");

const { chromium } = require(path.join(RAIZ, "frontend", "node_modules", "playwright"));

const ORIGEN = process.env.ORIGEN || "http://localhost:5173";
const API = process.env.API || "http://localhost:3000/api";

const EMPRESA = { correo: "contacto@laespiga.co", contrasena: "Clave123*" };
const ADMIN = { correo: "admin@caferaices.co", contrasena: "Clave123*" };

const ESCRITORIO = { width: 1180, height: 900 };
const MOVIL = { width: 390, height: 844 };

const DESTINO = path.join(__dirname, "pantallas");

let n = 0;

async function capturar(pagina, nombre, completa = true) {
  n += 1;

  await pagina.screenshot({
    path: path.join(DESTINO, `${String(n).padStart(2, "0")}-${nombre}.png`),
    fullPage: completa
  });

  console.log(`  ${String(n).padStart(2, "0")}  ${nombre}`);
}

/** Entra por el formulario, como una persona. */
async function entrar(pagina, cuenta) {
  await pagina.goto(`${ORIGEN}/login`);
  await pagina.fill("#correo", cuenta.correo);
  await pagina.fill("#contrasena", cuenta.contrasena);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Espera a que lleguen los datos antes de la foto. */
async function asentar(pagina, ms = 900) {
  await pagina.waitForLoadState("networkidle").catch(() => {});
  await pagina.waitForTimeout(ms);
}

(async () => {
  await fs.mkdir(DESTINO, { recursive: true });

  const navegador = await chromium.launch();

  // --- Pantallas de cuenta, sin sesión (módulo 1) ---
  const visitante = await navegador.newPage({ viewport: ESCRITORIO });

  await visitante.goto(`${ORIGEN}/login`);
  await asentar(visitante);
  await capturar(visitante, "login");

  await visitante.goto(`${ORIGEN}/registro`);
  await asentar(visitante);
  await capturar(visitante, "registro");

  await visitante.goto(`${ORIGEN}/recuperar`);
  await asentar(visitante);
  await capturar(visitante, "recuperar-contrasena");

  await visitante.goto(`${ORIGEN}/restablecer?token=enlace-de-ejemplo-que-no-existe`);
  await visitante.waitForSelector('[role="alert"]');
  await capturar(visitante, "restablecer-enlace-invalido");

  // La portada pública no pide sesión: es lo que ve quien escanea el código
  await visitante.goto(ORIGEN);
  await asentar(visitante);
  await capturar(visitante, "perfil-publico");

  await visitante.goto(`${ORIGEN}/una-direccion-que-no-existe`);
  await asentar(visitante, 500);
  await capturar(visitante, "pagina-no-encontrada");

  // --- Panel de la empresa (módulos 2, 3, 4, 6 y 7) ---
  const empresa = await navegador.newPage({ viewport: ESCRITORIO });

  empresa.on("dialog", (dialogo) => dialogo.accept());

  await entrar(empresa, EMPRESA);

  for (const [ruta, nombre, espera] of [
    ["/perfil", "perfil-del-negocio", ".ficha__nombre, .panel__titulo"],
    ["/contenido", "contenido", ".bloque"],
    ["/codigo-qr", "codigo-qr", ".qr__lienzo img"],
    // La gráfica solo se dibuja si hubo actividad en el periodo. Si la
    // semilla lleva tiempo cargada, sus eventos caen fuera de los siete días
    // y sale el aviso en su lugar: se espera por cualquiera de los dos para
    // que el guion no se quede colgado, y se avisa al final.
    ["/actividad", "actividad", ".grafica__lienzo, .vacio"],
    ["/configuracion", "configuracion", ".interruptor"]
  ]) {
    await empresa.goto(ORIGEN + ruta);
    await empresa.waitForSelector(espera, { timeout: 15000 });
    await asentar(empresa);
    await capturar(empresa, nombre);
  }

  // --- Administración (módulos 8 y el CRUD de la Guía 02) ---
  const admin = await navegador.newPage({ viewport: ESCRITORIO });

  admin.on("dialog", (dialogo) => dialogo.accept());

  await entrar(admin, ADMIN);

  await admin.goto(`${ORIGEN}/usuarios`);
  await admin.waitForSelector(".tabla tbody tr");
  await asentar(admin);
  await capturar(admin, "gestion-de-usuarios");

  await admin.goto(`${ORIGEN}/administracion`);
  await admin.waitForSelector(".tabla tbody tr");
  await asentar(admin);
  await capturar(admin, "administracion");

  // El detalle, que es lo que la tabla no cabe
  await admin.locator('.tabla tbody tr:nth-child(2) button:has-text("Ver")').click();
  await admin.waitForSelector(".detalle-cuenta");
  await admin.waitForTimeout(900);
  await capturar(admin, "administracion-detalle", false);

  // --- Acceso denegado: una empresa en una ruta de administrador ---
  await empresa.goto(`${ORIGEN}/administracion`);
  await empresa.waitForURL(/acceso-denegado/);
  await asentar(empresa, 500);
  await capturar(empresa, "acceso-denegado");

  // --- El panel en móvil, para evidenciar el diseño adaptable ---
  const movil = await navegador.newPage({ viewport: MOVIL });

  await entrar(movil, EMPRESA);
  await movil.goto(`${ORIGEN}/contenido`);
  await movil.waitForSelector(".bloque");
  await asentar(movil);
  await capturar(movil, "contenido-movil");

  // Si la gráfica salió vacía, la culpa es de la semilla y no de la pantalla.
  // Se comprueba ANTES de cerrar el navegador: con las páginas cerradas la
  // navegación falla siempre y el aviso saldría aunque los datos estuvieran
  // bien, que es lo que pasó la primera vez.
  const hayGrafica = await empresa.goto(`${ORIGEN}/actividad`)
    .then(() => empresa.waitForSelector(".grafica__lienzo", { timeout: 6000 }))
    .then(() => true)
    .catch(() => false);

  await navegador.close();

  console.log(`\n  ${n} capturas en evidencias/pantallas/`);

  if (!hayGrafica) {
    console.log("\n  AVISO: la gráfica salió sin datos. Los eventos de seed.sql");
    console.log("  son relativos al día en que se cargó; vuelva a ejecutarlo:");
    console.log("    mysql -u root -p --default-character-set=utf8mb4 \\");
    console.log("      qr_empresarial < database/seed.sql");
  }

  console.log(`\n  API: ${API}`);
})();
