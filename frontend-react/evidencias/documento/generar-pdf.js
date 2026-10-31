// Renderiza el documento de evidencias a PDF con el Chromium de Playwright.
//
// Se hace asi y no con una libreria de PDF porque el documento lleva tildes,
// tablas y dieciseis capturas: el navegador ya sabe maquetar eso.
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROYECTO = "C:/Users/jeano/OneDrive - OROZCO S.A.S/Escritorio/qr-empresarial";
const { chromium } = require(path.join(PROYECTO, "frontend", "node_modules", "playwright"));

const FUENTE = path.join(__dirname, "evidencias.html");
const SALIDA = path.join(PROYECTO, "frontend-react", "evidencias",
  "Evidencias-Frontend-React-JCOH.pdf");

const PANTALLAS = path.join(PROYECTO, "frontend-react", "evidencias", "pantallas");

(async () => {
  // Las capturas se incrustan en base64: asi el PDF no depende de rutas y
  // Chromium no tiene que resolver archivos locales desde el HTML.
  let html = await fs.readFile(FUENTE, "utf8");

  const archivos = await fs.readdir(PANTALLAS);

  for (const archivo of archivos) {
    const datos = await fs.readFile(path.join(PANTALLAS, archivo));

    html = html.replaceAll(
      `PANTALLAS/${archivo}`,
      `data:image/png;base64,${datos.toString("base64")}`
    );
  }

  const faltan = html.match(/PANTALLAS\/[^"]+/g);

  if (faltan) {
    console.log("  AVISO: faltan estas capturas:", [...new Set(faltan)].join(", "));
  }

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();

  await pagina.setContent(html, { waitUntil: "networkidle" });

  await pagina.pdf({
    path: SALIDA,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `
      <div style="width:100%;font-family:'Segoe UI',sans-serif;font-size:7.5pt;
                  color:#556880;padding:0 16mm;display:flex;
                  justify-content:space-between;">
        <span>QR Empresarial · Frontend React · JCOH · Ficha 3336250</span>
        <span class="pageNumber"></span>
      </div>`,
    margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" }
  });

  await navegador.close();

  const { size } = await fs.stat(SALIDA);

  console.log(`  PDF generado: ${Math.round(size / 1024)} KB`);
  console.log(`  ${SALIDA}`);
})();
