// ============================================
// TESTS/CONTENIDO.TEST.JS — RF-05 y RF-06
// ============================================

const { app, request, CLAVE, crearCuenta, entrar, agregarBloque, como } = require('./ayudas');

const pool = require('../src/config/database');

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

// ============================================
// GET /api/contenido/categorias
//
// Era el unico endpoint del backend sin ninguna prueba. No lo llama ninguna
// pantalla del panel por gusto: es el que llena el desplegable del
// formulario de contenido, asi que lo que devuelva decide que puede elegir
// el negocio al crear un bloque.
// ============================================

describe('Las categorias disponibles', () => {
  test('vienen en dos listas: enlaces y elementos', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).get('/api/contenido/categorias');

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.data.enlaces)).toBe(true);
    expect(Array.isArray(respuesta.body.data.elementos)).toBe(true);
    expect(respuesta.body.data.enlaces.length).toBeGreaterThan(0);
    expect(respuesta.body.data.elementos.length).toBeGreaterThan(0);
  });

  // La pantalla pinta el nombre y guarda el id. Sin el icono no sabe que
  // dibujo poner al lado.
  test('cada una trae id, nombre e icono', async () => {
    const { token } = await crearCuenta();

    const { enlaces, elementos } = (await como(token).get('/api/contenido/categorias')).body.data;

    for (const categoria of [...enlaces, ...elementos]) {
      expect(typeof categoria.id).toBe('number');
      expect(typeof categoria.nombre).toBe('string');
      expect(categoria).toHaveProperty('icono');
    }
  });

  // Son las que pide el RF-05. Si faltara una, el negocio no podria publicar
  // ese tipo de enlace aunque el resto del sistema lo soporte.
  test('estan las de enlace que pide el requisito', async () => {
    const { token } = await crearCuenta();

    const { enlaces } = (await como(token).get('/api/contenido/categorias')).body.data;
    const nombres = enlaces.map((c) => c.nombre);

    expect(nombres).toEqual(expect.arrayContaining(['WhatsApp', 'Instagram', 'Google Maps']));
  });

  // El contrato de verdad: lo que ofrece este endpoint tiene que servir para
  // crear. Si las dos listas se cruzaran -una categoria de elemento ofrecida
  // como enlace-, el formulario ensenaria opciones que el POST rechaza.
  test('lo que ofrece sirve para crear un bloque de ese tipo', async () => {
    const { token } = await crearCuenta();

    const { enlaces, elementos } = (await como(token).get('/api/contenido/categorias')).body.data;

    const conEnlace = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Probando la primera categoria de enlace',
      detalle: 'https://ejemplo.co',
      idCategoria: enlaces[0].id
    });

    expect(conEnlace.status).toBe(201);

    const conElemento = await como(token).post('/api/contenido').send({
      tipo: 'texto',
      titulo: 'Probando la primera categoria de elemento',
      detalle: 'Un parrafo cualquiera',
      idCategoria: elementos[0].id
    });

    expect(conElemento.status).toBe(201);
  });

  // Las dos listas se numeran por separado, asi que un id de elemento puede
  // coincidir con uno de enlace. Mandarlo como enlace tiene que fallar.
  test('una categoria de elemento no vale como enlace', async () => {
    const { token } = await crearCuenta();

    const { enlaces, elementos } = (await como(token).get('/api/contenido/categorias')).body.data;

    const soloDeElemento = elementos.find((e) => !enlaces.some((l) => l.id === e.id));

    // Si todos los ids coincidieran no habria nada que comprobar aqui
    if (!soloDeElemento) return;

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Categoria equivocada',
      detalle: 'https://ejemplo.co',
      idCategoria: soloDeElemento.id
    });

    expect(respuesta.status).toBe(400);
  });

  // Van detras de autenticar(): las categorias son del panel, no de la
  // pagina publica.
  test('sin sesion no se devuelven', async () => {
    const respuesta = await como(null).get('/api/contenido/categorias');

    expect(respuesta.status).toBe(401);
  });
});

// ============================================
// Lo mismo, pero con textos y botones
//
// El esquema parte el contenido en dos tablas: `enlace` y `elemento`. Cada
// operacion de escritura elige tabla y columna con un ternario, y las
// pruebas solo habian entrado por el lado de los enlaces: activar, borrar y
// reordenar un texto no se habia ejecutado nunca.
//
// Si el nombre de la columna estuviera mal en esa rama —id_elemento—, borrar
// un texto no borraria nada y la pantalla diria que si, porque la respuesta
// no depende de las filas afectadas hasta que alguien las mira.
// ============================================

