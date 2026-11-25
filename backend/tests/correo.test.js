// ============================================
// TESTS/CORREO.TEST.JS — el envio del enlace de recuperacion (RF-03)
//
// Es el unico punto del backend que habla con un servidor SMTP, y era la
// pieza menos cubierta del proyecto: 53% de ramas. Lo que no se ejecutaba
// nunca es justo la eleccion del transporte —que decide si el correo sale de
// verdad, si va a una cuenta desechable o si el despliegue falla— y el
// manejo de un fallo al crearlo.
//
// Importa porque de aqui depende recuperar una contrasena: si esto se rompe
// en produccion, quien la olvide no vuelve a entrar.
//
// Las demas pruebas corren con nodemailer simulado en tests/setup/entorno.js,
// para que la suite no mande correo de verdad. Aqui se reemplaza esa
// simulacion por una propia en cada caso, con jest.doMock y los modulos
// reiniciados: correo.js guarda el transporte en una variable de modulo, asi
// que sin reiniciar el segundo caso heredaria el transporte del primero.
// ============================================

const ENTORNO = { ...process.env };

/** Deja el .env en un estado conocido para cada caso. */
function conEntorno(valores) {
  for (const clave of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'SMTP_SECURE']) {
    delete process.env[clave];
  }

  Object.assign(process.env, valores);
}

/**
 * Carga correo.js con un nodemailer propio.
 *
 * Devuelve el modulo y los espias, para poder comprobar con que se creo el
 * transporte y si se pidio una cuenta de prueba.
 */
function cargarCorreo({ alCrearTransporte } = {}) {
  const enviados = [];

  const createTransport = jest.fn((opciones) => {
    if (alCrearTransporte) alCrearTransporte(opciones);

    return {
      sendMail: async (mensaje) => {
        enviados.push(mensaje);

        return { messageId: 'prueba' };
      }
    };
  });

  const createTestAccount = jest.fn(async () => ({
    user: 'desechable@ethereal.email',
    pass: 'clave',
    smtp: { host: 'smtp.ethereal.email', port: 587, secure: false }
  }));

  const getTestMessageUrl = jest.fn(() => 'https://ethereal.email/message/abc');

  jest.resetModules();
  jest.doMock('nodemailer', () => ({ createTransport, createTestAccount, getTestMessageUrl }));

  // eslint-disable-next-line global-require
  const correo = require('../src/utils/correo');

  return { correo, createTransport, createTestAccount, getTestMessageUrl, enviados };
}

const enviar = (correo) =>
  correo.enviarEnlaceRecuperacion(
    'duena@panaderia.co',
    'https://qrempresarial.co/restablecer?token=abc',
    new Date('2026-12-01T10:00:00Z')
  );

afterEach(() => {
  process.env = { ...ENTORNO };
  jest.resetModules();
});

describe('con un servidor SMTP configurado', () => {
  test('manda por ese servidor, con sus credenciales', async () => {
    conEntorno({
      SMTP_HOST: 'smtp.miempresa.co',
      SMTP_USER: 'avisos@miempresa.co',
      SMTP_PASS: 'secreta'
    });

    const { correo, createTransport, createTestAccount } = cargarCorreo();

    await enviar(correo);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.miempresa.co',
      auth: { user: 'avisos@miempresa.co', pass: 'secreta' }
    }));

    // Y no se crea ninguna cuenta desechable: el correo sale de verdad
    expect(createTestAccount).not.toHaveBeenCalled();
  });

  // Si no se dice, 587: es el puerto de SMTP con STARTTLS, que es lo que
  // ofrecen casi todos los proveedores.
  test('el puerto por defecto es el 587', async () => {
    conEntorno({ SMTP_HOST: 'smtp.miempresa.co', SMTP_USER: 'u', SMTP_PASS: 'p' });

    const { correo, createTransport } = cargarCorreo();

    await enviar(correo);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587 }));
  });

  test('y se puede cambiar', async () => {
    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: '465' });

    const { correo, createTransport } = cargarCorreo();

    await enviar(correo);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465 }));
  });

  // secure es TLS directo, del 465. En el 587 se negocia STARTTLS y ponerlo
  // en true rompe la conexion, asi que solo la cadena "true" lo activa.
  test('secure solo se activa con la palabra true', async () => {
    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_SECURE: 'si' });

    const { correo, createTransport } = cargarCorreo();

    await enviar(correo);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false }));
  });

  // Ethereal publica el mensaje en una URL; un servidor de verdad lo entrega.
  // Devolver una URL aqui haria creer que el correo no salio.
  test('no devuelve URL de previsualizacion', async () => {
    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' });

    const { correo } = cargarCorreo();

    expect(await enviar(correo)).toEqual({ urlPrevisualizacion: null });
  });
});

