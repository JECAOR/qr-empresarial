// ============================================
// TESTS/QR-Y-PUBLICO.TEST.JS — RF-07, RF-08, RF-09 y RF-11
//
// Van juntos porque es un solo recorrido: se genera el codigo, se escanea,
// se cuenta el escaneo. Separarlos obligaria a repetir el montaje tres
// veces y no se leeria como lo que es.
// ============================================

const { app, request, CLAVE, crearCuenta, entrar, agregarBloque, como } = require('./ayudas');
const pool = require('../src/config/database');

/** Una cuenta con contenido y codigo QR ya generado. */
async function cuentaPublicada(nombreNegocio = 'Negocio Publicado') {
  const { token, slug } = await crearCuenta({ nombreNegocio });

  const idEnlace = await agregarBloque(token, {
    titulo: 'Ver el menú',
    detalle: 'https://ejemplo.co/menu'
  });

  await como(token).post('/api/qr');

  return { token, slug, idEnlace, numeroEnlace: Number(idEnlace.split('-')[1]) };
}

describe('Codigo QR (RF-07)', () => {
  test('no se genera para un perfil vacio', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).post('/api/qr');

    // Un codigo que lleva a una pagina en blanco es peor que no tener
    // codigo: quien lo escanea se queda sin saber si el negocio existe
    expect(respuesta.status).toBe(409);
  });

  test('con contenido se genera, nace activo y apunta al perfil', async () => {
    const { token, slug } = await crearCuenta({ nombreNegocio: 'Negocio Con QR' });
    await agregarBloque(token);

    const respuesta = await como(token).post('/api/qr');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.activo).toBe(true);
    expect(respuesta.body.data.url).toContain(`/p/${slug}`);
  });

  test('pedirlo otra vez devuelve el mismo, no uno nuevo', async () => {
    const { token } = await cuentaPublicada();

    const primera = (await como(token).get('/api/qr')).body.data;
    const segunda = await como(token).post('/api/qr');

    expect(segunda.status).toBe(200);

    // Cambiar su direccion invalidaria los codigos ya impresos
    expect(segunda.body.data.url).toBe(primera.url);
  });
});

