// ============================================
// TESTS/PERFILES.TEST.JS — RF-04, RF-10 y el tema (RF-12)
// ============================================

const { app, request, CLAVE, crearCuenta, entrar, como } = require('./ayudas');

const pool = require('../src/config/database');

describe('Perfil empresarial (RF-04)', () => {
  test('el registro ya deja el perfil creado, con su slug', async () => {
    const { token } = await crearCuenta({ nombreNegocio: 'Café Raíces del Sur' });

    const respuesta = await como(token).get('/api/perfiles/me');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.nombreNegocio).toBe('Café Raíces del Sur');

    // Las tildes y los espacios no caben en una URL
    expect(respuesta.body.data.slug).toBe('cafe-raices-del-sur');
  });

  test('se guarda y se vuelve a leer igual', async () => {
    const { token } = await crearCuenta();

    const guardado = await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Panaderia Nueva',
      categoria: 'Panaderia artesanal',
      descripcion: 'Pan de masa madre',
      direccion: 'Calle 12 #3-45',
      telefono: '+57 300 111 2233',
      correoContacto: 'hola@panaderia.co',
      instagram: '@panaderianueva',
      horario: 'Lun-Sab 6:00-19:00'
    });

    expect(guardado.status).toBe(200);

    const leido = await como(token).get('/api/perfiles/me');

    expect(leido.body.data.categoria).toBe('Panaderia artesanal');
    expect(leido.body.data.telefono).toBe('+57 300 111 2233');
  });

  test('la direccion publica no cambia al renombrar el negocio', async () => {
    const { token } = await crearCuenta({ nombreNegocio: 'Nombre Viejo' });

    const antes = (await como(token).get('/api/perfiles/me')).body.data.slug;

    await como(token).put('/api/perfiles/me').send({ nombreNegocio: 'Nombre Completamente Otro' });

    const despues = (await como(token).get('/api/perfiles/me')).body.data.slug;

    // Si el slug siguiera al nombre, los codigos QR ya impresos dejarian de
    // funcionar, que es justo lo que el RF-09 debe evitar
    expect(despues).toBe(antes);
  });

  test('el slug no se acepta del cliente', async () => {
    const { token } = await crearCuenta({ nombreNegocio: 'Negocio Con Slug' });

    const antes = (await como(token).get('/api/perfiles/me')).body.data.slug;

    await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Negocio Con Slug',
      slug: 'el-que-yo-quiera'
    });

    expect((await como(token).get('/api/perfiles/me')).body.data.slug).toBe(antes);
  });

  test('cada cuenta solo ve su propio perfil', async () => {
    const una = await crearCuenta({ nombreNegocio: 'Negocio Uno' });
    const otra = await crearCuenta({ nombreNegocio: 'Negocio Dos' });

    expect((await como(una.token).get('/api/perfiles/me')).body.data.nombreNegocio)
      .toBe('Negocio Uno');
    expect((await como(otra.token).get('/api/perfiles/me')).body.data.nombreNegocio)
      .toBe('Negocio Dos');
  });
});

describe('Validacion del perfil (RF-10)', () => {
  test('el nombre del negocio es obligatorio', async () => {
    const { token } = await crearCuenta();

    expect((await como(token).put('/api/perfiles/me').send({ nombreNegocio: '' })).status).toBe(400);
    expect((await como(token).put('/api/perfiles/me').send({ nombreNegocio: 'A' })).status).toBe(400);
  });

  test.each([
    ['correoContacto', 'no-es-un-correo'],
    ['instagram', 'con espacios y simbolos!'],
    ['imagen', 'ftp://ejemplo.co/logo.png']
  ])('rechaza un %s con formato invalido', async (campo, valor) => {
    const { token } = await crearCuenta();

    const respuesta = await como(token)
      .put('/api/perfiles/me')
      .send({ nombreNegocio: 'Negocio Valido', [campo]: valor });

    expect(respuesta.status).toBe(400);
  });

  test('de las URL solo se aceptan http y https', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Negocio Valido',
      imagen: 'javascript:alert(1)'
    });

    // Un javascript: guardado aqui acabaria ejecutandose en la vista publica
    expect(respuesta.status).toBe(400);
  });
});

