// Arma el HTML del documento a partir de contenido.js y estilos.css.
//
// El HTML era antes la fuente del texto; ahora es una salida mas, como el PDF
// y el Word, para que las tres digan lo mismo sin copiarse unas a otras.

const path = require("node:path");
const fs = require("node:fs");

const { portada, cuerpo } = require("./contenido.js");

const ESTILOS = path.join(__dirname, "estilos.css");

/** Escapa lo que podria romper el HTML. */
function escapar(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Las mismas marcas que entiende el Word: *negrita* y `codigo`. */
function marcar(texto) {
  return escapar(texto)
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function figura({ archivo, titulo, texto, estrecha }) {
  return [
    `  <figure class="captura${estrecha ? " estrecha" : ""}">`,
    `    <img src="PANTALLAS/${archivo}" alt="${escapar(titulo)}">`,
    `    <figcaption><b>${marcar(titulo)}.</b> ${marcar(texto)}</figcaption>`,
    "  </figure>"
  ].join("\n");
}

function tabla({ anchos, cabeceras, filas }) {
  const lineas = ['  <table class="datos">'];

  // Los anchos van en la primera fila: la ultima columna se queda con lo que
  // sobre, que es como estaban escritas las tablas a mano.
  const ancho = (i) => (i < anchos.length - 1 ? ` style="width:${anchos[i]}%"` : "");

  if (cabeceras) {
    lineas.push("    <tr>");
    cabeceras.forEach((c, i) => lineas.push(`      <th${ancho(i)}>${marcar(c)}</th>`));
    lineas.push("    </tr>");
  }

  filas.forEach((fila, f) => {
    lineas.push("    <tr>");

    fila.forEach((celda, i) => {
      // Sin cabeceras, la primera columna hace de etiqueta.
      const texto = !cabeceras && i === 0 ? `<b>${marcar(celda)}</b>` : marcar(celda);
      const estilo = !cabeceras && f === 0 ? ancho(i) : "";

      lineas.push(`      <td${estilo}>${texto}</td>`);
    });

    lineas.push("    </tr>");
  });

  lineas.push("  </table>");

  return lineas.join("\n");
}

function construir() {
  const partes = [];

  // --- la portada ---
  partes.push('<div class="portada">');
  partes.push(`  <p class="portada__marca">${escapar(portada.marca)}</p>`);
  partes.push(`  <h1>${escapar(portada.titulo)}</h1>`);
  partes.push(`  <p class="portada__sub">${escapar(portada.subtitulo)}</p>`);
  partes.push('  <table class="portada__datos">');

  for (const [clave, valor] of portada.datos) {
    partes.push(`    <tr><td>${escapar(clave)}</td><td>${escapar(valor)}</td></tr>`);
  }

  partes.push("  </table>");
  partes.push(`  <p class="portada__pie">${portada.pie.map(marcar).join("<br>\n    ")}</p>`);
  partes.push("</div>");

  // --- el cuerpo ---
  //
  // Un "salto" abre seccion nueva, que en el CSS empieza en pagina nueva. Las
  // capturas en pareja se agrupan en el <div class="dos"> que las pone a dos
  // columnas, y el grupo se cierra en cuanto llega algo que no es pareja.
  let enSeccion = false;
  let enPareja = false;

  const cerrarPareja = () => {
    if (enPareja) { partes.push("  </div>"); enPareja = false; }
  };

  const abrirSeccion = () => {
    if (!enSeccion) { partes.push("<section>"); enSeccion = true; }
  };

  for (const pieza of cuerpo) {
    if (pieza.t === "salto") {
      cerrarPareja();
      if (enSeccion) partes.push("</section>");
      enSeccion = false;
      continue;
    }

    abrirSeccion();

    if (pieza.t === "captura" && pieza.pareja) {
      if (!enPareja) { partes.push('  <div class="dos">'); enPareja = true; }
      partes.push(figura(pieza));
      continue;
    }

    cerrarPareja();

    switch (pieza.t) {
      case "h2": partes.push(`  <h2>${marcar(pieza.v)}</h2>`); break;
      case "h3": partes.push(`  <h3>${marcar(pieza.v)}</h3>`); break;
      case "p": partes.push(`  <p>${marcar(pieza.v)}</p>`); break;
      case "nota": partes.push(`  <div class="nota">${marcar(pieza.v)}</div>`); break;
      case "pre": partes.push(`  <pre>${pieza.v.map(escapar).join("\n")}</pre>`); break;
      case "tabla": partes.push(tabla(pieza)); break;
      case "captura": partes.push(figura(pieza)); break;
      default: throw new Error(`tipo desconocido: ${pieza.t}`);
    }
  }

  cerrarPareja();
  if (enSeccion) partes.push("</section>");

  return [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapar(portada.titulo)} — Frontend React</title>`,
    "<style>",
    fs.readFileSync(ESTILOS, "utf8").trimEnd(),
    "</style>",
    "</head>",
    "<body>",
    "",
    partes.join("\n"),
    "",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

module.exports = { construir };