describe('sin servidor SMTP', () => {
  // Es un error de despliegue, no una incidencia pasajera: quedarse en
  // silencio significa que nadie recupera su contrasena y nadie se entera.
  test('en produccion falla, y dice que falta', async () => {
    conEntorno({ NODE_ENV: 'production' });

    const { correo } = cargarCorreo();

    await expect(enviar(correo)).rejects.toThrow(/SMTP_HOST, SMTP_USER y SMTP_PASS/);
  });

  test('fuera de produccion usa una cuenta desechable', async () => {
    conEntorno({ NODE_ENV: 'development' });

    const { correo, createTestAccount, createTransport } = cargarCorreo();

    await enviar(correo);

    expect(createTestAccount).toHaveBeenCalled();
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.ethereal.email'
    }));
  });

  // Es lo que hace util la cuenta desechable: el mensaje no llega a nadie,
  // pero se puede abrir para comprobar que el enlace es correcto.
  test('y devuelve la URL donde leerlo', async () => {
    conEntorno({ NODE_ENV: 'development' });

    const { correo } = cargarCorreo();

    expect(await enviar(correo)).toEqual({
      urlPrevisualizacion: 'https://ethereal.email/message/abc'
    });
  });
});

describe('el transporte se reutiliza', () => {
  test('dos correos abren una sola conexion', async () => {
    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' });

    const { correo, createTransport } = cargarCorreo();

    await enviar(correo);
    await enviar(correo);

    expect(createTransport).toHaveBeenCalledTimes(1);
  });

  // REGRESION. Si se guardara la promesa fallida, un corte de red al mandar
  // el primer correo dejaria el envio roto hasta reiniciar el servidor:
  // todos los intentos siguientes recibirian el mismo error cacheado.
  test('pero un fallo al crearlo no se queda guardado', async () => {
    conEntorno({ NODE_ENV: 'development' });

    let intentos = 0;

    const { correo } = cargarCorreo({
      alCrearTransporte: () => {
        intentos += 1;

        if (intentos === 1) throw new Error('No hay red');
      }
    });

    await expect(enviar(correo)).rejects.toThrow('No hay red');

    // El segundo intento vuelve a probar, y sale
    await expect(enviar(correo)).resolves.toEqual({
      urlPrevisualizacion: 'https://ethereal.email/message/abc'
    });

    expect(intentos).toBe(2);
  });
});

describe('el mensaje', () => {
  test('va en texto y en HTML, con el enlace en los dos', async () => {
    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' });

    const { correo, enviados } = cargarCorreo();

    await enviar(correo);

    const [mensaje] = enviados;

    expect(mensaje.to).toBe('duena@panaderia.co');
    expect(mensaje.text).toContain('https://qrempresarial.co/restablecer?token=abc');
    expect(mensaje.html).toContain('https://qrempresarial.co/restablecer?token=abc');
  });

  // Quien lo recibe tiene que saber hasta cuando sirve: sin eso, un enlace
  // vencido parece un sistema roto.
  test('dice cuando vence', async () => {
    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' });

    const { correo, enviados } = cargarCorreo();

    await enviar(correo);

    expect(enviados[0].text).toMatch(/vence el .+2026/);
  });

  test('se puede cambiar el remitente desde el .env', async () => {
    conEntorno({
      SMTP_HOST: 'h',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      CORREO_REMITENTE: 'Panadería <hola@laespiga.co>'
    });

    const { correo, enviados } = cargarCorreo();

    await enviar(correo);

    expect(enviados[0].from).toBe('Panadería <hola@laespiga.co>');
  });
});

describe('haySmtpConfigurado', () => {
  // Hoy no lo llama nadie: el enlace de desarrollo se decide con NODE_ENV.
  // Se prueba porque esta exportado, que es lo que lo hace parte del trato.
  test('solo es cierto con las tres variables', async () => {
    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' });
    expect(cargarCorreo().correo.haySmtpConfigurado()).toBe(true);

    conEntorno({ SMTP_HOST: 'h', SMTP_USER: 'u' });
    expect(cargarCorreo().correo.haySmtpConfigurado()).toBe(false);

    conEntorno({});
    expect(cargarCorreo().correo.haySmtpConfigurado()).toBe(false);
  });
});