describe('Tema del negocio (RF-12)', () => {
  test('nace en indigo y se cambia con su propio endpoint', async () => {
    const { token } = await crearCuenta();

    expect((await como(token).get('/api/perfiles/me')).body.data.tema).toBe('indigo');

    const respuesta = await como(token).patch('/api/perfiles/me/tema').send({ tema: 'teal' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.tema).toBe('teal');
  });

  test('cambiar el tema no toca ningun otro dato del perfil', async () => {
    const { token } = await crearCuenta({ nombreNegocio: 'Panaderia La Espiga' });

    await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Panaderia La Espiga',
      categoria: 'Panaderia',
      direccion: 'Av. 68 #40-12',
      telefono: '+57 301 222 3344'
    });

    const respuesta = await como(token).patch('/api/perfiles/me/tema').send({ tema: 'terracota' });

    // La razon de que el tema tenga endpoint propio: antes el selector de
    // color mandaba el perfil entero desde la cache del navegador, y con la
    // cache sin sincronizar reemplazaba el negocio real por los de ejemplo
    expect(respuesta.body.data.nombreNegocio).toBe('Panaderia La Espiga');
    expect(respuesta.body.data.categoria).toBe('Panaderia');
    expect(respuesta.body.data.direccion).toBe('Av. 68 #40-12');
    expect(respuesta.body.data.telefono).toBe('+57 301 222 3344');
    expect(respuesta.body.data.tema).toBe('terracota');
  });

  test('solo valen los tres temas que existen en el CSS', async () => {
    const { token } = await crearCuenta();

    expect((await como(token).patch('/api/perfiles/me/tema').send({ tema: 'fucsia' })).status)
      .toBe(400);
  });

  test('guardar otros datos no devuelve el color a indigo', async () => {
    const { token } = await crearCuenta();

    await como(token).patch('/api/perfiles/me/tema').send({ tema: 'teal' });

    // El formulario del negocio no manda el tema: se cambia con su propio
    // selector. Sin el COALESCE, guardar el telefono lo devolveria a indigo
    await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Negocio de Prueba',
      telefono: '+57 300 000 0000'
    });

    expect((await como(token).get('/api/perfiles/me')).body.data.tema).toBe('teal');
  });
});

// ============================================
// Las cuentas SIN perfil empresarial
//
// Las crea el administrador desde POST /api/usuarios, que no crea perfil: el
// registro publico si lo crea, dentro de la misma transaccion. Son el caso
// que el codigo contempla en tres sitios y que no probaba nadie.
// ============================================

/** Una cuenta de empresa creada por el administrador, sin perfil. */
async function cuentaSinPerfil() {
  const base = await crearCuenta({ nombreNegocio: 'Negocio del Administrador' });

  await pool.execute("UPDATE usuario SET rol = 'administrador' WHERE correo = ?", [base.correo]);

  const admin = await entrar(base.correo);
  const correo = `sin.perfil.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@ejemplo.co`;

  const creada = await como(admin).post('/api/usuarios').send({
    nombre: 'Cuenta Sin Perfil',
    correo,
    contrasena: CLAVE,
    rol: 'empresa'
  });

  expect(creada.status).toBe(201);

  return { token: await entrar(correo), correo };
}

describe('una cuenta sin perfil empresarial', () => {
  test('al pedir su perfil recibe un 404 que lo explica', async () => {
    const { token } = await cuentaSinPerfil();

    const respuesta = await como(token).get('/api/perfiles/me');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/todavía no tiene un perfil/i);
  });

  // El PUT hace las veces de alta: sin esto, una cuenta creada por el
  // administrador no tendria forma de estrenar su perfil desde la pantalla.
  test('al guardar el perfil por primera vez, se crea', async () => {
    const { token } = await cuentaSinPerfil();

    const guardado = await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Estrenando Perfil'
    });

    expect(guardado.status).toBe(200);

    const leido = await como(token).get('/api/perfiles/me');

    expect(leido.status).toBe(200);
    expect(leido.body.data.nombreNegocio).toBe('Estrenando Perfil');

    // Y con su direccion publica, que es lo que hace util al perfil
    expect(leido.body.data.slug).toBe('estrenando-perfil');
  });

  test('al cambiar el color de marca recibe el mismo 404', async () => {
    const { token } = await cuentaSinPerfil();

    const respuesta = await como(token).patch('/api/perfiles/me/tema').send({ tema: 'teal' });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/todavía no tiene un perfil/i);
  });
});

// ============================================
// La carrera por el slug
//
// Entre comprobar que una direccion publica esta libre y escribirla, otro
// registro simultaneo puede tomarla: cada transaccion no ve las filas que la
// otra todavia no confirmo. El UNIQUE de la columna lo impide y el servicio
// lo resuelve con un sufijo aleatorio.
//
// Era la rama menos cubierta del backend —la mitad de perfil.service.js sin
// ejecutar nunca— y la que mas duele si esta mal: el segundo negocio no
// podria registrarse, o acabaria con la direccion del primero.
//
// La carrera se provoca sin fingir el error: el choque y el ER_DUP_ENTRY son
// de MySQL de verdad. Lo unico que se simula es la comprobacion previa, que
// dice «libre» —que es exactamente lo que ve una transaccion mientras la otra
// no ha confirmado—.
// ============================================

