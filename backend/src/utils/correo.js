// ============================================
// CORREO.JS — envio de correo electronico (RF-03)
// Unico punto del backend que habla con un servidor SMTP. El Service pide
// "envia este enlace" y no necesita saber como.
//
// Elige el transporte segun lo que haya configurado en el .env:
//   1. Si estan SMTP_HOST, SMTP_USER y SMTP_PASS, usa ese servidor real.
//   2. Si no, y no estamos en produccion, crea una cuenta de prueba en
//      Ethereal: el correo no llega a nadie, pero queda visible en una URL
//      que se imprime en la consola. Asi se puede probar el RF-03 sin
//      exponer credenciales reales en el repositorio.
//   3. En produccion sin SMTP configurado, falla: es un error de despliegue
//      que debe notarse, no quedarse en silencio.
// ============================================

const nodemailer = require('nodemailer');

// El transporte se crea una sola vez y se reutiliza: abrir una conexion
// SMTP en cada correo seria lento e innecesario.
let transportePrometido = null;

/**
 * Indica si el .env trae una configuracion SMTP completa.
 */
function haySmtpConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Crea el transporte que corresponda. Devuelve tambien si es de prueba,
 * para saber despues si hay que imprimir la URL de Ethereal.
 */
async function crearTransporte() {
  if (haySmtpConfigurado()) {
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      // secure true es SMTP sobre TLS directo (puerto 465); en 587 se
      // negocia STARTTLS, que nodemailer activa por su cuenta
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    return { transporte, esDePrueba: false };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta configurar SMTP_HOST, SMTP_USER y SMTP_PASS para enviar correo');
  }

  // Cuenta desechable creada al vuelo. Requiere conexion a internet.
  const cuenta = await nodemailer.createTestAccount();

  const transporte = nodemailer.createTransport({
    host: cuenta.smtp.host,
    port: cuenta.smtp.port,
    secure: cuenta.smtp.secure,
    auth: {
      user: cuenta.user,
      pass: cuenta.pass
    }
  });

  console.log('Correo de prueba (Ethereal) listo. Los mensajes no llegan a destinatarios reales.');

  return { transporte, esDePrueba: true };
}

/**
 * Devuelve el transporte ya creado, o lo crea la primera vez.
 * Si la creacion falla, se descarta la promesa para que el siguiente
 * intento vuelva a probar en lugar de quedar con el error cacheado.
 */
function obtenerTransporte() {
  if (!transportePrometido) {
    transportePrometido = crearTransporte().catch((error) => {
      transportePrometido = null;
      throw error;
    });
  }

  return transportePrometido;
}

/**
 * Envia el enlace de recuperacion de contrasena (RF-03).
 *
 * @param {string} destinatario - Correo registrado de la empresa.
 * @param {string} enlace - URL con el token de un solo uso.
 * @param {Date} expiraEn - Momento en que el enlace deja de servir.
 * @returns {Promise<{urlPrevisualizacion: string|null}>}
 * @throws {Error} Si no se pudo entregar el mensaje al servidor SMTP.
 */
