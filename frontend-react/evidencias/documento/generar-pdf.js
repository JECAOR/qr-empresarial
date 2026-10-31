// GENERAR-PDF.JS — el documento de evidencias en PDF
//
// Arma el HTML desde contenido.js, le incrusta las capturas y lo imprime con
// el Chromium de Playwright, el mismo que ya usa el proyecto para sus pruebas:
// asi no hace falta ninguna dependencia nueva. Se hace con un navegador y no
// con una libreria de PDF porque el documento lleva tildes, tablas y dieciseis
// capturas, y el navegador ya sabe maquetar eso.
//
// Deja tambien evidencias.html, que es el mismo documento para mirarlo en el
// navegador. Ese archivo es una salida, no la fuente: el texto esta en
// contenido.js y de ahi salen tanto este PDF como el Word.
const path = require("node:path");
const fs = require("node:fs/promises");

const EVIDENCIAS = path.join(__dirname, "..");
const RAIZ = path.join(EVIDENCIAS, "..", "..");

const { chromium } = require(path.join(RAIZ, "frontend", "node_modules", "playwright"));
const { construir } = require("./generar-html.js");

const PANTALLAS = path.join(EVIDENCIAS, "pantallas");
const HTML = path.join(__dirname, "evidencias.html");
const SALIDA = path.join(EVIDENCIAS, "Evidencias-Frontend-React-JCOH.pdf");

(async () => {
  const html = construir();

  await fs.writeFile(HTML, html, "utf8");

  // Las capturas se incrustan en base64: asi el PDF no depende de rutas y
  // Chromium no tiene que resolver archivos locales desde el HTML.
  let conImagenes = html;

  for (const archivo of await fs.readdir(PANTALLAS)) {
    const datos = await fs.readFile(path.join(PANTALLAS, archivo));

    conImagenes = conImagenes.replaceAll(
      `PANTALLAS/${archivo}`,
      `data:image/png;base64,${datos.toString("base64")}`
    );
  }

  const faltan = conImagenes.match(/PANTALLAS\/[^"]+/g);

  if (faltan) {
    console.log("  AVISO: faltan estas capturas:", [...new Set(faltan)].join(", "));
  }

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();

  await pagina.setContent(conImagenes, { waitUntil: "networkidle" });

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
        <span>QR Empresarial &middot; Frontend React &middot; JCOH &middot; Ficha 3336250</span>
        <span class="pageNumber"></span>
      </div>`,
    margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" }
  });

  await navegador.close();

  const { size } = await fs.stat(SALIDA);

  console.log(`  PDF generado: ${Math.round(size / 1024)} KB`);
  console.log(`  ${SALIDA}`);
})();
