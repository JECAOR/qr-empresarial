// ============================================
// TESTS/AUTH.TEST.JS — RF-01, RF-02 y RF-03
//
// Es el archivo que mas importa de la suite: aqui estan las reglas que, si
// se rompen, no dan un error visible sino un agujero. Un 401 que pasa a 200
// no hace fallar ninguna pantalla.
// ============================================

const { app, request, CLAVE, correoNuevo, crearCuenta, entrar, como } = require('./ayudas');

const pool = require('../src/config/database');

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
