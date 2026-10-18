// ============================================
// TESTS/QR-Y-PUBLICO.TEST.JS — RF-07, RF-08, RF-09 y RF-11
//
// Van juntos porque es un solo recorrido: se genera el codigo, se escanea,
// se cuenta el escaneo. Separarlos obligaria a repetir el montaje tres
// veces y no se leeria como lo que es.
// ============================================

const { app, request, crearCuenta, agregarBloque, como } = require('./ayudas');

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
