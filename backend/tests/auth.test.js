// ============================================
// TESTS/AUTH.TEST.JS — RF-01, RF-02 y RF-03
//
// Es el archivo que mas importa de la suite: aqui estan las reglas que, si
// se rompen, no dan un error visible sino un agujero. Un 401 que pasa a 200
// no hace fallar ninguna pantalla.
// ============================================

const { app, request, CLAVE, correoNuevo, crearCuenta, entrar, como } = require('./ayudas');

const pool = require('../src/config/database');
const jwt = require('jsonwebtoken');

describe('Registro publico (RF-01)', () => {
  test('crea la cuenta, devuelve token y crea el perfil del negocio', async () => {
    const correo = correoNuevo();

    const respuesta = await request(app).post('/api/auth/registro').send({
      nombre: 'Jean Orozco',
      correo,
      contrasena: CLAVE,
      negocio: { nombreNegocio: 'Panaderia del Barrio' }
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.correo).toBe(correo);
    expect(respuesta.body.data.idUsuario).toEqual(expect.any(Number));

    // El rol no se acepta del cliente: quien se registra es siempre empresa
    expect(respuesta.body.data.rol).toBe('empresa');

    // El perfil se crea en el mismo paso, con los datos del formulario
    const perfil = await como(await entrar(correo)).get('/api/perfiles/me');

    expect(perfil.status).toBe(200);
    expect(perfil.body.data.nombreNegocio).toBe('Panaderia del Barrio');
    expect(perfil.body.data.slug).toBe('panaderia-del-barrio');
  });

  test('la contrasena nunca vuelve en la respuesta', async () => {
    const respuesta = await request(app).post('/api/auth/registro').send({
      nombre: 'Jean Orozco',
      correo: correoNuevo(),
      contrasena: CLAVE,
      negocio: { nombreNegocio: 'Otro Negocio' }
    });

    expect(JSON.stringify(respuesta.body)).not.toContain(CLAVE);
    expect(respuesta.body.data).not.toHaveProperty('contrasena');
  });

  test('se guarda cifrada, no en claro (RN-02)', async () => {
    const correo = correoNuevo();

    await request(app).post('/api/auth/registro').send({
      nombre: 'Jean Orozco',
      correo,
      contrasena: CLAVE,
      negocio: { nombreNegocio: 'Negocio Cifrado' }
    });

    const [filas] = await pool.execute('SELECT contrasena FROM usuario WHERE correo = ?', [correo]);

    expect(filas[0].contrasena).not.toBe(CLAVE);
    expect(filas[0].contrasena).toMatch(/^\$2[aby]\$/); // bcrypt
  });

  test('RN-01: el correo es unico entre las cuentas activas', async () => {
    const { correo } = await crearCuenta();

    const repetido = await request(app).post('/api/auth/registro').send({
      nombre: 'Otra Persona',
      correo,
      contrasena: CLAVE,
      negocio: { nombreNegocio: 'Negocio Repetido' }
    });

    expect(repetido.status).toBe(409);
  });

  test.each([
    ['sin mayuscula', 'clave123*'],
    ['sin numero', 'ClaveClave*'],
    ['sin simbolo', 'Clave12345'],
    ['demasiado corta', 'Cl1*']
  ])('RN-02: rechaza una contrasena %s', async (_, contrasena) => {
    const respuesta = await request(app).post('/api/auth/registro').send({
      nombre: 'Jean Orozco',
      correo: correoNuevo(),
      contrasena,
      negocio: { nombreNegocio: 'Negocio Debil' }
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('Inicio de sesion (RF-02)', () => {
  test('con las credenciales correctas devuelve token', async () => {
    const { correo } = await crearCuenta();

    const respuesta = await request(app).post('/api/auth/login').send({ correo, contrasena: CLAVE });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.token).toEqual(expect.any(String));
  });

  test('una contrasena equivocada no distingue de un correo inexistente', async () => {
    const { correo } = await crearCuenta();

    const malaClave = await request(app)
      .post('/api/auth/login')
      .send({ correo, contrasena: 'LaQueNoEs1*' });

    const noExiste = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'nadie.' + Date.now() + '@ejemplo.co', contrasena: CLAVE });

    // Dar mensajes distintos dejaria averiguar que correos hay registrados
    expect(malaClave.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(malaClave.body.message).toBe(noExiste.body.message);
  });
});

describe('RN-03: limite de intentos de inicio de sesion', () => {
  test('al sexto intento fallido responde 429', async () => {
    const { correo } = await crearCuenta();

    const fallar = () =>
      request(app).post('/api/auth/login').send({ correo, contrasena: 'LaQueNoEs1*' });

    for (let i = 0; i < 5; i += 1) {
      expect((await fallar()).status).toBe(401);
    }

    expect((await fallar()).status).toBe(429);
  });

  test('acertar la contrasena no gasta cupo', async () => {
    const { correo } = await crearCuenta();

    // Diez aciertos seguidos: si contaran, el limite de cinco ya habria
    // saltado y un usuario legitimo quedaria bloqueado por usar la aplicacion
    for (let i = 0; i < 10; i += 1) {
      const respuesta = await request(app).post('/api/auth/login').send({ correo, contrasena: CLAVE });
      expect(respuesta.status).toBe(200);
    }
  });
});

describe('Cierre de sesion (RF-02)', () => {
  test('el token deja de servir despues de cerrar sesion', async () => {
    const { token } = await crearCuenta();

    expect((await como(token).get('/api/usuarios/me')).status).toBe(200);

    expect((await como(token).post('/api/auth/logout')).status).toBe(200);

    // Sin revocacion en el servidor, el token seguiria siendo valido hasta
    // vencer: cerrar sesion solo lo borraria del navegador
    expect((await como(token).get('/api/usuarios/me')).status).toBe(401);
  });

  test('cerrar una sesion no cierra las demas', async () => {
    const { correo } = await crearCuenta();

    const unaSesion = await entrar(correo);
    const otraSesion = await entrar(correo);

    await como(unaSesion).post('/api/auth/logout');

    expect((await como(unaSesion).get('/api/usuarios/me')).status).toBe(401);
    expect((await como(otraSesion).get('/api/usuarios/me')).status).toBe(200);
  });
});

describe('Recuperacion de contrasena (RF-03)', () => {
  test('responde 200 exista o no el correo, pero solo envia si existe', async () => {
    const { correo } = await crearCuenta();

    const existente = await request(app).post('/api/auth/recuperar-contrasena').send({ correo });
    expect(existente.status).toBe(200);
    expect(global.__correosEnviados).toHaveLength(1);
    expect(global.__correosEnviados[0].to).toBe(correo);

    global.__correosEnviados.length = 0;

    const inventado = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ correo: 'nadie.' + Date.now() + '@ejemplo.co' });

    // Mismo 200: responder 404 revelaria que cuentas hay registradas
    expect(inventado.status).toBe(200);
    expect(global.__correosEnviados).toHaveLength(0);
  });

  test('RN-04: el enlace sirve una sola vez', async () => {
    const { correo } = await crearCuenta();

    await request(app).post('/api/auth/recuperar-contrasena').send({ correo });

    const enlace = global.__correosEnviados[0].text.match(/token=([a-f0-9]+)/i);
    const token = enlace[1];

    const primera = await request(app)
      .post('/api/auth/restablecer-contrasena')
      .send({ token, contrasena: 'NuevaClave1*' });

    expect(primera.status).toBe(200);

    const segunda = await request(app)
      .post('/api/auth/restablecer-contrasena')
      .send({ token, contrasena: 'OtraClave1*' });

    expect(segunda.status).toBe(400);
  });

  test('en la base solo se guarda el hash del token, no el token', async () => {
    const { correo } = await crearCuenta();

    await request(app).post('/api/auth/recuperar-contrasena').send({ correo });

    const token = global.__correosEnviados[0].text.match(/token=([a-f0-9]+)/i)[1];

    const [filas] = await pool.query('SELECT token_hash FROM token_recuperacion');
    const guardados = filas.map((f) => f.token_hash);

    // Aunque alguien leyera la tabla, no podria reconstruir el enlace
    expect(guardados).not.toContain(token);
  });

  test('restablecer la contrasena cierra todas las sesiones abiertas', async () => {
    const { correo } = await crearCuenta();

    const sesionVieja = await entrar(correo);
    expect((await como(sesionVieja).get('/api/usuarios/me')).status).toBe(200);

    // El corte se compara con el "iat" del JWT, que el estandar define en
    // SEGUNDOS enteros, y la comparacion es estricta a proposito: asi el
    // token emitido en el mismo segundo del cambio -el que recibe quien
    // acaba de cambiar su contrasena desde Configuracion- sigue valiendo.
    //
    // Sin esta espera, la prueba abriria la sesion y la restableceria dentro
    // del mismo segundo, y estaria comprobando ese caso y no el real: entre
    // abrir sesion y pedir un enlace de recuperacion pasan minutos.
    await new Promise((listo) => setTimeout(listo, 1100));

    await request(app).post('/api/auth/recuperar-contrasena').send({ correo });
    const token = global.__correosEnviados[0].text.match(/token=([a-f0-9]+)/i)[1];

    await request(app).post('/api/auth/restablecer-contrasena').send({ token, contrasena: 'NuevaClave1*' });

    // Quien recupera su cuenta suele hacerlo porque perdio el control de
    // ella: las sesiones abiertas antes del cambio dejan de servir
    expect((await como(sesionVieja).get('/api/usuarios/me')).status).toBe(401);

    // Y la contrasena nueva es la que vale
    expect((await request(app).post('/api/auth/login').send({ correo, contrasena: CLAVE })).status)
      .toBe(401);
    expect(await entrar(correo, 'NuevaClave1*')).toEqual(expect.any(String));
  });
});

describe('Proteccion de las rutas', () => {
  test('sin token, las rutas privadas responden 401', async () => {
    const rutas = [
      ['get', '/api/usuarios/me'],
      ['get', '/api/perfiles/me'],
      ['get', '/api/contenido'],
      ['get', '/api/qr'],
      ['get', '/api/estadisticas']
    ];

    for (const [metodo, ruta] of rutas) {
      expect((await request(app)[metodo](ruta)).status).toBe(401);
    }
  });

  test('un token inventado no sirve', async () => {
    const respuesta = await como('esto.no.es.un.token').get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
  });
});

// ============================================
// Las reglas de entrada, una por una
//
// Casi una cuarta parte de auth.validator.js no se habia ejecutado nunca, y
// es el archivo donde un hueco no da un error visible: un 400 que se
// convierte en 200 deja pasar datos, no rompe una pantalla.
//
// Los casos de la contrasena esperan el mismo mensaje a proposito: hay uno
// solo para las cuatro condiciones. Lo que cambia no es el texto, es la
// rama.
// ============================================

describe('entrar: lo que no se acepta', () => {
  test.each([
    ['sin correo', { contrasena: CLAVE }],
    ['sin contrasena', { correo: 'ana@ejemplo.co' }],
    ['con el cuerpo vacio', {}],
    ['con el correo en blanco', { correo: '', contrasena: CLAVE }]
  ])('%s', async (_, cuerpo) => {
    const respuesta = await request(app).post('/api/auth/login').send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/correo y la contrasena son obligatorios/);
  });
});

describe('registrarse: cada regla rechaza lo suyo', () => {
  const completo = () => ({
    nombre: 'Persona Nueva',
    correo: correoNuevo(),
    contrasena: CLAVE
  });

  test.each([
    ['sin nombre', { nombre: undefined }, /nombre, correo y contrasena son obligatorios/],
    ['sin correo', { correo: undefined }, /nombre, correo y contrasena son obligatorios/],
    ['sin contrasena', { contrasena: undefined }, /nombre, correo y contrasena son obligatorios/],
    ['con el nombre de una letra', { nombre: 'A' }, /al menos 2 caracteres/],
    ['con el nombre que no es texto', { nombre: 7 }, /al menos 2 caracteres/],
    ['con un correo invalido', { correo: 'no-es-correo' }, /formato del correo/],
    ['con la contrasena corta', { contrasena: 'Ab1*' }, /mínimo 8 caracteres/],
    ['con la contrasena sin mayuscula', { contrasena: 'clave123*' }, /una mayúscula/],
    ['con la contrasena sin numero', { contrasena: 'ClaveClave*' }, /un número/],
    ['con la contrasena sin simbolo', { contrasena: 'Clave12345' }, /un símbolo/]
  ])('no deja registrarse %s', async (_, cambio, mensaje) => {
    const respuesta = await request(app).post('/api/auth/registro')
      .send({ ...completo(), ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(mensaje);
  });

  // El negocio es opcional, pero si llega tiene que ser un objeto: una
  // cadena o una lista significan que quien llama entendio mal el contrato.
  test.each([
    ['una cadena', 'Mi Panaderia'],
    ['una lista', ['Mi Panaderia']],
    ['nulo', null]
  ])('el negocio no puede ser %s', async (_, negocio) => {
    const respuesta = await request(app).post('/api/auth/registro')
      .send({ ...completo(), negocio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/datos del negocio deben venir en un objeto/);
  });

  test('el nombre del negocio no puede ser de una letra', async () => {
    const respuesta = await request(app).post('/api/auth/registro')
      .send({ ...completo(), negocio: { nombreNegocio: 'A' } });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/negocio debe tener al menos 2 caracteres/);
  });

  test('ni pasar de 150 caracteres', async () => {
    const respuesta = await request(app).post('/api/auth/registro')
      .send({ ...completo(), negocio: { nombreNegocio: 'P'.repeat(151) } });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/no puede superar los 150/);
  });

  // Un negocio vacio es valido: el perfil nace con el nombre de la cuenta y
  // se completa despues en Configuracion.
  test('un negocio sin nombre se acepta, y el perfil toma el de la cuenta', async () => {
    const correo = correoNuevo();

    const respuesta = await request(app).post('/api/auth/registro')
      .send({ nombre: 'Ana Perez', correo, contrasena: CLAVE, negocio: {} });

    expect(respuesta.status).toBe(201);

    const perfil = await como(await entrar(correo)).get('/api/perfiles/me');

    expect(perfil.body.data.nombreNegocio).toBe('Ana Perez');
  });

  // Los demas campos del negocio tambien se guardan si llegan.
  test('y si llegan los demas datos del negocio, se guardan', async () => {
    const correo = correoNuevo();

    await request(app).post('/api/auth/registro').send({
      nombre: 'Ana Perez',
      correo,
      contrasena: CLAVE,
      negocio: {
        nombreNegocio: 'Panaderia Con Datos',
        categoria: 'Panaderia',
        direccion: 'Calle 1 #2-3',
        telefono: '+57 300 000 0000'
      }
    });

    const perfil = await como(await entrar(correo)).get('/api/perfiles/me');

    expect(perfil.body.data.categoria).toBe('Panaderia');
    expect(perfil.body.data.direccion).toBe('Calle 1 #2-3');
    expect(perfil.body.data.telefono).toBe('+57 300 000 0000');
  });
});

describe('recuperar la contrasena: lo que no se acepta', () => {
  test.each([
    ['sin correo', {}],
    ['con el correo en blanco', { correo: '   ' }],
    ['con un correo que no es texto', { correo: 42 }]
  ])('pedir el enlace %s se rechaza', async (_, cuerpo) => {
    const respuesta = await request(app).post('/api/auth/recuperar-contrasena').send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/correo es obligatorio/);
  });

  // El token son 64 caracteres hexadecimales. Uno corto no se busca
  // siquiera en la base: no puede ser de los que emite el sistema.
  test.each([
    ['corto', 'abc'],
    ['vacio', ''],
    ['que no es texto', 12345]
  ])('un token %s se rechaza sin consultar nada', async (_, token) => {
    const respuesta = await request(app).post('/api/auth/restablecer-contrasena')
      .send({ token, contrasena: 'OtraClave1*' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/enlace de recuperación no es válido/);
  });

  test('y una contrasena nueva floja tambien', async () => {
    const respuesta = await request(app).post('/api/auth/restablecer-contrasena')
      .send({ token: 'a'.repeat(64), contrasena: 'floja' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/mínimo 8 caracteres/);
  });

  // Con el formato bueno pero sin existir en la base: es lo que pasa con un
  // enlace ya usado o vencido.
  test('un token bien formado pero desconocido no sirve', async () => {
    const respuesta = await request(app).post('/api/auth/restablecer-contrasena')
      .send({ token: 'b'.repeat(64), contrasena: 'OtraClave1*' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/no es válido o ya expiró/);
  });
});

describe('una cuenta restringida', () => {
  /** Deja la cuenta restringida, como hace el administrador. */
  async function restringir(correo) {
    await pool.execute("UPDATE usuario SET estado = 'restringido' WHERE correo = ?", [correo]);
  }

  // Restringir tiene que servir de algo: si la sesion que ya tenia abierta
  // siguiera funcionando, la medida no protegeria de nada hasta que cerrara
  // el navegador.
  //
  // Lo para el middleware con un 401, antes de llegar a ningun servicio. Los
  // servicios comprueban ademas el estado por su cuenta —auth.service lo
  // hace en tres sitios—, y esas ramas no se pueden alcanzar por HTTP: son
  // la segunda barrera, no la primera.
  test('no puede usar la sesion que ya tenia abierta', async () => {
    const { token, correo } = await crearCuenta();

    expect((await como(token).get('/api/usuarios/me')).status).toBe(200);

    await restringir(correo);

    const respuesta = await como(token).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toMatch(/restringido/);
  });

  test('ni cambiar su contrasena', async () => {
    const { token, correo } = await crearCuenta();

    await restringir(correo);

    const respuesta = await como(token).put('/api/usuarios/me/contrasena')
      .send({ contrasenaActual: CLAVE, contrasenaNueva: 'OtraClave1*' });

    expect(respuesta.status).toBe(401);
  });

  test('ni darse de baja', async () => {
    const { token, correo } = await crearCuenta();

    await restringir(correo);

    const respuesta = await como(token).delete('/api/usuarios/me').send({ contrasena: CLAVE });

    expect(respuesta.status).toBe(401);
  });
});

describe('cambiar la contrasena propia', () => {
  // Repetir la misma no es un cambio. Sin esto, quien crea que la cambio se
  // quedaria con la de siempre creyendo lo contrario.
  test('la nueva no puede ser la de ahora', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me/contrasena')
      .send({ contrasenaActual: CLAVE, contrasenaNueva: CLAVE });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/distinta de la actual/);
  });
});

// ============================================
// El codigo que distingue un 401 de sesion
//
// Es un contrato con el frontend, y de los que si se rompen hacen dano en
// silencio. El cliente trata los dos casos de forma OPUESTA: el de sesion
// cierra la sesion y lleva al login; el de contrasena equivocada se queda en
// el formulario para poder reintentar.
//
// Si los 401 del middleware perdieran el codigo, el frontend volveria al
// defecto que esto arreglo: quedarse en una pantalla muerta ensenando
// "Token invalido o vencido" y, peor, diciendo que el negocio no tiene
// contenido ni codigo QR ni estadisticas.
//
// Si al contrario lo llevara un 401 de contrasena, equivocarse al teclear
// echaria a la persona de la aplicacion.
//
// Por eso lo dice el servidor y no lo adivina el cliente comparando frases.
// ============================================

describe('los 401 de sesion llevan codigo', () => {
  test('sin cabecera de autorizacion', async () => {
    const respuesta = await request(app).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });

  test('con un token que no es un token', async () => {
    const respuesta = await como('esto-no-es-un-jwt').get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });

  test('con un token bien firmado pero sin jti', async () => {
    const { id } = await crearCuenta();

    const sinJti = jwt.sign(
      { id, correo: 'da@igual.co', rol: 'empresa' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    const respuesta = await como(sinJti).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });

  test('con la sesion ya cerrada', async () => {
    const { token } = await crearCuenta();

    await como(token).post('/api/auth/logout');

    const respuesta = await como(token).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });

  test('con la cuenta restringida despues de entrar', async () => {
    const cuenta = await crearCuenta();

    await pool.execute(
      "UPDATE usuario SET estado = 'restringido' WHERE id_usuario = ?",
      [cuenta.id]
    );

    const respuesta = await como(cuenta.token).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });

  // El caso de las dos pestanas: se cambia la contrasena en una y la otra se
  // queda con un token emitido antes del corte.
  //
  // El segundo de espera hace falta y no es un apano de la prueba: el
  // middleware compara con `<` estricto a proposito, para que el token que
  // recibe quien ACABA de cambiar su contrasena -emitido en el mismo segundo
  // del corte- siga valiendo. Sin la espera, el token de la otra pestana
  // cae en ese mismo segundo y sobrevive. Fuera de una prueba las dos cosas
  // nunca pasan en el mismo segundo.
  test('con un token de antes de cambiar la contrasena', async () => {
    const cuenta = await crearCuenta();
    const otraPestana = await entrar(cuenta.correo);

    await new Promise((listo) => setTimeout(listo, 1100));

    await como(cuenta.token).put('/api/usuarios/me/contrasena').send({
      contrasenaActual: CLAVE,
      contrasenaNueva: 'OtraClave1*'
    });

    const respuesta = await como(otraPestana).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });

  // La descarga del codigo QR tiene su propio camino en el frontend, asi que
  // conviene dejar comprobado que el servidor la rechaza igual.
  test('tambien al pedir la descarga del codigo', async () => {
    const respuesta = await request(app).get('/api/qr/descargar/png');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });
});

describe('los 401 que NO son de sesion no lo llevan', () => {
  // Los tres que piden confirmar la contrasena. Si el frontend los tratara
  // como una sesion muerta, quien se equivoque al teclear acabaria en el
  // login habiendo perdido lo que estaba escribiendo.
  test('la contrasena equivocada al cambiar el correo', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me').send({
      nombre: 'Nombre Valido',
      correo: correoNuevo(),
      contrasena: 'EstaNoEsLaClave1*'
    });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBeUndefined();
  });

  test('la contrasena actual equivocada al cambiarla', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me/contrasena').send({
      contrasenaActual: 'EstaNoEsLaClave1*',
      contrasenaNueva: 'OtraClave1*'
    });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBeUndefined();
  });

  test('la contrasena equivocada al darse de baja', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).delete('/api/usuarios/me')
      .send({ contrasena: 'EstaNoEsLaClave1*' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBeUndefined();
  });

  // Y entrar con credenciales que no son: tampoco es una sesion que se
  // murio, es una que nunca empezo.
  test('las credenciales equivocadas al entrar', async () => {
    const { correo } = await crearCuenta();

    const respuesta = await request(app).post('/api/auth/login')
      .send({ correo, contrasena: 'EstaNoEsLaClave1*' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBeUndefined();
  });
});