async function enviarEnlaceRecuperacion(destinatario, enlace, expiraEn) {
  const { transporte, esDePrueba } = await obtenerTransporte();

  const vence = expiraEn.toLocaleString('es-CO');
  const remitente = process.env.CORREO_REMITENTE || 'QR Empresarial <no-responder@qrempresarial.co>';

  const informacion = await transporte.sendMail({
    from: remitente,
    to: destinatario,
    subject: 'Restablezca su contraseña de QR Empresarial',

    // Se envian las dos versiones: algunos clientes de correo y filtros
    // antispam desconfian de los mensajes que solo traen HTML.
    text: [
      'Recibimos una solicitud para restablecer la contraseña de su cuenta.',
      '',
      'Abra este enlace para definir una nueva:',
      enlace,
      '',
      `El enlace sirve una sola vez y vence el ${vence}.`,
      'Si no solicitó el cambio, ignore este mensaje: su contraseña no se modificará.'
    ].join('\n'),

    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #111827; font-size: 20px;">Restablecer su contraseña</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de su cuenta de QR Empresarial.</p>
        <p style="margin: 28px 0;">
          <a href="${enlace}"
             style="background: #2563eb; color: #ffffff; padding: 12px 22px; border-radius: 6px;
                    text-decoration: none; font-weight: bold; display: inline-block;">
            Definir una nueva contraseña
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          El enlace sirve una sola vez y vence el ${vence}.<br>
          Si no solicitó el cambio, ignore este mensaje: su contraseña no se modificará.
        </p>
      </div>
    `
  });

  // Ethereal no entrega el correo: lo publica en una URL temporal
  const urlPrevisualizacion = esDePrueba ? nodemailer.getTestMessageUrl(informacion) : null;

  return { urlPrevisualizacion };
}

/**
 * Escapa texto que va dentro del HTML del correo.
 *
 * El nombre del negocio y los titulos de los enlaces los escribe una
 * persona, y aqui acaban dentro del cuerpo del mensaje. Sin escapar, un
 * nombre con < o & romperia el HTML del correo, y los clientes de correo
 * reaccionan a eso de formas distintas e impredecibles.
 *
 * No vale el escaparAtributo de publico.metadatos.js: ese es para lo que va
 * dentro de content="…" y vive en otro modulo. Aqui el caso es un nodo de
 * texto, y son cinco lineas que mantienen este util sin dependencias.
 *
 * @param {*} valor
 * @returns {string}
 */
function escapar(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Envia el resumen semanal de actividad (RF-12).
 *
 * Lo llama el proceso de src/tareas/resumen-semanal.js, no una peticion web:
 * nadie esta esperando la respuesta, asi que un fallo aqui tiene que subir
 * para que el proceso lo cuente y siga con los demas negocios.
 *
 * @param {string} destinatario - Correo de la cuenta.
 * @param {object} datos
 * @param {string} datos.negocio - Nombre del negocio, para el asunto.
 * @param {number} datos.dias - Dias que abarca el resumen.
 * @param {{escaneos: number, visitas: number, clics: number, conversion: number}} datos.totales
 * @param {Array<{titulo: string, clics: number}>} datos.enlacesMasPulsados
 * @returns {Promise<{urlPrevisualizacion: string|null}>}
 */
async function enviarResumenSemanal(destinatario, datos) {
  const { transporte, esDePrueba } = await obtenerTransporte();

  const remitente = process.env.CORREO_REMITENTE || 'QR Empresarial <no-responder@qrempresarial.co>';
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const ajustes = `${base}/configuracion`;

  const { negocio, dias, totales, enlacesMasPulsados } = datos;

  // Las dos versiones, por lo mismo que el correo de recuperacion: un
  // mensaje que solo trae HTML le parece sospechoso a algunos filtros.
  const lineasTexto = [
    `Esto es lo que paso con ${negocio} en los ultimos ${dias} dias:`,
    '',
    `  Escaneos del codigo QR: ${totales.escaneos}`,
    `  Visitas a la pagina:    ${totales.visitas}`,
    `  Pulsaciones en enlaces: ${totales.clics}`,
    `  De cada cien que vieron el perfil, ${totales.conversion} pulsaron algo.`
  ];

  if (enlacesMasPulsados.length > 0) {
    lineasTexto.push('', 'Lo mas pulsado:');
    enlacesMasPulsados.forEach((e) => {
      lineasTexto.push(`  ${e.titulo}: ${e.clics}`);
    });
  }

  lineasTexto.push(
    '',
    `Si no quiere recibir este resumen, apaguelo en ${ajustes}`
  );

  const filas = enlacesMasPulsados
    .map((e) => `
          <tr>
            <td style="padding: 6px 0; color: #374151;">${escapar(e.titulo)}</td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #111827;">${e.clics}</td>
          </tr>`)
    .join('');

  const bloqueEnlaces = enlacesMasPulsados.length === 0
    ? ''
    : `
        <h3 style="font-size: 15px; color: #111827; margin: 28px 0 6px;">Lo más pulsado</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${filas}
        </table>`;

  /** Una cifra con su etiqueta, en una celda. */
  const cifra = (valor, etiqueta) => `
          <td style="padding: 10px 14px; background: #f3f4f6; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${valor}</div>
            <div style="font-size: 12px; color: #6b7280;">${etiqueta}</div>
          </td>`;

  const informacion = await transporte.sendMail({
    from: remitente,
    to: destinatario,
    subject: `Resumen de la semana · ${negocio}`,
    text: lineasTexto.join('\n'),
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #111827; font-size: 20px;">Resumen de ${escapar(negocio)}</h2>
        <p>Esto es lo que pasó en los últimos ${dias} días:</p>

        <table style="border-collapse: separate; border-spacing: 8px 0; margin: 20px 0;">
          <tr>
            ${cifra(totales.escaneos, 'escaneos')}
            ${cifra(totales.visitas, 'visitas')}
            ${cifra(totales.clics, 'pulsaciones')}
          </tr>
        </table>

        <p style="font-size: 14px; color: #374151;">
          De cada cien personas que vieron el perfil,
          <strong>${totales.conversion}</strong> pulsaron algo.
        </p>
        ${bloqueEnlaces}
        <p style="font-size: 13px; color: #6b7280; margin-top: 28px;">
          Si no quiere recibir este resumen, puede apagarlo en
          <a href="${ajustes}" style="color: #2563eb;">la configuración de su cuenta</a>.
        </p>
      </div>
    `
  });

  const urlPrevisualizacion = esDePrueba ? nodemailer.getTestMessageUrl(informacion) : null;

  return { urlPrevisualizacion };
}

module.exports = {
  enviarEnlaceRecuperacion,
  enviarResumenSemanal,
  haySmtpConfigurado
};

