// ============================================
// QR.SERVICE.JS — reglas del código QR (RF-07, RF-08)
//
// Dos trabajos distintos:
//   - El registro del código: existe uno por perfil, con su estado y su
//     dirección (RF-07).
//   - Las imágenes para descargar: PNG, SVG y PDF (RF-08).
//
// Lo que hace "dinámico" al código no es la imagen, que nunca cambia, sino
// que la dirección es fija y lo que hay detrás se puede editar. Por eso el
// slug del perfil no cambia al renombrar el negocio: un código impreso tiene
// que seguir llevando al mismo sitio (RF-09).
// ============================================

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const perfilRepository = require('../perfiles/perfil.repository');
const contenidoRepository = require('../contenido/contenido.repository');
const qrRepository = require('./qr.repository');

const FORMATOS = ['png', 'svg', 'pdf'];

// Límites de lo que puede pedir el cliente, para que un tamaño absurdo no
// deje al servidor generando una imagen de 20.000 píxeles.
const TAMANO_MINIMO = 120;
const TAMANO_MAXIMO = 1200;
const TAMANO_POR_DEFECTO = 400;

const COLOR_POR_DEFECTO = '#111827';

// Marca que distingue un escaneo de una visita directa (RF-11).
//
// La imagen del codigo lleva este parametro; el enlace que se comparte por
// WhatsApp o se copia, no. Asi la vista publica sabe por donde llego la
// persona y puede contar "escaneos del QR" aparte de "visitas al perfil",
// que son dos de las tres medidas que pide el RF-11.
//
// La direccion guardada en la base no cambia: sigue siendo la del perfil. El
// parametro solo marca el origen, no lleva a otro sitio, asi que un codigo
// impreso seguiria funcionando igual si manana se quitara.
const MARCA_DE_ESCANEO = 'qr=1';

/**
 * Agrega la marca de escaneo a una direccion.
 */
function conMarcaDeEscaneo(url) {
  return url.includes('?') ? `${url}&${MARCA_DE_ESCANEO}` : `${url}?${MARCA_DE_ESCANEO}`;
}

/**
 * Dirección pública que codifica el QR.
 *
 * Sale de APP_URL, la misma variable que usa el enlace de recuperación, para
 * que todo apunte al sitio donde está publicada la aplicación.
 */
function urlPublica(slug) {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return `${base}/p/${slug}`;
}

/**
 * Perfil de la cuenta autenticada.
 * @throws {Error} 404 si no tiene perfil.
 */
async function perfilDeLaCuenta(idUsuario) {
  const perfil = await perfilRepository.buscarPorUsuario(idUsuario);

  if (!perfil) {
    const error = new Error(
      'Primero complete el perfil empresarial: el código QR apunta a él'
    );
    error.status = 404;
    throw error;
  }

  return perfil;
}

/** Da forma de API al registro del código. */
function aRespuesta(fila, slug) {
  return {
    idQr: fila.id_qr,
    url: fila.codigo_qr,
    slug,
    activo: Boolean(fila.activo),
    fechaCreacion: fila.fecha_creacion,
    fechaActualizacion: fila.fecha_actualizacion
  };
}

/**
 * Devuelve el código QR de la cuenta.
 *
 * @param {number} idUsuario
 * @returns {Promise<object>}
 * @throws {Error} 404 si todavía no se ha generado.
 */
async function obtenerMiQr(idUsuario) {
  const perfil = await perfilDeLaCuenta(idUsuario);
  const fila = await qrRepository.buscarPorPerfil(perfil.id_perfil);

  if (!fila) {
    const error = new Error('Este perfil todavía no tiene un código QR generado');
    error.status = 404;
    throw error;
  }

  return aRespuesta(fila, perfil.slug);
}

/**
 * Genera el código QR del perfil (RF-07).
 *
 * Si ya existe se devuelve el mismo, sin crear otro ni cambiar su dirección:
 * volver a generarlo invalidaría los códigos ya impresos. La base también lo
 * impediría, porque `id_perfil` es UNIQUE.
 *
 * **No se genera para un perfil sin contenido activo.** Un código que lleva a
 * una página vacía es peor que no tener código: quien lo escanea se queda sin
 * saber si el negocio existe.
 *
 * @param {number} idUsuario
 * @returns {Promise<{qr: object, yaExistia: boolean}>}
 * @throws {Error} 409 si el perfil no tiene contenido activo.
 */
async function generarMiQr(idUsuario) {
  const perfil = await perfilDeLaCuenta(idUsuario);

  const existente = await qrRepository.buscarPorPerfil(perfil.id_perfil);

  if (existente) {
    return { qr: aRespuesta(existente, perfil.slug), yaExistia: true };
  }

  const bloquesActivos = await contenidoRepository.contarActivos(perfil.id_perfil);

  if (bloquesActivos === 0) {
    const error = new Error(
      'Agregue al menos un bloque de contenido activo antes de generar el código QR'
    );
    error.status = 409;
    throw error;
  }

  await qrRepository.crear(perfil.id_perfil, urlPublica(perfil.slug));

  const fila = await qrRepository.buscarPorPerfil(perfil.id_perfil);

  console.log('Codigo QR generado para el perfil', perfil.id_perfil);

  return { qr: aRespuesta(fila, perfil.slug), yaExistia: false };
}

