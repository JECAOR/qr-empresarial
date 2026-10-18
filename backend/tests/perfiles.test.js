// ============================================
// TESTS/PERFILES.TEST.JS — RF-04, RF-10 y el tema (RF-12)
// ============================================

const { crearCuenta, como } = require('./ayudas');

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
