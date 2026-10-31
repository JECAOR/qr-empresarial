// GENERAR-WORD.JS — el documento de evidencias en Word (.docx)
//
// Sale del mismo contenido.js que el PDF, de modo que los dos digan lo mismo.
// Se arma con docx-js y no convirtiendo el HTML porque asi las tablas y las
// capturas quedan como objetos de Word de verdad y se pueden editar.
//
// docx no es una dependencia del proyecto: es una herramienta de un solo uso
// para esta carpeta, y meterla en el package.json del frontend seria meter en
// su arbol algo que no tiene nada que ver con la aplicacion.
//
//   npm install docx            (en esta carpeta)
//   node frontend-react/evidencias/documento/generar-word.js

const path = require("node:path");
const fs = require("node:fs");

let docx;

try {
  docx = require("docx");
} catch {
  console.error("  Falta la libreria docx. Instalela en esta carpeta:\n");
  console.error("    cd frontend-react/evidencias/documento && npm install docx\n");
  process.exit(1);
}

const {
  Document, Packer, Paragraph, TextRun, PageBreak,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ImageRun, HeadingLevel, AlignmentType, Footer, PageNumber, TabStopType
} = docx;

const { portada: datos, cuerpo: contenido } = require("./contenido.js");

const EVIDENCIAS = path.join(__dirname, "..");
const PANTALLAS = path.join(EVIDENCIAS, "pantallas");
const SALIDA = path.join(EVIDENCIAS, "Evidencias-Frontend-React-JCOH.docx");

// A4 son 11906 twips de ancho. Con margenes de 16 mm (907) quedan 10092 para
// el texto, que a 96 ppp son 672 px: el ancho maximo de una captura.
const MARGEN = 907;
const ANCHO_TEXTO = 11906 - MARGEN * 2;
const ANCHO_PX = 672;
const ALTO_MAX_PX = 586; // 155 mm, para que una captura alta no parta la pagina

const TINTA = "1F2937";
const AZUL = "1D4ED8";
const GRIS = "556880";
const FONDO = "F1F5F9";

// ------------------------------------------------------------------ utilidades

/** Lee ancho y alto de la cabecera IHDR de un PNG, sin dependencias. */
function medidasPng(archivo) {
  const buffer = fs.readFileSync(archivo);

  return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) };
}

/**
 * Parte el texto en fragmentos segun las marcas *negrita* y `codigo`.
 * El contenido se escribe con esas marcas para que la version en Word y la
 * del HTML digan lo mismo sin duplicar el texto.
 */
