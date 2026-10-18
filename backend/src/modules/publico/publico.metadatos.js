// ============================================
// PUBLICO.METADATOS.JS — las etiquetas de vista previa de /p/:slug (RF-09)
//
// Open Graph, Twitter Card y Schema.org estaban escritas a mano en
// public.html con los datos del negocio de ejemplo, y el navegador no las
// corrige: los robots que generan la vista previa —WhatsApp, Telegram,
// Google— no ejecutan JavaScript, así que leen lo que venga en el HTML.
//
// Resultado: una panadería de Bogotá compartía su enlace y salía
// «Fonda La Cosecha — Bandeja paisa, sancocho…», un restaurante de Medellín.
// Y el bloque de Schema.org declaraba una calificación de 4,6 estrellas con
// 215 reseñas para cualquier negocio que publicara su perfil. Eso ya no es
// solo un dato de ejemplo mal puesto: es una reseña inventada, legible por
// máquinas, adosada a un negocio real.
//
// El propio HTML lo daba por limitación conocida —«con un backend real, el
// servidor podría generarlas dinámicamente»— y ese backend lleva tres
// módulos existiendo.
// ============================================

const fs = require('node:fs/promises');

const publicoService = require('./publico.service');

// Lo que se muestra cuando no hay perfil que mostrar: un slug mal escrito,
// un código apagado o una cuenta restringida. Es a propósito lo mismo en los
// tres casos, igual que hace la API: decir «existe pero está suspendido» no
// es asunto de quien escanea.
const NEUTRAL = {
  titulo: 'Perfil no disponible · QR Empresarial',
  descripcion: 'Este perfil no está disponible.'
};

/**
 * Escapa un valor para meterlo en un atributo HTML.
 *
 * Es lo primero que hay que resolver aquí: el nombre del negocio lo escribe
 * una persona y acaba dentro de content="…". Sin escapar, un nombre con
 * comillas cerraría el atributo, y eso es una inyección de HTML en una
 * página que ve cualquiera.
 *
 * @param {*} valor
 * @returns {string}
 */
