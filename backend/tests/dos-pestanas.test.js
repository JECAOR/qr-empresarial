// ============================================
// TESTS/DOS-PESTANAS.TEST.JS — la misma cuenta actuando dos veces
//
// La octava vara de medir, y una de las que salio de preguntar que
// mantuvieron CONSTANTE las siete anteriores: todas usaron un solo cliente.
// Aqui hay dos, con la misma cuenta, cada uno con su token y cada uno con
// datos cargados en un momento distinto.
//
// Es facil de alcanzar sin pretenderlo: el panel se abre en dos pestañas, o
// en el computador del mostrador y en el telefono. Lo que puede doler no es
// la sesion -eso lo resuelve el 401 con codigo, v3.16.0- sino el ESTADO
// VIEJO: una pestaña que guarda algo decidido sobre datos que la otra ya
// cambio.
//
// Casi todo salio bien, y estas pruebas estan para que siga saliendo bien:
// son propiedades que hoy se cumplen por como esta escrito el codigo y que
// un cambio pequeño podria romper sin que nada mas se queje. La unica que
// NO es un acierto esta al final, documentada como lo que es: una decision.
// ============================================

const { app, request, CLAVE, crearCuenta, entrar, agregarBloque, como } = require('./ayudas');
const pool = require('../src/config/database');

/** La misma cuenta abierta dos veces, con un token cada una. */
async function dosPestanas() {
  const cuenta = await crearCuenta();

  return { a: cuenta.token, b: await entrar(cuenta.correo), cuenta };
}

/** El contenido tal como lo ve el dueño. */
async function contenidoDe(token) {
  const respuesta = await como(token).get('/api/contenido');

  return respuesta.body.data;
}

describe('reordenar con una lista vieja', () => {
  // La pantalla manda los ids de la seccion en el orden nuevo. Si la otra
  // pestaña agrego un bloque mientras tanto, esa lista va incompleta.
  //
  // No pasa nada malo, y la razon es siguienteOrden(): un bloque nuevo nace
  // con MAX(orden) + 1 de su seccion, siempre por encima de todo lo que
  // hubiera. Asi que reordenar los que la lista conoce no puede chocar con
  // el que no conoce.
  test('se reordena lo conocido y lo nuevo conserva su sitio', async () => {
    const { a, b } = await dosPestanas();

    const uno = await agregarBloque(a, { titulo: 'Primero' });
    const dos = await agregarBloque(a, { titulo: 'Segundo' });

    // B carga la lista aqui: ve dos
    await contenidoDe(b);

    // A agrega un tercero, que B no conoce
    await agregarBloque(a, { titulo: 'Tercero' });

    const orden = await como(b).put('/api/contenido/orden').send({ ids: [dos, uno] });

    expect(orden.status).toBe(200);

    const items = await contenidoDe(a);
    const porTitulo = Object.fromEntries(items.map((i) => [i.titulo, i.orden]));

    expect(porTitulo.Segundo).toBe(1);
    expect(porTitulo.Primero).toBe(2);
    expect(porTitulo.Tercero).toBe(3);
  });

  test('y no se pierde ningun bloque', async () => {
    const { a, b } = await dosPestanas();

    const uno = await agregarBloque(a, { titulo: 'Primero' });
    const dos = await agregarBloque(a, { titulo: 'Segundo' });

    await agregarBloque(a, { titulo: 'Tercero' });

    await como(b).put('/api/contenido/orden').send({ ids: [dos, uno] });

    const items = await contenidoDe(a);

    expect(items).toHaveLength(3);
    expect(items.map((i) => i.titulo).sort()).toEqual(['Primero', 'Segundo', 'Tercero']);
  });

  // Y al contrario: la lista lleva un bloque que la otra pestaña ya borro.
  //
  // reordenarContenido() comprueba TODOS los ids antes de tocar el primero,
  // asi que la operacion es entera o nada. Sin eso, la seccion quedaria a
  // medio reordenar: unos bloques con el orden nuevo y otros con el viejo, y
  // el dueño viendo una lista que no es ni la de antes ni la que pidio.
  test('con un bloque que ya no existe no se aplica nada', async () => {
    const { a, b } = await dosPestanas();

    const uno = await agregarBloque(a, { titulo: 'Primero' });
    const dos = await agregarBloque(a, { titulo: 'Segundo' });
    const tres = await agregarBloque(a, { titulo: 'Tercero' });

    const antes = await contenidoDe(a);
    const ordenAntes = Object.fromEntries(antes.map((i) => [i.titulo, i.orden]));

    await como(a).delete(`/api/contenido/${dos}`);

    // B reordena con su lista, que todavia incluye el borrado
    const orden = await como(b).put('/api/contenido/orden').send({ ids: [tres, dos, uno] });

    expect(orden.status).toBe(404);

    const despues = await contenidoDe(a);
    const ordenDespues = Object.fromEntries(despues.map((i) => [i.titulo, i.orden]));

    // Ni el primero ni el tercero se movieron: entera o nada
    expect(ordenDespues.Primero).toBe(ordenAntes.Primero);
    expect(ordenDespues.Tercero).toBe(ordenAntes.Tercero);
  });
});