/**
 * Activa o desactiva el código.
 *
 * @param {number} idUsuario
 * @param {boolean} activo
 * @returns {Promise<object>}
 */
async function cambiarEstadoMiQr(idUsuario, activo) {
  const perfil = await perfilDeLaCuenta(idUsuario);

  const filas = await qrRepository.cambiarEstado(perfil.id_perfil, activo);

  if (filas === 0) {
    const error = new Error('Este perfil todavía no tiene un código QR generado');
    error.status = 404;
    throw error;
  }

  const fila = await qrRepository.buscarPorPerfil(perfil.id_perfil);

  return aRespuesta(fila, perfil.slug);
}

/**
 * Normaliza lo que pidió el cliente para la imagen.
 *
 * @param {object} consulta - req.query
 * @returns {{formato: string, tamano: number, color: string}}
 * @throws {Error} 400 si el formato o el color no sirven.
 */
function opcionesDeImagen(consulta = {}) {
  const formato = String(consulta.formato || 'png').toLowerCase();

  if (!FORMATOS.includes(formato)) {
    const error = new Error(`El formato debe ser uno de: ${FORMATOS.join(', ')}`);
    error.status = 400;
    throw error;
  }

  // Un tamaño raro no es motivo para fallar: se ajusta al rango permitido
  const pedido = Number(consulta.tamano);
  const tamano = Number.isFinite(pedido)
    ? Math.min(Math.max(Math.round(pedido), TAMANO_MINIMO), TAMANO_MAXIMO)
    : TAMANO_POR_DEFECTO;

  const color = consulta.color ? `#${String(consulta.color).replace(/^#/, '')}` : COLOR_POR_DEFECTO;

  // El color sí se valida: va directo a la librería y a la respuesta
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    const error = new Error('El color debe ser hexadecimal de seis dígitos, por ejemplo 111827');
    error.status = 400;
    throw error;
  }

  return { formato, tamano, color };
}

/**
 * Genera la imagen del código para descargar (RF-08).
 *
 * El PNG y el SVG los produce la librería `qrcode`. El PDF se arma con
 * `pdfkit`, colocando el PNG centrado en una página A4: es lo que se lleva a
 * una imprenta o se pega en un menú.
 *
 * La vista previa de la pantalla se sigue dibujando en el navegador, que es
 * instantáneo; esto es para la descarga, donde importa que el archivo salga
 * igual en cualquier equipo.
 *
 * @param {number} idUsuario
 * @param {object} consulta - req.query
 * @returns {Promise<{buffer: Buffer, tipo: string, extension: string, nombre: string}>}
 */
async function generarImagen(idUsuario, consulta) {
  const qr = await obtenerMiQr(idUsuario);
  const { formato, tamano, color } = opcionesDeImagen(consulta);

  const opciones = {
    width: tamano,
    margin: 2,
    color: { dark: color, light: '#FFFFFF' }
  };

  const nombre = `qr-${qr.slug}`;

  // Lo que queda codificado lleva la marca; lo que se muestra y se comparte
  // en la pantalla, no
  const destino = conMarcaDeEscaneo(qr.url);

  if (formato === 'svg') {
    const svg = await QRCode.toString(destino, { ...opciones, type: 'svg' });

    return {
      buffer: Buffer.from(svg, 'utf8'),
      tipo: 'image/svg+xml',
      extension: 'svg',
      nombre
    };
  }

  const png = await QRCode.toBuffer(destino, { ...opciones, type: 'png' });

  if (formato === 'png') {
    return { buffer: png, tipo: 'image/png', extension: 'png', nombre };
  }

  return {
    buffer: await armarPdf(png, qr),
    tipo: 'application/pdf',
    extension: 'pdf',
    nombre
  };
}

/**
 * Arma el PDF de una página con el código centrado y su dirección debajo.
 *
 * pdfkit escribe por flujo; aquí se juntan los trozos para poder devolver un
 * solo Buffer, que es lo que necesita la respuesta HTTP.
 *
 * @param {Buffer} png
 * @param {object} qr
 * @returns {Promise<Buffer>}
 */
function armarPdf(png, qr) {
  return new Promise((resolve, reject) => {
    const documento = new PDFDocument({ size: 'A4', margin: 50 });
    const trozos = [];

    documento.on('data', (trozo) => trozos.push(trozo));
    documento.on('end', () => resolve(Buffer.concat(trozos)));
    documento.on('error', reject);

    const anchoUtil = documento.page.width - documento.page.margins.left * 2;
    const ladoQr = Math.min(anchoUtil, 320);
    const x = (documento.page.width - ladoQr) / 2;

    documento.fontSize(20).fillColor('#111827')
      .text('Escanee para ver nuestro perfil', { align: 'center' });

    documento.moveDown(2);

    documento.image(png, x, documento.y, { width: ladoQr, height: ladoQr });

    documento.y += ladoQr + 24;

    documento.fontSize(12).fillColor('#6B7280')
      .text(qr.url, { align: 'center', link: qr.url });

    documento.end();
  });
}

module.exports = {
  obtenerMiQr,
  generarMiQr,
  cambiarEstadoMiQr,
  generarImagen,
  urlPublica,
  conMarcaDeEscaneo,
  FORMATOS,
  MARCA_DE_ESCANEO
};
