// ============================================
// TESTS/CONTENIDO.TEST.JS — RF-05 y RF-06
// ============================================

const { crearCuenta, agregarBloque, como } = require('./ayudas');

describe('Agregar contenido (RF-05)', () => {
  test('un enlace se guarda con su categoria y su seccion', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Ver el menú',
      detalle: 'https://ejemplo.co/menu',
      idCategoria: 4,
      seccion: 'menu'
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.titulo).toBe('Ver el menú');
    expect(respuesta.body.data.activo).toBe(true);

    // El identificador es compuesto porque la API junta dos tablas: sin el
    // prefijo, el enlace 3 y el elemento 3 serian el mismo "3"
    expect(respuesta.body.data.id).toMatch(/^enlace-\d+$/);
  });

  test('un texto va a la otra tabla y se nota en el identificador', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'texto',
      titulo: 'Sobre nosotros',
      detalle: 'Sabor casero desde 2015',
      idCategoria: 1,
      seccion: 'menu'
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.id).toMatch(/^elemento-\d+$/);
  });

  test('el WhatsApp acepta un telefono y lo guarda como enlace', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Escríbenos',
      detalle: '+57 300 456 7890',
      idCategoria: 1,
      seccion: 'menu'
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.detalle).toBe('https://wa.me/573004567890');
  });

  test.each([
    ['no es una URL', { detalle: 'esto no es una direccion', idCategoria: 4 }],
    ['usa javascript:', { detalle: 'javascript:alert(1)', idCategoria: 4 }],
    ['no tiene titulo', { titulo: '', idCategoria: 4 }],
    ['tiene un tipo inventado', { tipo: 'holograma', idCategoria: 4 }],
    ['usa una categoria que no existe', { idCategoria: 9999 }]
  ])('rechaza un bloque que %s', async (_, cambios) => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Un enlace',
      detalle: 'https://ejemplo.co',
      idCategoria: 4,
      seccion: 'menu',
      ...cambios
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('Gestion del contenido (RF-06)', () => {
  test('la lista llega plana y agrupada por seccion', async () => {
    const { token } = await crearCuenta();

    await agregarBloque(token, { titulo: 'En el menu', seccion: 'menu' });
    await agregarBloque(token, { titulo: 'En promos', seccion: 'promos' });

    const respuesta = await como(token).get('/api/contenido');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(2);
    expect(Object.keys(respuesta.body.porSeccion).sort()).toEqual(['menu', 'promos']);
  });

  test('desactivar no es borrar', async () => {
    const { token } = await crearCuenta();

    const id = await agregarBloque(token, { titulo: 'Promo de temporada' });
    await agregarBloque(token, { titulo: 'Otro, para que quede contenido activo' });

    const apagado = await como(token).patch(`/api/contenido/${id}/estado`).send({ activo: false });

    expect(apagado.status).toBe(200);
    expect(apagado.body.data.activo).toBe(false);

    // Sigue en el panel: sirve para una promocion que vuelve cada temporada
    const lista = await como(token).get('/api/contenido');
    expect(lista.body.data.map((i) => i.id)).toContain(id);
  });

  test('el contenido de una cuenta no se toca desde otra', async () => {
    const duena = await crearCuenta();
    const intrusa = await crearCuenta();

    const id = await agregarBloque(duena.token);

    expect((await como(intrusa.token).delete(`/api/contenido/${id}`)).status).toBe(404);
    // Con el cuerpo completo, para que llegue a la comprobacion de quien es
    // dueno: un cuerpo incompleto daria 400 antes, y la prueba no probaria
    // lo que dice probar
    expect(
      (await como(intrusa.token).put(`/api/contenido/${id}`).send({
        titulo: 'Secuestrado',
        detalle: 'https://ejemplo.co/otro',
        idCategoria: 4,
        seccion: 'menu'
      })).status
    ).toBe(404);

    // Y sigue intacto
    expect((await como(duena.token).get('/api/contenido')).body.data).toHaveLength(1);
  });

  test('reordenar cambia las posiciones', async () => {
    const { token } = await crearCuenta();

    const primero = await agregarBloque(token, { titulo: 'Primero' });
    const segundo = await agregarBloque(token, { titulo: 'Segundo' });

    const respuesta = await como(token)
      .put('/api/contenido/orden')
      .send({ ids: [segundo, primero] });

    expect(respuesta.status).toBe(200);

    const lista = (await como(token).get('/api/contenido')).body.porSeccion.menu;

    expect(lista.map((i) => i.titulo)).toEqual(['Segundo', 'Primero']);
  });

  test('un identificador con forma invalida da 400, no 500', async () => {
    const { token } = await crearCuenta();

    expect((await como(token).delete('/api/contenido/12')).status).toBe(400);
    expect((await como(token).delete('/api/contenido/invento-3')).status).toBe(400);
  });
});

// La regla que figuraba en el README como "prevista" y no estaba en el
// codigo. El modulo 4 no genera un codigo QR para un perfil vacio; sin esto,
// esa garantia duraba lo que tardara el dueno en quitar su ultimo bloque.
describe('No se deja vacio un perfil que ya tiene codigo QR', () => {
  /** Deja la cuenta con un solo bloque activo y un codigo QR emitido. */
  async function conCodigoYUnBloque() {
    const { token } = await crearCuenta();

    const id = await agregarBloque(token, { titulo: 'El unico' });

    expect((await como(token).post('/api/qr')).status).toBe(201);

    return { token, id };
  }

  test('no deja borrar el ultimo bloque activo', async () => {
    const { token, id } = await conCodigoYUnBloque();

    const respuesta = await como(token).delete(`/api/contenido/${id}`);

    expect(respuesta.status).toBe(409);
    expect((await como(token).get('/api/contenido')).body.data).toHaveLength(1);
  });

  test('tampoco deja desactivarlo', async () => {
    const { token, id } = await conCodigoYUnBloque();

    // Comprobar solo el borrado se esquivaria por aqui: desactivar deja el
    // perfil igual de vacio
    expect((await como(token).patch(`/api/contenido/${id}/estado`).send({ activo: false })).status)
      .toBe(409);
  });

  test('con otro bloque activo, se puede quitar', async () => {
    const { token, id } = await conCodigoYUnBloque();

    await agregarBloque(token, { titulo: 'Un segundo bloque' });

    expect((await como(token).delete(`/api/contenido/${id}`)).status).toBe(200);
  });

  test('un bloque que ya estaba inactivo si se puede borrar', async () => {
    const { token, id } = await conCodigoYUnBloque();

    const otro = await agregarBloque(token, { titulo: 'Para poder apagar el primero' });
    await como(token).patch(`/api/contenido/${otro}/estado`).send({ activo: false });

    // Borrarlo no cambia cuantos activos quedan, asi que no hay nada que
    // proteger
    expect((await como(token).delete(`/api/contenido/${otro}`)).status).toBe(200);
    expect((await como(token).delete(`/api/contenido/${id}`)).status).toBe(409);
  });

  test('sin codigo QR, el perfil si puede quedarse vacio', async () => {
    const { token } = await crearCuenta();

    const id = await agregarBloque(token);

    // Mientras el perfil se esta armando no hay nada que proteger, y
    // bloquearlo atraparia a quien se equivoco al escribir su primer enlace
    expect((await como(token).delete(`/api/contenido/${id}`)).status).toBe(200);
    expect((await como(token).get('/api/contenido')).body.data).toHaveLength(0);
  });

  test('con el codigo apagado tambien, que es la via para vaciarlo a proposito', async () => {
    const { token, id } = await conCodigoYUnBloque();

    expect((await como(token).patch('/api/qr/estado').send({ activo: false })).status).toBe(200);
    expect((await como(token).delete(`/api/contenido/${id}`)).status).toBe(200);
  });
});