describe('el bloque que la otra pestaña ya borro', () => {
  // La pantalla sigue ensenandolo con sus botones. Lo que no puede pasar es
  // un 500, ni un 200 que haga creer que se edito algo.
  test.each([
    ['editar', (token, id, categoria) => como(token).put(`/api/contenido/${id}`).send({
      tipo: 'enlace',
      titulo: 'Editado sin saber',
      detalle: 'https://ejemplo.co',
      idCategoria: categoria
    })],
    ['apagar', (token, id) => como(token).patch(`/api/contenido/${id}/estado`).send({ activo: false })],
    ['borrar otra vez', (token, id) => como(token).delete(`/api/contenido/${id}`)]
  ])('%s da 404 y lo explica', async (_, accion) => {
    const { a, b } = await dosPestanas();

    const id = await agregarBloque(a, { titulo: 'El que desaparece' });
    const categorias = (await como(b).get('/api/contenido/categorias')).body.data;

    await como(a).delete(`/api/contenido/${id}`);

    const respuesta = await accion(b, id, categorias.enlaces[0].id);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/no existe o no pertenece/);
  });
});

describe('generar el codigo QR desde las dos', () => {
  // La segunda pestaña sigue ensenando «Generar mi codigo» porque cargo
  // antes de que la primera lo generara. Pulsarlo no puede crear un segundo
  // codigo: la direccion publica cambiaria y lo que se hubiera repartido o
  // impreso dejaria de llevar a ninguna parte.
  test('no se crea un segundo codigo', async () => {
    const { a, b, cuenta } = await dosPestanas();

    await agregarBloque(a);

    const primero = await como(a).post('/api/qr');
    const segundo = await como(b).post('/api/qr');

    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(200);

    const [filas] = await pool.execute(
      `SELECT COUNT(*) AS total FROM codigo_qr
       WHERE id_perfil = (SELECT id_perfil FROM perfil_empresarial WHERE id_usuario = ?)`,
      [cuenta.id]
    );

    expect(filas[0].total).toBe(1);
  });

  test('y la direccion publica sigue siendo la misma', async () => {
    const { a, b } = await dosPestanas();

    await agregarBloque(a);

    const primero = await como(a).post('/api/qr');
    const segundo = await como(b).post('/api/qr');

    expect(segundo.body.data.url).toBe(primero.body.data.url);
  });

  // Y se dice que ya existia, en lugar de contestar como si lo acabara de
  // crear. Es el texto que la pantalla ensena: decir «Código generado» haria
  // creer que el codigo es nuevo y que lo repartido antes ya no sirve.
  test('se dice que ya existia, no que se acaba de generar', async () => {
    const { a, b } = await dosPestanas();

    await agregarBloque(a);
    await como(a).post('/api/qr');

    const segundo = await como(b).post('/api/qr');

    expect(segundo.body.message).toMatch(/ya tenía un código QR/);
  });
});

describe('la sesion de cada pestaña es la suya', () => {
  // Cerrar sesion revoca ESE token, por su jti, no todos los de la cuenta.
  // Si cerrara todos, salir en el telefono echaria a quien esta trabajando
  // en el computador del mostrador.
  test('cerrar una no cierra la otra', async () => {
    const { a, b } = await dosPestanas();

    await como(a).post('/api/auth/logout');

    expect((await como(a).get('/api/usuarios/me')).status).toBe(401);
    expect((await como(b).get('/api/usuarios/me')).status).toBe(200);
  });

  // La baja si: la cuenta ya no existe para nadie. Y llega marcada como de
  // sesion, que es lo que hace que la otra pestaña lleve al login en lugar
  // de quedarse en pie ensenando pantallas vacias.
  test('darse de baja cierra la otra, y marcado como sesion', async () => {
    const { a, b } = await dosPestanas();

    await como(a).delete('/api/usuarios/me').send({ contrasena: CLAVE });

    const respuesta = await como(b).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.codigo).toBe('sesion');
  });
});

describe('guardar el perfil desde las dos: gana la ultima', () => {
  // ESTO NO ES UN ACIERTO, ES UNA DECISION, y se deja escrita aqui para que
  // sea una decision y no un descuido.
  //
  // Las dos pestañas son del MISMO dueño y guardan el perfil de SU negocio.
  // La ultima escritura se queda, y la anterior se pierde sin aviso. Lo
  // mismo con el tema de color.
  //
  // Evitarlo pide bloqueo optimista: una version o un ETag en el perfil, un
  // 409 cuando no coincide y una pantalla que sepa explicar «esto cambio
  // desde otro sitio, mira lo que hay ahora». Es una funcionalidad entera, y
  // para un negocio con un solo dueño el caso es raro y el daño es que se
  // pierde un cambio propio que se puede volver a escribir. Si algun dia el
  // perfil lo administraran dos personas distintas, esto cambia de tamaño y
  // habria que hacerlo.
  //
  // La prueba esta para que el dia que alguien implemente el bloqueo, falle
  // y le recuerde que esto era deliberado.
  test('la segunda escritura reemplaza la primera, sin 409', async () => {
    const { a, b } = await dosPestanas();

    const visto = (await como(b).get('/api/perfiles/me')).body.data;

    await como(a).put('/api/perfiles/me').send({
      nombreNegocio: visto.nombreNegocio,
      descripcion: 'Lo que escribio la primera pestaña'
    });

    const segunda = await como(b).put('/api/perfiles/me').send({
      nombreNegocio: visto.nombreNegocio,
      descripcion: 'Lo que escribio la segunda, con datos de antes'
    });

    expect(segunda.status).toBe(200);

    const final = (await como(a).get('/api/perfiles/me')).body.data;

    expect(final.descripcion).toBe('Lo que escribio la segunda, con datos de antes');
  });

  test('y lo mismo con el color de marca', async () => {
    const { a, b } = await dosPestanas();

    await como(a).patch('/api/perfiles/me/tema').send({ tema: 'teal' });
    await como(b).patch('/api/perfiles/me/tema').send({ tema: 'terracota' });

    const final = (await como(a).get('/api/perfiles/me')).body.data;

    expect(final.tema).toBe('terracota');
  });
});
