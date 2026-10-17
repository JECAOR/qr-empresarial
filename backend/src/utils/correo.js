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

module.exports = {
  enviarEnlaceRecuperacion,
  haySmtpConfigurado
};