describe('Descarga del codigo (RF-08)', () => {
  test.each([
    ['png', 'image/png'],
    ['svg', 'image/svg+xml'],
    ['pdf', 'application/pdf']
  ])('entrega el %s como archivo', async (formato, tipo) => {
    const { token } = await cuentaPublicada();

    const respuesta = await como(token).get(`/api/qr/imagen?formato=${formato}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toContain(tipo);

    // Como archivo, no como algo que el navegador abra en una pestaña
    expect(respuesta.headers['content-disposition']).toContain('attachment');
  });

  test('un formato que no existe se rechaza', async () => {
    const { token } = await cuentaPublicada();

    expect((await como(token).get('/api/qr/imagen?formato=bmp')).status).toBe(400);
  });

  test('un color que no es hexadecimal se rechaza', async () => {
    const { token } = await cuentaPublicada();

    expect((await como(token).get('/api/qr/imagen?formato=png&color=rojo')).status).toBe(400);
  });
});

describe('Vista publica (RF-09)', () => {
  test('devuelve el perfil y su contenido sin pedir token', async () => {
    const { slug } = await cuentaPublicada('Fonda La Cosecha');

    const respuesta = await request(app).get(`/api/publico/${slug}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.perfil.nombreNegocio).toBe('Fonda La Cosecha');
    expect(respuesta.body.data.contenido).toHaveLength(1);
  });

  test('no muestra el contenido desactivado', async () => {
    const { token, slug } = await cuentaPublicada();

    await agregarBloque(token, { titulo: 'Promo apagada' });

    const todos = (await como(token).get('/api/contenido')).body.data;
    const apagar = todos.find((i) => i.titulo === 'Promo apagada');

    await como(token).patch(`/api/contenido/${apagar.id}/estado`).send({ activo: false });

    const publico = await request(app).get(`/api/publico/${slug}`);

    expect(publico.body.data.contenido.map((i) => i.titulo)).not.toContain('Promo apagada');
  });

  test('un boton se publica como boton, no como texto', async () => {
    const { token, slug } = await cuentaPublicada();

    await agregarBloque(token, {
      tipo: 'boton',
      titulo: 'Encargar una torta',
      detalle: 'https://wa.me/573012223344',
      // 2 es Botón; 1 es Texto. Los fija la migracion 013
      idCategoria: 2
    });

    const publico = await request(app).get(`/api/publico/${slug}`);
    const boton = publico.body.data.contenido.find((i) => i.titulo === 'Encargar una torta');

    expect(boton.tipo).toBe('boton');
    expect(boton.categoria).toBe('Botón');
  });

  // El tipo se decidia comparando el nombre de la categoria con el literal
  // 'Botón'. Basto cargar la base desde una consola de Windows -que envia los
  // acentos en su propia pagina de codigos- para que lo guardado dejara de
  // coincidir: la comparacion fallaba en silencio y el boton salia como texto
  // en la vista publica. Lo destapo la pantalla de React de la Guia 01.
  //
  // Esta prueba NO puede reproducir aquella corrupcion: la base de pruebas se
  // construye con mysql2, que si habla utf8mb4, asi que aqui el nombre
  // siempre llega entero. Lo que comprueba es la causa de fondo -que el tipo
  // dependiera de un texto en castellano con tilde- renombrando la categoria
  // a mano. Con el codigo anterior falla.
  test('el tipo no depende de como se llame la categoria [regresion]', async () => {
    const { token, slug } = await cuentaPublicada();

    await agregarBloque(token, {
      tipo: 'boton',
      titulo: 'Pedir por WhatsApp',
      detalle: 'https://wa.me/573012223344',
      idCategoria: 2
    });

    const [[original]] = await pool.query(
      'SELECT nombre FROM categoria_elemento WHERE id_categoria_elemento = 2');

    try {
      // Lo mismo que dejaba el cliente de la consola: los bytes de la tilde
      // leidos como si fueran de otra pagina de codigos
      await pool.execute(
        'UPDATE categoria_elemento SET nombre = ? WHERE id_categoria_elemento = 2',
        ['Bot├│n']);

      const publico = await request(app).get(`/api/publico/${slug}`);
      const boton = publico.body.data.contenido.find((i) => i.titulo === 'Pedir por WhatsApp');

      expect(boton.tipo).toBe('boton');
    } finally {
      await pool.execute(
        'UPDATE categoria_elemento SET nombre = ? WHERE id_categoria_elemento = 2',
        [original.nombre]);
    }
  });

  test('lleva el tema del negocio, no el de quien mira', async () => {
    const { token, slug } = await cuentaPublicada();

    await como(token).patch('/api/perfiles/me/tema').send({ tema: 'terracota' });

    const respuesta = await request(app).get(`/api/publico/${slug}`);

    expect(respuesta.body.data.perfil.tema).toBe('terracota');
  });

  test('no filtra datos de la cuenta', async () => {
    const { slug } = await cuentaPublicada();

    const cuerpo = JSON.stringify((await request(app).get(`/api/publico/${slug}`)).body);

    // Es una pantalla abierta: aqui no tiene nada que hacer el correo con el
    // que se inicia sesion, ni el rol, ni el identificador del usuario
    expect(cuerpo).not.toContain('contrasena');
    expect(cuerpo).not.toContain('idUsuario');
    expect(cuerpo).not.toContain('"rol"');
  });

  test('con el codigo apagado responde como si no existiera', async () => {
    const { token, slug } = await cuentaPublicada();

    await como(token).patch('/api/qr/estado').send({ activo: false });

    const apagado = await request(app).get(`/api/publico/${slug}`);
    const inventado = await request(app).get('/api/publico/esto-no-existe');

    // Decir "existe pero esta suspendido" no es asunto de quien escanea
    expect(apagado.status).toBe(404);
    expect(apagado.body.message).toBe(inventado.body.message);
  });

  test('una cuenta restringida deja de responder en publico', async () => {
    const { slug, token } = await cuentaPublicada();

    const perfil = await como(token).get('/api/perfiles/me');
    expect(perfil.status).toBe(200);

    const pool = require('../src/config/database');
    await pool.execute(
      "UPDATE usuario SET estado = 'restringido' WHERE id_usuario = (SELECT id_usuario FROM perfil_empresarial WHERE slug = ?)",
      [slug]
    );

    expect((await request(app).get(`/api/publico/${slug}`)).status).toBe(404);
  });
});