describe('los textos y botones se manejan igual que los enlaces', () => {
  /** Crea un bloque de texto y devuelve su identificador compuesto. */
  async function unTexto(token, titulo = 'Horneamos cada mañana') {
    const categorias = (await como(token).get('/api/contenido/categorias')).body.data;

    const creado = await como(token).post('/api/contenido').send({
      tipo: 'texto',
      titulo,
      detalle: 'Masa madre de fermentación lenta',
      idCategoria: categorias.elementos[0].id
    });

    expect(creado.status).toBe(201);

    return creado.body.data.id;
  }

  test('se desactiva y se vuelve a activar', async () => {
    const { token } = await crearCuenta();
    const id = await unTexto(token);

    const apagado = await como(token).patch(`/api/contenido/${id}/estado`).send({ activo: false });

    expect(apagado.status).toBe(200);

    const tras = (await como(token).get('/api/contenido')).body.data.find((b) => b.id === id);

    expect(tras.activo).toBe(false);

    const encendido = await como(token).patch(`/api/contenido/${id}/estado`).send({ activo: true });

    expect(encendido.status).toBe(200);
  });

  // Un texto desactivado no sale en la pagina publica, igual que un enlace.
  test('desactivado desaparece de la pagina publica', async () => {
    const cuenta = await crearCuenta();
    const id = await unTexto(cuenta.token, 'Texto que se va a apagar');

    await agregarBloque(cuenta.token);
    await como(cuenta.token).post('/api/qr');

    await como(cuenta.token).patch(`/api/contenido/${id}/estado`).send({ activo: false });

    const publico = await request(app).get(`/api/publico/${cuenta.slug}`);
    const titulos = publico.body.data.contenido.map((b) => b.titulo);

    expect(titulos).not.toContain('Texto que se va a apagar');
  });

  test('se borra de verdad, no solo en la respuesta', async () => {
    const { token } = await crearCuenta();
    const id = await unTexto(token);

    const borrado = await como(token).delete(`/api/contenido/${id}`);

    expect(borrado.status).toBe(200);

    const quedan = (await como(token).get('/api/contenido')).body.data.map((b) => b.id);

    expect(quedan).not.toContain(id);
  });

  test('y se reordena dentro de su seccion', async () => {
    const { token } = await crearCuenta();

    const primero = await unTexto(token, 'Primero de todos');
    const segundo = await unTexto(token, 'Segundo de todos');

    const reordenado = await como(token).put('/api/contenido/orden')
      .send({ ids: [segundo, primero] });

    expect(reordenado.status).toBe(200);

    const lista = (await como(token).get('/api/contenido')).body.data
      .filter((b) => [primero, segundo].includes(b.id))
      .map((b) => b.id);

    expect(lista).toEqual([segundo, primero]);
  });

  // El contenido es de cada negocio: el identificador no basta, hace falta
  // que sea suyo. Es la misma regla que ya se comprueba con los enlaces.
  test('los de otro negocio no se pueden tocar', async () => {
    const mia = await crearCuenta();
    const ajena = await crearCuenta();

    const id = await unTexto(ajena.token);

    const borrado = await como(mia.token).delete(`/api/contenido/${id}`);

    expect(borrado.status).toBe(404);

    const estado = await como(mia.token).patch(`/api/contenido/${id}/estado`).send({ activo: false });

    expect(estado.status).toBe(404);
  });
});

// ============================================
// Los limites del contenido
//
// Son las reglas que impiden guardar basura en las dos tablas del
// contenido. Casi ninguna se habia ejecutado: las pruebas entraban con
// datos buenos y con uno o dos malos.
// ============================================