function escaparAtributo(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapa un valor para meterlo dentro del bloque <script type="ld+json">.
 *
 * Aquí no vale escaparAtributo: dentro de un <script> el navegador no
 * interpreta entidades HTML, así que &quot; se quedaría escrito tal cual y
 * rompería el JSON. Lo que sí hay que cortar es la secuencia `</script`,
 * porque cierra la etiqueta desde dentro de la cadena.
 *
 * @param {*} valor
 * @returns {string} Ya con sus comillas, listo para interpolar.
 */
function escaparJson(valor) {
  return JSON.stringify(String(valor === null || valor === undefined ? '' : valor))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Recorta un texto largo para una vista previa.
 *
 * WhatsApp y los demás cortan la descripción por su cuenta; recortarla aquí
 * evita mandar un párrafo entero y que el corte caiga a mitad de palabra.
 */
function resumir(texto, tope = 200) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();

  if (limpio.length <= tope) return limpio;

  return limpio.slice(0, limpio.lastIndexOf(' ', tope - 1)).trimEnd() + '…';
}

/**
 * Arma las etiquetas de un perfil, o las neutrales si no hay perfil.
 *
 * @param {object|null} perfil
 * @param {string} origen - Para componer la URL absoluta.
 * @returns {string} El HTML que reemplaza al bloque de ejemplo.
 */
function construirEtiquetas(perfil, origen) {
  if (!perfil) {
    return [
      `  <title>${escaparAtributo(NEUTRAL.titulo)}</title>`,
      `  <meta name="description" content="${escaparAtributo(NEUTRAL.descripcion)}" />`,
      '  <meta name="robots" content="noindex" />'
    ].join('\n');
  }

  const titulo = perfil.nombreNegocio;
  const descripcion = resumir(perfil.descripcion || perfil.categoria || titulo);
  const url = `${origen}/p/${perfil.slug}`;

  // El logo del negocio si lo publicó; si no, la imagen genérica. La
  // dirección tiene que ser absoluta: el robot que la busca no está en el
  // mismo sitio que el navegador.
  const imagen = perfil.imagen || `${origen}/assets/og-image.png`;

  // Schema.org sin aggregateRating. No se rellena con ceros ni se inventa:
  // el sistema no tiene reseñas, así que la propiedad no debe existir.
  const datos = [
    '    "@context": "https://schema.org"',
    '    "@type": "LocalBusiness"',
    `    "name": ${escaparJson(titulo)}`,
    `    "url": ${escaparJson(url)}`
  ];

  if (perfil.descripcion) datos.push(`    "description": ${escaparJson(perfil.descripcion)}`);
  if (perfil.telefono) datos.push(`    "telephone": ${escaparJson(perfil.telefono)}`);
  if (perfil.correoContacto) datos.push(`    "email": ${escaparJson(perfil.correoContacto)}`);
  if (perfil.horario) datos.push(`    "openingHours": ${escaparJson(perfil.horario)}`);
  if (perfil.imagen) datos.push(`    "image": ${escaparJson(perfil.imagen)}`);

  if (perfil.direccion) {
    datos.push(
      '    "address": {\n' +
      '      "@type": "PostalAddress",\n' +
      `      "streetAddress": ${escaparJson(perfil.direccion)},\n` +
      '      "addressCountry": "CO"\n' +
      '    }'
    );
  }

  if (perfil.instagram) {
    const usuario = String(perfil.instagram).replace(/^@/, '');
    datos.push(`    "sameAs": [${escaparJson(`https://instagram.com/${usuario}`)}]`);
  }

  return [
    `  <title>${escaparAtributo(titulo)} · QR Empresarial</title>`,
    `  <meta name="description" content="${escaparAtributo(descripcion)}" />`,
    '',
    '  <meta property="og:type" content="website" />',
    `  <meta property="og:title" content="${escaparAtributo(titulo)}" />`,
    `  <meta property="og:description" content="${escaparAtributo(descripcion)}" />`,
    `  <meta property="og:image" content="${escaparAtributo(imagen)}" />`,
    `  <meta property="og:url" content="${escaparAtributo(url)}" />`,
    '  <meta property="og:locale" content="es_CO" />',
    '',
    '  <meta name="twitter:card" content="summary_large_image" />',
    `  <meta name="twitter:title" content="${escaparAtributo(titulo)}" />`,
    `  <meta name="twitter:description" content="${escaparAtributo(descripcion)}" />`,
    `  <meta name="twitter:image" content="${escaparAtributo(imagen)}" />`,
    '',
    '  <script type="application/ld+json">',
    '  {',
    datos.join(',\n'),
    '  }',
    '  </script>'
  ].join('\n');
}

// Las marcas que delimitan el bloque en public.html. Se usan comentarios y
// no un reemplazo por expresión regular sobre cada etiqueta: así se ve en el
// HTML qué parte la genera el servidor, y quien edite esa pantalla no mueve
// sin querer algo de lo que depende este archivo.
const INICIO = '<!-- METADATOS:INICIO -->';
const FIN = '<!-- METADATOS:FIN -->';

let plantilla = null;

/**
 * Lee public.html una sola vez y lo parte por las marcas.
 *
 * Se cachea porque la pantalla no cambia mientras el servidor corre, y leer
 * el archivo en cada escaneo sería una lectura de disco por visita.
 *
 * @param {string} ruta
 */
async function cargarPlantilla(ruta) {
  if (plantilla) return plantilla;

  const html = await fs.readFile(ruta, 'utf8');

  const desde = html.indexOf(INICIO);
  const hasta = html.indexOf(FIN);

  if (desde === -1 || hasta === -1) {
    throw new Error(`No se encontraron las marcas ${INICIO} / ${FIN} en public.html`);
  }

  plantilla = { antes: html.slice(0, desde), despues: html.slice(hasta + FIN.length) };

  return plantilla;
}

/**
 * Devuelve public.html con las etiquetas de ese negocio.
 *
 * Si el perfil no existe, el código está apagado o la cuenta está
 * restringida, se entrega la misma pantalla con etiquetas neutrales: la
 * pantalla ya muestra el aviso, y responder distinto revelaría qué slugs
 * están registrados.
 *
 * @param {string} slug
 * @param {string} ruta - public.html
 * @param {string} origen - Protocolo y host de la petición.
 * @returns {Promise<string>}
 */
async function paginaPublica(slug, ruta, origen) {
  const { antes, despues } = await cargarPlantilla(ruta);

  let perfil = null;

  try {
    perfil = (await publicoService.obtenerPerfilPublico(slug)).perfil;
  } catch (error) {
    // 404 es lo normal aquí. Cualquier otro fallo tampoco debe dejar sin
    // pantalla a quien escanea: se sirve con las etiquetas neutrales.
    if (!error.status) console.error('No se pudo leer el perfil público:', error.message);
  }

  // El trimStart quita la sangria del primer renglon: `antes` ya termina
  // con los dos espacios que llevaba la marca en el HTML
  return antes + construirEtiquetas(perfil, origen).trimStart() + despues;
}

module.exports = { paginaPublica, construirEtiquetas, escaparAtributo, escaparJson, resumir };