describe('Estadisticas (RF-11)', () => {
  test('las tres medidas empiezan en cero y suben con los eventos', async () => {
    const { token, slug, numeroEnlace } = await cuentaPublicada();

    const antes = (await como(token).get('/api/estadisticas')).body.data.totales;

    // toMatchObject y no toEqual: 'totales' trae ademas la conversion,
    // que es un porcentaje calculado y no una de las tres medidas del RF-11
    expect(antes).toMatchObject({ escaneos: 0, visitas: 0, clics: 0 });

    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'escaneo' });
    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'visita' });
    await request(app)
      .post(`/api/publico/${slug}/eventos`)
      .send({ tipo: 'clic', idEnlace: numeroEnlace });

    const despues = (await como(token).get('/api/estadisticas')).body.data.totales;

    expect(despues).toMatchObject({ escaneos: 1, visitas: 1, clics: 1 });
  });

  test('el registro de eventos no pide token', async () => {
    const { slug } = await cuentaPublicada();

    // Lo informa la vista publica, que no tiene sesion
    const respuesta = await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'visita' });

    expect(respuesta.status).toBe(204);
  });

  test('un clic con un enlace de otro perfil no se guarda', async () => {
    const ajena = await cuentaPublicada('Negocio Ajeno');
    const propia = await cuentaPublicada('Negocio Propio');

    const respuesta = await request(app)
      .post(`/api/publico/${propia.slug}/eventos`)
      .send({ tipo: 'clic', idEnlace: ajena.numeroEnlace });

    // El identificador llega de una pantalla abierta: no se puede confiar
    expect(respuesta.status).toBe(400);
    expect((await como(propia.token).get('/api/estadisticas')).body.data.totales.clics).toBe(0);
  });

  test.each([
    ['un tipo inventado', { tipo: 'loquesea' }],
    ['un clic sin enlace', { tipo: 'clic' }]
  ])('rechaza %s', async (_, cuerpo) => {
    const { slug } = await cuentaPublicada();

    expect((await request(app).post(`/api/publico/${slug}/eventos`).send(cuerpo)).status).toBe(400);
  });

  test('el evento de hoy cae en el dia de hoy, no en el anterior', async () => {
    const { token, slug } = await cuentaPublicada();

    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'visita' });

    const serie = (await como(token).get('/api/estadisticas')).body.data.serie;
    const hoy = serie[serie.length - 1];

    // La serie se arma con la fecha local: con toISOString(), en Colombia a
    // partir de las 19:00 los eventos aparecian en el dia anterior y hoy
    // salia en cero
    expect(hoy.escaneos + hoy.visitas + hoy.clics).toBeGreaterThan(0);
  });

  test('una ventana absurda cae en siete dias', async () => {
    const { token } = await cuentaPublicada();

    const respuesta = await como(token).get('/api/estadisticas?dias=99999');

    // Sin esto, una peticion podria poner a la base a recorrer entera la
    // tabla que mas crece del esquema
    expect(respuesta.body.data.dias).toBe(7);
    expect(respuesta.body.data.serie).toHaveLength(7);
  });

  test('cada cuenta solo ve sus propias estadisticas', async () => {
    const una = await cuentaPublicada('Negocio Que Mide');
    const otra = await cuentaPublicada('Negocio Vecino');

    await request(app).post(`/api/publico/${una.slug}/eventos`).send({ tipo: 'escaneo' });

    expect((await como(una.token).get('/api/estadisticas')).body.data.totales.escaneos).toBe(1);
    expect((await como(otra.token).get('/api/estadisticas')).body.data.totales.escaneos).toBe(0);
  });
});