describe('lo que no se acepta al crear un bloque', () => {
  const base = () => ({
    tipo: 'enlace',
    titulo: 'Un titulo cualquiera',
    detalle: 'https://ejemplo.co',
    idCategoria: 1
  });

  test.each([
    ['sin categoria', { idCategoria: undefined }, /indicar la categoría/],
    ['con una categoria que no es numero', { idCategoria: 'whatsapp' }, /indicar la categoría/],
    ['con una categoria cero', { idCategoria: 0 }, /indicar la categoría/],
    ['con una categoria negativa', { idCategoria: -3 }, /indicar la categoría/],
    ['con una categoria decimal', { idCategoria: 1.5 }, /indicar la categoría/]
  ])('%s', async (_, cambio, mensaje) => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).post('/api/contenido').send({ ...base(), ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(mensaje);
  });

  // Los largos son los de las columnas: pasarse no da un error de validacion
  // sino uno de MySQL, que llegaria como 500.
  test.each([
    ['el titulo', { titulo: 'T'.repeat(101) }, /titulo no puede superar los 100/],
    ['la seccion', { seccion: 'S'.repeat(61) }, /seccion no puede superar los 60/],
    ['el detalle', { detalle: `https://ejemplo.co/${'d'.repeat(2000)}` }, /detalle no puede superar los 2000/]
  ])('%s no puede pasarse de largo', async (_, cambio, mensaje) => {
    const { token } = await crearCuenta();

    const categorias = (await como(token).get('/api/contenido/categorias')).body.data;

    const respuesta = await como(token).post('/api/contenido')
      .send({ ...base(), idCategoria: categorias.enlaces[0].id, ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(mensaje);
  });
});

describe('activar o desactivar', () => {
  // Es un interruptor: "si", 1 o nada no son estados.
  test.each([
    ['sin el campo', {}],
    ['con una cadena', { activo: 'true' }],
    ['con un numero', { activo: 1 }],
    ['con nulo', { activo: null }]
  ])('%s se rechaza', async (_, cuerpo) => {
    const cuenta = await crearCuenta();
    const id = await agregarBloque(cuenta.token);

    const respuesta = await como(cuenta.token).patch(`/api/contenido/${id}/estado`).send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/activo debe ser true o false/);
  });
});

describe('reordenar', () => {
  test.each([
    ['sin la lista', {}, /lista de identificadores/],
    ['con una lista vacia', { ids: [] }, /lista de identificadores/],
    ['con algo que no es lista', { ids: 'enlace-1' }, /lista de identificadores/],
    ['con numeros en lugar de identificadores', { ids: [1, 2] }, /deben ser cadenas/],
    ['con una cadena vacia dentro', { ids: ['enlace-1', ''] }, /deben ser cadenas/]
  ])('%s se rechaza', async (_, cuerpo, mensaje) => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/contenido/orden').send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(mensaje);
  });
});

describe('el telefono de un enlace de WhatsApp', () => {
  // El servidor arma el enlace a partir del numero: con menos de siete
  // digitos no hay numero que valga, y dejarlo pasar daria un wa.me roto
  // impreso en un codigo QR.
  test('un numero demasiado corto se rechaza', async () => {
    const { token } = await crearCuenta();

    const categorias = (await como(token).get('/api/contenido/categorias')).body.data;
    const whatsapp = categorias.enlaces.find((c) => c.nombre === 'WhatsApp');

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Escríbenos',
      detalle: '12345',
      idCategoria: whatsapp.id
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('las operaciones sobre lo que no esta', () => {
  test('editar un bloque que no existe da 404', async () => {
    const { token } = await crearCuenta();

    const categorias = (await como(token).get('/api/contenido/categorias')).body.data;

    const respuesta = await como(token).put('/api/contenido/enlace-999999').send({
      tipo: 'enlace',
      titulo: 'No existe',
      detalle: 'https://ejemplo.co',
      idCategoria: categorias.enlaces[0].id
    });

    expect(respuesta.status).toBe(404);
  });

  // Sin perfil no hay donde colgar un bloque. Es la cuenta que crea el
  // administrador desde POST /api/usuarios.
  test('una cuenta sin perfil no puede agregar contenido', async () => {
    const base = await crearCuenta();

    await pool.execute("UPDATE usuario SET rol = 'administrador' WHERE correo = ?", [base.correo]);

    const admin = await entrar(base.correo);
    const correo = `sin.perfil.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@ejemplo.co`;

    await como(admin).post('/api/usuarios')
      .send({ nombre: 'Sin Perfil', correo, contrasena: CLAVE, rol: 'empresa' });

    const token = await entrar(correo);
    const categorias = (await como(token).get('/api/contenido/categorias')).body.data;

    const respuesta = await como(token).post('/api/contenido').send({
      tipo: 'enlace',
      titulo: 'Sin perfil',
      detalle: 'https://ejemplo.co',
      idCategoria: categorias.enlaces[0].id
    });

    expect(respuesta.status).toBe(404);
  });
});

describe('borrar o apagar lo que ya no esta', () => {
  test('borrar un bloque inexistente da 404', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).delete('/api/contenido/enlace-999999');

    expect(respuesta.status).toBe(404);
  });

  test('y apagarlo tambien', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).patch('/api/contenido/elemento-999999/estado')
      .send({ activo: false });

    expect(respuesta.status).toBe(404);
  });
});