const perfilService = require('../src/modules/perfiles/perfil.service');
const perfilRepository = require('../src/modules/perfiles/perfil.repository');

/** El id de una cuenta, por su correo. */
async function idDe(correo) {
  const [filas] = await pool.execute('SELECT id_usuario FROM usuario WHERE correo = ?', [correo]);

  return filas[0].id_usuario;
}

describe('cuando dos negocios se registran a la vez con el mismo nombre', () => {
  afterEach(() => jest.restoreAllMocks());

  test('el segundo se queda con un sufijo y los dos quedan creados', async () => {
    const primero = await crearCuenta({ nombreNegocio: 'Choque Simultaneo' });
    const segunda = await cuentaSinPerfil();

    expect(primero.slug).toBe('choque-simultaneo');

    // Lo que ve una transaccion que mira antes de que la otra confirme
    jest.spyOn(perfilRepository, 'slugEnUso').mockResolvedValue(false);

    const creado = await perfilService.crearParaUsuario({
      idUsuario: await idDe(segunda.correo),
      nombreNegocio: 'Choque Simultaneo'
    });

    // Mismo arranque, sufijo de seis caracteres: no es el "-2" del camino
    // tranquilo, sino el aleatorio del choque
    expect(creado.slug).toMatch(/^choque-simultaneo-[0-9a-f]{6}$/);

    // Y existe de verdad, que es lo que importa: la cuenta tiene perfil
    const leido = await como(segunda.token).get('/api/perfiles/me');

    expect(leido.status).toBe(200);
    expect(leido.body.data.slug).toBe(creado.slug);
  });

  // El del primero no se toca: quien ya tenia su direccion impresa en un
  // codigo QR no puede perderla porque otro se registre con el mismo nombre.
  test('la direccion del primero sigue siendo la suya', async () => {
    const primero = await crearCuenta({ nombreNegocio: 'No Me Pises' });
    const segunda = await cuentaSinPerfil();

    jest.spyOn(perfilRepository, 'slugEnUso').mockResolvedValue(false);

    await perfilService.crearParaUsuario({
      idUsuario: await idDe(segunda.correo),
      nombreNegocio: 'No Me Pises'
    });

    const publico = await request(app).get(`/api/publico/${primero.slug}`);

    expect(publico.status).not.toBe(404);
    expect(primero.slug).toBe('no-me-pises');
  });

  // Un error que NO sea el del slug repetido tiene que subir tal cual:
  // taparlos todos con el reintento escondería un fallo de verdad.
  test('un fallo que no es el slug repetido no se disimula', async () => {
    const segunda = await cuentaSinPerfil();

    jest.spyOn(perfilRepository, 'slugEnUso').mockResolvedValue(false);
    jest.spyOn(perfilRepository, 'crear').mockRejectedValue(
      Object.assign(new Error('Se cayó la base'), { code: 'ECONNRESET' })
    );

    await expect(perfilService.crearParaUsuario({
      idUsuario: await idDe(segunda.correo),
      nombreNegocio: 'Da Igual'
    })).rejects.toThrow('Se cayó la base');
  });
});

describe('cuando el nombre ya lo usan doscientos negocios', () => {
  afterEach(() => jest.restoreAllMocks());

  // El limite existe para no quedarse en un bucle infinito. Doscientos
  // homonimos estan muy por encima de lo que este sistema va a ver, pero si
  // se llegara hay que decirlo y no colgarse.
  test('se rinde con un 409 en lugar de buscar para siempre', async () => {
    jest.spyOn(perfilRepository, 'slugEnUso').mockResolvedValue(true);

    await expect(perfilService.generarSlugUnico('Nombre Agotado'))
      .rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/No se pudo generar una dirección pública/)
      });
  });

  test('y lo intenta doscientas veces antes de rendirse, no una', async () => {
    const espia = jest.spyOn(perfilRepository, 'slugEnUso').mockResolvedValue(true);

    await expect(perfilService.generarSlugUnico('Nombre Agotado')).rejects.toThrow();

    // La base, mas los sufijos del 2 al 200
    expect(espia).toHaveBeenCalledTimes(200);
  });
});