// La regla del modulo 3 tenia una puerta trasera: apagar el codigo esta
// permitido -es la via para vaciar el perfil a proposito-, asi que la
// secuencia apagar -> vaciar -> encender dejaba exactamente el estado que las
// dos reglas existen para evitar. Se comprobo contra el servidor que ocurria.
describe('No se enciende un codigo QR sobre un perfil vacio', () => {
  test('la secuencia apagar, vaciar y encender ya no cuela', async () => {
    const { token, idEnlace } = await cuentaPublicada();

    expect((await como(token).patch('/api/qr/estado').send({ activo: false })).status).toBe(200);
    expect((await como(token).delete(`/api/contenido/${idEnlace}`)).status).toBe(200);

    const encender = await como(token).patch('/api/qr/estado').send({ activo: true });

    expect(encender.status).toBe(409);
  });

  test('vuelve a encenderse en cuanto hay contenido', async () => {
    const { token, idEnlace } = await cuentaPublicada();

    await como(token).patch('/api/qr/estado').send({ activo: false });
    await como(token).delete(`/api/contenido/${idEnlace}`);

    await agregarBloque(token, { titulo: 'Contenido nuevo' });

    const encender = await como(token).patch('/api/qr/estado').send({ activo: true });

    expect(encender.status).toBe(200);
    expect(encender.body.data.activo).toBe(true);
  });

  test('apagarlo nunca se bloquea, aunque el perfil este vacio', async () => {
    const { token, idEnlace } = await cuentaPublicada();

    await como(token).patch('/api/qr/estado').send({ activo: false });
    await como(token).delete(`/api/contenido/${idEnlace}`);

    // Apagar algo que ya esta apagado no deja a nadie peor: lo que se vigila
    // es encender, no apagar
    expect((await como(token).patch('/api/qr/estado').send({ activo: false })).status).toBe(200);
  });

  test('las tres puertas al mismo sitio estan vigiladas', async () => {
    const { token } = await crearCuenta();

    // 1. Generar el codigo sin contenido
    expect((await como(token).post('/api/qr')).status).toBe(409);

    const id = await agregarBloque(token);
    await como(token).post('/api/qr');

    // 2. Quitar el contenido con el codigo encendido
    expect((await como(token).delete(`/api/contenido/${id}`)).status).toBe(409);

    await como(token).patch('/api/qr/estado').send({ activo: false });
    await como(token).delete(`/api/contenido/${id}`);

    // 3. Encender el codigo sin contenido
    expect((await como(token).patch('/api/qr/estado').send({ activo: true })).status).toBe(409);
  });
});

