// ============================================
// GENERAR-CAPTURAS.JS — evidencia de funcionamiento
//
// Recorre las doce pantallas contra el servidor de verdad, con los datos que
// siembra database/seed.sql, y guarda una captura de cada una.
//
// No usa la API simulada a proposito: estas imagenes son la evidencia de que
// los modulos funcionan, y una pantalla dibujada con datos inventados no
// demuestra nada. Lo que se ve aqui sale de MySQL.
//
//   1. mysql -u root -p qr_empresarial < database/seed.sql
//   2. cd backend && npm run dev
//   3. node docs/evidencias/generar-capturas.js
//
// Las capturas se sobrescriben en cada ejecucion.
// ============================================

const path = require('node:path');
const fs = require('node:fs/promises');

const { chromium } = require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'playwright'));

const ORIGEN = process.env.ORIGEN || 'http://localhost:3000';
const DESTINO = path.join(__dirname, 'capturas');

const EMPRESA = { correo: 'contacto@laespiga.co', contrasena: 'Clave123*' };
const ADMIN = { correo: 'admin@caferaices.co', contrasena: 'Clave123*' };

const ESCRITORIO = { width: 1440, height: 900 };
const MOVIL = { width: 390, height: 844 };

let n = 0;

/** Guarda una captura numerada, para que el orden se lea en el nombre. */
async function capturar(pagina, nombre, completa = true) {
  n += 1;

  const archivo = path.join(DESTINO, `${String(n).padStart(2, '0')}-${nombre}.png`);

  await pagina.screenshot({ path: archivo, fullPage: completa });

  console.log(`  ${String(n).padStart(2, '0')}  ${nombre}`);
}

/** Entra con una cuenta y deja la sesion lista. */
async function entrar(pagina, cuenta) {
  await pagina.goto(`${ORIGEN}/login.html`);
  await pagina.fill('#email', cuenta.correo);
  await pagina.fill('#password', cuenta.contrasena);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL(/dashboard\.html/, { timeout: 15000 });
}

/** Da tiempo a que lleguen los datos de la API antes de la foto. */
async function asentar(pagina, ms = 1500) {
  await pagina.waitForLoadState('networkidle').catch(() => {});
  await pagina.waitForTimeout(ms);
}

(async () => {
  await fs.mkdir(DESTINO, { recursive: true });

  const navegador = await chromium.launch();

  // --- Pantallas publicas (modulo 1) ---
  const publico = await navegador.newPage({ viewport: ESCRITORIO });

  for (const [ruta, nombre] of [
    ['/login.html', 'login'],
    ['/register.html', 'registro'],
    ['/forgot-password.html', 'recuperar-contrasena'],
    ['/restablecer.html?token=enlace-de-ejemplo', 'restablecer-enlace-invalido'],
    ['/404.html', '404']
  ]) {
    await publico.goto(ORIGEN + ruta);
    await asentar(publico, 800);
    await capturar(publico, nombre);
  }

  // --- Panel de la empresa (modulos 2, 3, 4, 6 y 7) ---
  const empresa = await navegador.newPage({ viewport: ESCRITORIO });

  await entrar(empresa, EMPRESA);
  await asentar(empresa);
  await capturar(empresa, 'dashboard-estadisticas');

  for (const [ruta, nombre] of [
    ['/contenido.html', 'contenido'],
    ['/qr.html', 'codigo-qr'],
    ['/configuracion.html', 'configuracion']
  ]) {
    await empresa.goto(ORIGEN + ruta);
    await asentar(empresa);
    await capturar(empresa, nombre);
  }

  // --- Vista publica, que es lo que ve quien escanea (modulo 5) ---
  const visitante = await navegador.newPage({ viewport: MOVIL });

  await visitante.goto(`${ORIGEN}/p/panaderia-la-espiga`);
  await asentar(visitante);
  await capturar(visitante, 'vista-publica-movil');

  await visitante.goto(`${ORIGEN}/menu.html?slug=panaderia-la-espiga`);
  await asentar(visitante);
  await capturar(visitante, 'menu-movil');

  // --- Administracion (modulo 8) ---
  const admin = await navegador.newPage({ viewport: ESCRITORIO });

  await entrar(admin, ADMIN);
  await admin.goto(`${ORIGEN}/admin.html`);
  await asentar(admin);
  await capturar(admin, 'administracion');

  // El detalle de una cuenta, que es lo que la tabla no puede mostrar
  await admin.locator('.admin-tabla tbody tr [data-accion="detalle"]').first().click();
  await admin.waitForTimeout(1200);
  await capturar(admin, 'administracion-detalle', false);

  // --- El panel en movil, para evidenciar el diseno adaptable ---
  const movil = await navegador.newPage({ viewport: MOVIL });

  await entrar(movil, EMPRESA);
  await asentar(movil);
  await capturar(movil, 'dashboard-movil');

  await navegador.close();

  console.log(`\n  ${n} capturas en docs/evidencias/capturas/`);
})();