function fragmentos(texto, base = {}) {
  const trozos = [];
  const partes = texto.split(/(\*[^*]+\*|`[^`]+`)/g);

  for (const parte of partes) {
    if (!parte) continue;

    if (parte.startsWith("*") && parte.endsWith("*")) {
      trozos.push(new TextRun({ ...base, text: parte.slice(1, -1), bold: true }));
    } else if (parte.startsWith("`") && parte.endsWith("`")) {
      trozos.push(new TextRun({
        ...base, text: parte.slice(1, -1), font: "Consolas", size: 18, color: "9A3412"
      }));
    } else {
      trozos.push(new TextRun({ ...base, text: parte }));
    }
  }

  return trozos;
}

function parrafo(texto, extra = {}) {
  return new Paragraph({
    children: fragmentos(texto),
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 300 },
    ...extra
  });
}

/** El recuadro de las notas: una celda con fondo y una barra azul a la izquierda. */
function nota(texto) {
  return new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [ANCHO_TEXTO],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.SINGLE, size: 18, color: AZUL },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: ANCHO_TEXTO, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: FONDO, color: "auto" },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        children: [new Paragraph({
          children: fragmentos(texto, { size: 19 }),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 280 }
        })]
      })]
    })]
  });
}

/** Un bloque monoespaciado. Cada linea es su propio parrafo: nunca "\n". */
function bloque(lineas) {
  const parrafos = lineas.map((linea, i) => new Paragraph({
    children: [new TextRun({
      text: linea || " ", font: "Consolas", size: 16, color: TINTA
    })],
    spacing: { after: i === lineas.length - 1 ? 0 : 20, line: 240 },
    indent: { left: 160 }
  }));

  return new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [ANCHO_TEXTO],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: ANCHO_TEXTO, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "F8FAFC", color: "auto" },
        margins: { top: 140, bottom: 140, left: 120, right: 120 },
        children: parrafos
      })]
    })]
  });
}

/**
 * Una tabla. Los anchos llegan en porcentaje pero se escriben en DXA: con
 * PERCENTAGE, Google Docs y algunos visores la rompen.
 */
function tabla({ anchos, cabeceras, filas }) {
  const columnas = anchos.map((p) => Math.round(ANCHO_TEXTO * p / 100));

  // El redondeo tiene que cuadrar con el ancho de la tabla o Word reparte el
  // sobrante a su manera.
  columnas[columnas.length - 1] += ANCHO_TEXTO - columnas.reduce((a, b) => a + b, 0);

  // Word no tiene una propiedad "no partas esta tabla": se consigue pegando
  // cada fila a la siguiente. Solo se hace con las tablas cortas, porque en una
  // larga obligaria a dejar paginas medio vacias.
  const juntas = filas.length + (cabeceras ? 1 : 0) <= 6;

  // Cada celda nace con el ancho que le toca: docx-js no lo deja cambiar luego.
  const construir = (valores, { negrita = false, fondo = null, pegar = false } = {}) =>
    new TableRow({
      tableHeader: negrita || undefined,
      cantSplit: true, // que una fila no se parta a media celda
      children: valores.map((texto, i) => new TableCell({
        width: { size: columnas[i], type: WidthType.DXA },
        shading: fondo
          ? { type: ShadingType.CLEAR, fill: fondo, color: "auto" }
          : undefined,
        margins: { top: 90, bottom: 90, left: 120, right: 120 },
        children: [new Paragraph({
          children: fragmentos(texto, { size: 18, bold: negrita || undefined }),
          spacing: { line: 260 },
          keepNext: pegar || undefined
        })]
      }))
    });

  const rows = [];

  if (cabeceras) {
    rows.push(construir(cabeceras, { negrita: true, fondo: FONDO, pegar: juntas }));
  }

  filas.forEach((f, i) => {
    rows.push(construir(f, { pegar: juntas && i < filas.length - 1 }));
  });

  return new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: columnas,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" }
    },
    rows
  });
}

/** Una captura con su titulo y su pie. */
function captura({ archivo, titulo, texto, estrecha }, caja = ANCHO_PX) {
  const ruta = path.join(PANTALLAS, archivo);

  if (!fs.existsSync(ruta)) {
    throw new Error(`falta la captura ${archivo}`);
  }

  const { ancho, alto } = medidasPng(ruta);

  // Se encaja por ancho, salvo que al hacerlo se pase de alto: la captura de
  // movil es 390x1180 y ocupando los 672 px de ancho se partiria en dos
  // paginas, que es lo que paso con el PDF.
  let w = Math.min(caja, ancho);
  let h = Math.round(alto * w / ancho);

  const tope = estrecha ? ALTO_MAX_PX : Math.round(ALTO_MAX_PX * caja / ANCHO_PX);

  if (h > tope) {
    h = Math.min(tope, alto);
    w = Math.round(ancho * h / alto);
  }

  return [
    // El titulo va pegado a su captura y la captura a su pie: si no, Word deja
    // el titulo solo al final de una pagina y la imagen en la siguiente.
    new Paragraph({
      children: [new TextRun({ text: titulo, bold: true, size: 19, color: AZUL })],
      spacing: { before: 200, after: 100 },
      keepNext: true
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      keepNext: true,
      children: [new ImageRun({
        type: "png",
        data: fs.readFileSync(ruta),
        transformation: { width: w, height: h }
      })]
    }),
    new Paragraph({
      children: fragmentos(texto, { size: 17, color: GRIS, italics: true }),
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 }
    })
  ];
}

/**
 * Las capturas marcadas como pareja van a dos columnas, igual que en el PDF:
 * son formularios cortos y a pagina entera cada una dejaria media hoja vacia.
 * En Word las dos columnas se hacen con una tabla sin bordes.
 */
function parejas(lista) {
  const media = Math.floor(ANCHO_TEXTO / 2);
  const cajaPx = Math.floor(ANCHO_PX / 2) - 16; // menos el margen entre celdas

  const sinBorde = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  const filas = [];

  for (let i = 0; i < lista.length; i += 2) {
    filas.push(new TableRow({
      cantSplit: true,
      children: [lista[i], lista[i + 1]].map((pieza) => new TableCell({
        width: { size: media, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 0, right: 160 },
        children: pieza ? captura(pieza, cajaPx) : [new Paragraph({ text: "" })]
      }))
    }));
  }

  return new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [media, ANCHO_TEXTO - media],
    borders: {
      top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde,
      insideHorizontal: sinBorde, insideVertical: sinBorde
    },
    rows: filas
  });
}

// -------------------------------------------------------------------- portada

function portada() {
  const linea = (texto, extra = {}) => new Paragraph({
    children: [new TextRun({ text: texto, ...extra.run })],
    alignment: AlignmentType.CENTER,
    spacing: extra.spacing
  });

  return [
    new Paragraph({ text: "", spacing: { after: 1400 } }),

    linea(datos.marca, {
      run: { bold: true, size: 19, color: AZUL, characterSpacing: 30 },
      spacing: { after: 220 }
    }),

    linea(datos.titulo, {
      run: { bold: true, size: 52, color: TINTA },
      spacing: { after: 160 }
    }),

    linea(datos.subtitulo, {
      run: { size: 26, color: GRIS },
      spacing: { after: 1200 }
    }),

    new Table({
      width: { size: 6600, type: WidthType.DXA },
      columnWidths: [2400, 4200],
      alignment: AlignmentType.CENTER,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
      },
      rows: datos.datos.map(([clave, valor]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            margins: { top: 100, bottom: 100, left: 0, right: 160 },
            children: [new Paragraph({
              children: [new TextRun({ text: clave, size: 18, color: GRIS, bold: true })]
            })]
          }),
          new TableCell({
            width: { size: 4200, type: WidthType.DXA },
            margins: { top: 100, bottom: 100, left: 0, right: 0 },
            children: [new Paragraph({
              children: [new TextRun({ text: valor, size: 19, color: TINTA })]
            })]
          })
        ]
      }))
    }),

    new Paragraph({ text: "", spacing: { after: 700 } }),

    ...datos.pie.map((texto, i) => new Paragraph({
      children: fragmentos(texto, { size: 17, color: GRIS }),
      alignment: AlignmentType.CENTER,
      spacing: { after: i === datos.pie.length - 1 ? 0 : 60 }
    })),

    new Paragraph({ children: [new PageBreak()] })
  ];
}

// ------------------------------------------------------------------ el montaje

const cuerpo = [...portada()];

let grupo = [];

contenido.forEach((pieza, i) => {
  // Un parrafo que presenta una tabla, un recuadro o un bloque va pegado a el:
  // si no, Word los separa y deja media pagina en blanco entre los dos.
  const presenta = ["tabla", "nota", "pre"].includes(contenido[i + 1]?.t);

  // Las capturas en pareja se juntan todas y se sueltan de golpe cuando se
  // acaba el grupo, porque las dos columnas son una sola tabla.
  if (pieza.t === "captura" && pieza.pareja) {
    grupo.push(pieza);

    const sigue = contenido[i + 1];

    if (!(sigue?.t === "captura" && sigue.pareja)) {
      cuerpo.push(parejas(grupo));
      cuerpo.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      grupo = [];
    }

    return;
  }

  switch (pieza.t) {
    case "h2":
      cuerpo.push(new Paragraph({
        children: [new TextRun({ text: pieza.v, bold: true, size: 32, color: TINTA })],
        heading: HeadingLevel.HEADING_1,
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 10, color: AZUL, space: 6 }
        },
        spacing: { before: 0, after: 300 },
        keepNext: true
      }));
      break;

    case "h3":
      cuerpo.push(new Paragraph({
        children: [new TextRun({ text: pieza.v, bold: true, size: 23, color: AZUL })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 140 },
        keepNext: true
      }));
      break;

    case "p":
      cuerpo.push(parrafo(pieza.v, { keepNext: presenta || undefined }));
      break;

    case "nota":
      cuerpo.push(nota(pieza.v));
      cuerpo.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      break;

    case "pre":
      cuerpo.push(bloque(pieza.v));
      cuerpo.push(new Paragraph({ text: "", spacing: { after: 160 } }));
      break;

    case "tabla":
      cuerpo.push(tabla(pieza));
      cuerpo.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      break;

    case "captura":
      cuerpo.push(...captura(pieza));
      break;

    case "salto":
      cuerpo.push(new Paragraph({ children: [new PageBreak()] }));
      break;

    default:
      throw new Error(`tipo desconocido: ${pieza.t}`);
  }
});

const documento = new Document({
  creator: "Jean Carlos Orozco Hernández",
  title: "QR Empresarial · Frontend en React · Evidencias",
  description: "Evidencia de desarrollo del frontend en React. Ficha 3336250.",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 21, color: TINTA } }
    }
  },
  sections: [{
    properties: {
      page: { margin: { top: 1020, bottom: 1020, left: MARGEN, right: MARGEN } }
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: ANCHO_TEXTO }],
          children: [
            new TextRun({
              text: "QR Empresarial · Frontend React · JCOH · Ficha 3336250",
              size: 15, color: GRIS
            }),
            new TextRun({ text: "\t", size: 15 }),
            new TextRun({ children: [PageNumber.CURRENT], size: 15, color: GRIS })
          ]
        })]
      })
    },
    children: cuerpo
  }]
});

Packer.toBuffer(documento).then((buffer) => {
  fs.writeFileSync(SALIDA, buffer);

  console.log(`  Word generado: ${Math.round(buffer.length / 1024)} KB`);
  console.log(`  ${SALIDA}`);
});