// Las etiquetas de vista previa estaban escritas a mano en public.html con
// los datos del negocio de ejemplo, y el navegador no las corrige: los
// robots que las leen -WhatsApp, Telegram, Google- no ejecutan JavaScript.
// Cualquier negocio que compartiera su enlace mostraba "Fonda La Cosecha", y
// el bloque de Schema.org declaraba 4,6 estrellas con 215 resenas que nadie
// habia dejado.
describe('Metadatos de la pagina publica (RF-09)', () => {
  test('la vista previa lleva los datos de ese negocio', async () => {
    const { token, slug } = await cuentaPublicada('Reposteria Dona Luz');

    await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Reposteria Dona Luz',
      descripcion: 'Tortas por encargo desde 1998',
      telefono: '+57 311 555 4433',
      direccion: 'Calle 45 #12-30'
    });

    const html = (await request(app).get(`/p/${slug}`)).text;

    expect(html).toContain('<title>Reposteria Dona Luz · QR Empresarial</title>');
    expect(html).toContain('<meta property="og:title" content="Reposteria Dona Luz" />');
    expect(html).toContain('Tortas por encargo desde 1998');
    expect(html).toContain(`/p/${slug}`);
  });

  test('no queda rastro del negocio de ejemplo [regresion]', async () => {
    const { slug } = await cuentaPublicada('Negocio Propio');

    const html = (await request(app).get(`/p/${slug}`)).text;

    expect(html).not.toContain('og:title" content="Fonda La Cosecha');
    expect(html).not.toContain('"name": "Fonda La Cosecha"');
    expect(html).not.toContain('El Poblado');
  });

  test('NO declara una calificacion que nadie dejo [regresion]', async () => {
    const { slug } = await cuentaPublicada();

    const html = (await request(app).get(`/p/${slug}`)).text;

    // No se rellena con ceros ni se inventa: el sistema no tiene resenas,
    // asi que la propiedad no debe existir. Es dato legible por maquinas
    // adosado a un negocio real.
    expect(html).not.toContain('aggregateRating');
    expect(html).not.toContain('ratingValue');
    expect(html).not.toContain('reviewCount');
  });

  test('los datos estructurados son un JSON valido', async () => {
    const { token, slug } = await cuentaPublicada('Negocio Estructurado');

    await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Negocio Estructurado',
      descripcion: 'Con "comillas" y & simbolos',
      instagram: '@negocioestructurado'
    });

    const html = (await request(app).get(`/p/${slug}`)).text;
    const bloque = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);

    expect(bloque).not.toBeNull();

    const datos = JSON.parse(bloque[1]);

    expect(datos['@type']).toBe('LocalBusiness');
    expect(datos.name).toBe('Negocio Estructurado');
    expect(datos.sameAs).toEqual(['https://instagram.com/negocioestructurado']);
    expect(datos).not.toHaveProperty('aggregateRating');
  });

  test('un nombre con etiquetas no se cuela en el HTML', async () => {
    const { token, slug } = await cuentaPublicada('Negocio Normal');

    await como(token).put('/api/perfiles/me').send({
      nombreNegocio: 'Pan <script>alert(1)</script>'
    });

    const html = (await request(app).get(`/p/${slug}`)).text;

    // El nombre lo escribe una persona y acaba dentro de content="..." y
    // dentro de un bloque <script>: sin escapar, es una inyeccion de HTML
    // en una pagina que ve cualquiera
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('un perfil retirado no filtra el nombre del negocio', async () => {
    const { token, slug } = await cuentaPublicada('Negocio Retirado');

    await como(token).patch('/api/qr/estado').send({ activo: false });

    const html = (await request(app).get(`/p/${slug}`)).text;

    // Misma pantalla y mismas etiquetas que un slug inventado: responder
    // distinto revelaria que ese slug existe
    expect(html).toContain('Perfil no disponible');
    expect(html).not.toContain('Negocio Retirado');
    expect(html).toContain('noindex');
  });

  test('un slug que no existe responde la pagina, no un error', async () => {
    const respuesta = await request(app).get('/p/esto-no-existe-de-ninguna-manera');

    // La pantalla muestra el aviso; la ruta no revela que slugs hay
    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('Perfil no disponible');
  });
});

// ============================================
// Los caminos que no se habian recorrido
//
// Tres grupos, elegidos porque son alcanzables desde fuera y porque lo que
// hacen importa: el codigo QR de una cuenta a medio montar, los eventos que
// cualquiera en internet puede mandar, y las etiquetas de vista previa.
// ============================================

/** Una cuenta de empresa sin perfil, de las que crea el administrador. */
async function cuentaSinPerfil() {
  const base = await crearCuenta();

  await pool.execute("UPDATE usuario SET rol = 'administrador' WHERE correo = ?", [base.correo]);

  const admin = await entrar(base.correo);
  const correo = `sin.perfil.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@ejemplo.co`;

  await como(admin).post('/api/usuarios').send({
    nombre: 'Cuenta Sin Perfil',
    correo,
    contrasena: CLAVE,
    rol: 'empresa'
  });

  return entrar(correo);
}

describe('el codigo QR de una cuenta a medio montar', () => {
  // El codigo apunta al perfil: sin perfil no hay a donde apuntar. Decirlo
  // asi es lo que hace que se sepa que falta, en lugar de un 500.
  test('sin perfil no se puede generar, y se explica que falta', async () => {
    const token = await cuentaSinPerfil();

    const respuesta = await como(token).post('/api/qr');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/complete el perfil empresarial/);
  });

  test('ni consultar', async () => {
    const token = await cuentaSinPerfil();

    const respuesta = await como(token).get('/api/qr');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/complete el perfil empresarial/);
  });

  // Con perfil pero sin haberlo generado todavia: es el estado normal de una
  // cuenta recien registrada, y la pantalla lo usa para ofrecer "Generar".
  test('con perfil pero sin generar, dice que no hay codigo', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).get('/api/qr');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/todavía no tiene un código QR/);
  });

  test('y tampoco se puede publicar ni retirar lo que no existe', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).patch('/api/qr/estado').send({ activo: false });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/todavía no tiene un código QR/);
  });
});

describe('los eventos que llegan de fuera', () => {
  // Este endpoint no pide sesion: lo llama la pagina publica desde el
  // navegador de quien escanea, asi que cualquiera puede mandarle lo que
  // quiera. Lo que no sea de los tres tipos se rechaza antes de tocar la
  // base.
  test.each([
    ['inventado', 'curioseo'],
    ['vacio', ''],
    ['en mayusculas', 'VISITA'],
    ['que no es texto', 7]
  ])('un tipo %s se rechaza', async (_, tipo) => {
    const cuenta = await crearCuenta();

    const respuesta = await request(app)
      .post(`/api/publico/${cuenta.slug}/eventos`)
      .send({ tipo });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/tipo de evento debe ser uno de/);
  });

  // Un clic sin decir cual: sin esto se guardarian clics que no apuntan a
  // nada y las estadisticas dirian mas de lo que saben.
  test.each([
    ['sin el enlace', {}],
    ['con un enlace que no es numero', { idEnlace: 'abc' }],
    ['con un enlace negativo', { idEnlace: -1 }],
    ['con un enlace cero', { idEnlace: 0 }]
  ])('un clic %s se rechaza', async (_, extra) => {
    const cuenta = await crearCuenta();

    const respuesta = await request(app)
      .post(`/api/publico/${cuenta.slug}/eventos`)
      .send({ tipo: 'clic', ...extra });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/clic debe indicar el enlace/);
  });

  // Un slug inventado no crea filas: si no, cualquiera podria llenar la
  // tabla de eventos de negocios que no existen.
  test('un negocio que no existe no recibe eventos', async () => {
    const respuesta = await request(app)
      .post('/api/publico/no-existe-este-negocio/eventos')
      .send({ tipo: 'visita' });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/no está disponible/);
  });

  // Un perfil con el codigo retirado tampoco: no se puede mostrar, asi que
  // no se le cuentan visitas.
  test('un negocio con la pagina retirada tampoco', async () => {
    const cuenta = await crearCuenta();

    await agregarBloque(cuenta.token);
    await como(cuenta.token).post('/api/qr');
    await como(cuenta.token).patch('/api/qr/estado').send({ activo: false });

    const respuesta = await request(app)
      .post(`/api/publico/${cuenta.slug}/eventos`)
      .send({ tipo: 'visita' });

    expect(respuesta.status).toBe(404);
  });
});

describe('los periodos de la actividad', () => {
  // La pantalla ofrece 7, 30 y 90. Cualquier otra cosa cae en el de por
  // defecto en lugar de montar una consulta con lo que llegue.
  test.each([['1'], ['365'], ['abc'], ['']])('un periodo de %s dias cae en el de siempre', async (dias) => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).get(`/api/estadisticas?dias=${dias}`);

    expect(respuesta.status).toBe(200);
    expect([7, 30, 90]).toContain(respuesta.body.data.dias);
  });

  test('y los tres que si valen se respetan', async () => {
    const { token } = await crearCuenta();

    for (const dias of [7, 30, 90]) {
      const respuesta = await como(token).get(`/api/estadisticas?dias=${dias}`);

      expect(respuesta.body.data.dias).toBe(dias);
    }
  });

  // Sin perfil no hay actividad que contar, y hay que decirlo: un 200 con
  // ceros haria creer que el negocio no tiene visitas.
  test('una cuenta sin perfil no recibe ceros, recibe un 404', async () => {
    const token = await cuentaSinPerfil();

    const respuesta = await como(token).get('/api/estadisticas');

    expect(respuesta.status).toBe(404);
  });
});

describe('un boton en la pagina publica', () => {
  // REGRESION con historia. El tipo se decidia comparando el nombre de la
  // categoria con el literal "Boton", y basto con que la base se cargara
  // desde una consola de Windows para que los acentos dejaran de coincidir:
  // la comparacion fallaba en silencio y un boton salia dibujado como
  // texto. Se arreglo comparando por el icono, que es ASCII.
  //
  // El camino del boton en la vista publica no se habia vuelto a ejecutar.
  test('sale como boton, no como texto', async () => {
    const cuenta = await crearCuenta({ nombreNegocio: 'Negocio Con Boton' });

    const categorias = (await como(cuenta.token).get('/api/contenido/categorias')).body.data;
    const deBoton = categorias.elementos.find((c) => c.nombre === 'Botón');

    expect(deBoton).toBeDefined();

    await como(cuenta.token).post('/api/contenido').send({
      tipo: 'boton',
      titulo: 'Encargar una torta',
      detalle: 'Escríbenos con tres días de antelación',
      idCategoria: deBoton.id
    });

    await como(cuenta.token).post('/api/qr');

    const publico = await request(app).get(`/api/publico/${cuenta.slug}`);
    const bloque = publico.body.data.contenido.find((b) => b.titulo === 'Encargar una torta');

    expect(bloque.tipo).toBe('boton');
  });

  test('y un texto normal sigue saliendo como texto', async () => {
    const cuenta = await crearCuenta({ nombreNegocio: 'Negocio Con Texto' });

    const categorias = (await como(cuenta.token).get('/api/contenido/categorias')).body.data;
    const deTexto = categorias.elementos.find((c) => c.nombre !== 'Botón');

    await como(cuenta.token).post('/api/contenido').send({
      tipo: 'texto',
      titulo: 'Horneamos cada mañana',
      detalle: 'Masa madre de fermentación lenta',
      idCategoria: deTexto.id
    });

    await como(cuenta.token).post('/api/qr');

    const publico = await request(app).get(`/api/publico/${cuenta.slug}`);
    const bloque = publico.body.data.contenido.find((b) => b.titulo === 'Horneamos cada mañana');

    expect(bloque.tipo).toBe('texto');
  });
});

describe('publicar o retirar la pagina', () => {
  // Es un interruptor, igual que el de los bloques.
  test.each([
    ['sin el campo', {}],
    ['con una cadena', { activo: 'true' }],
    ['con un numero', { activo: 1 }]
  ])('%s se rechaza', async (_, cuerpo) => {
    const cuenta = await crearCuenta();

    await agregarBloque(cuenta.token);
    await como(cuenta.token).post('/api/qr');

    const respuesta = await como(cuenta.token).patch('/api/qr/estado').send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/activo debe ser true o false/);
  });
});
