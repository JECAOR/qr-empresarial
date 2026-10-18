// ============================================
// TESTS/ADMIN.TEST.JS — RF-13, RF-14 y RF-15
//
// El RF-14 (restringir y eliminar) no tiene endpoints propios: usa los de
// /api/usuarios, que ya se prueban en usuarios.test.js. Aqui se comprueba lo
// que el modulo 8 agrega: la consulta de actividad y el reporte.
// ============================================

const { app, request, CLAVE, crearCuenta, entrar, agregarBloque, como } = require('./ayudas');

const pool = require('../src/config/database');

/** Asciende una cuenta a administrador por la base, que es la unica via. */
async function hacerAdministrador(correo) {
  await pool.execute("UPDATE usuario SET rol = 'administrador' WHERE correo = ?", [correo]);

  return entrar(correo);
}

/** Un administrador recien hecho, con su token. */
async function unAdministrador() {
  const cuenta = await crearCuenta({ nombreNegocio: 'Negocio del Administrador' });

  return { ...cuenta, token: await hacerAdministrador(cuenta.correo) };
}

describe('RN-22: la administracion es solo del rol administrador', () => {
  test('una cuenta de empresa recibe 403 en todo el modulo', async ({} = {}) => {
    const { token } = await crearCuenta();

    const rutas = [
      '/api/admin/resumen',
      '/api/admin/usuarios',
      '/api/admin/usuarios/1',
      '/api/admin/reportes/usuarios'
    ];

    for (const ruta of rutas) {
      expect((await como(token).get(ruta)).status).toBe(403);
    }
  });

  test('sin token, 401', async () => {
    expect((await request(app).get('/api/admin/resumen')).status).toBe(401);
    expect((await request(app).get('/api/admin/usuarios')).status).toBe(401);
  });
});

describe('Consulta de usuarios (RF-13)', () => {
  test('el resumen cuenta las cuentas por estado', async () => {
    const { token } = await unAdministrador();

    const antes = (await como(token).get('/api/admin/resumen')).body.data;

    await crearCuenta();

    const despues = (await como(token).get('/api/admin/resumen')).body.data;

    expect(despues.total).toBe(antes.total + 1);
    expect(despues.activos).toBe(antes.activos + 1);
    expect(despues.administradores).toBeGreaterThanOrEqual(1);
  });

  test('una cuenta recien creada cuenta como que nunca entro', async () => {
    const admin = await unAdministrador();

    // crearCuenta() inicia sesion, asi que para esto hace falta una que no
    const sinEstrenar = await request(app).post('/api/auth/registro').send({
      nombre: 'Cuenta Sin Estrenar',
      correo: `sin.estrenar.${Date.now()}@ejemplo.co`,
      contrasena: CLAVE,
      negocio: { nombreNegocio: 'Negocio Sin Estrenar' }
    });

    expect(sinEstrenar.status).toBe(201);

    const lista = await como(admin.token).get('/api/admin/usuarios?busqueda=Sin Estrenar');
    const cuenta = lista.body.data[0];

    expect(cuenta.ultimoAcceso).toBeNull();
  });

  test('el ultimo acceso se anota al iniciar sesion', async () => {
    const admin = await unAdministrador();
    const otra = await crearCuenta();

    const lista = await como(admin.token).get(`/api/admin/usuarios?busqueda=${otra.correo}`);

    // crearCuenta() ya inicio sesion
    expect(lista.body.data[0].ultimoAcceso).not.toBeNull();
  });

  test('trae la actividad real de cada perfil', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta({ nombreNegocio: 'Negocio Con Actividad' });

    const idEnlace = await agregarBloque(empresa.token, { titulo: 'Un enlace medido' });
    await como(empresa.token).post('/api/qr');

    const slug = (await como(empresa.token).get('/api/perfiles/me')).body.data.slug;

    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'escaneo' });
    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'visita' });
    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'visita' });
    await request(app)
      .post(`/api/publico/${slug}/eventos`)
      .send({ tipo: 'clic', idEnlace: Number(idEnlace.split('-')[1]) });

    const lista = await como(admin.token).get('/api/admin/usuarios?busqueda=Negocio Con Actividad');
    const cuenta = lista.body.data[0];

    expect(cuenta.actividad).toEqual({ escaneos: 1, visitas: 2, clics: 1 });
    expect(cuenta.perfil.bloquesActivos).toBe(1);
    expect(cuenta.perfil.qr).toBe(true);
  });

  test('el contenido y los eventos no se inflan entre si', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta({ nombreNegocio: 'Negocio Multiplicado' });

    // Tres bloques y varios eventos: con JOIN + GROUP BY en lugar de
    // subconsultas, cada bloque multiplicaria los eventos y al reves
    await agregarBloque(empresa.token, { titulo: 'Uno' });
    await agregarBloque(empresa.token, { titulo: 'Dos' });
    await agregarBloque(empresa.token, { titulo: 'Tres' });
    await como(empresa.token).post('/api/qr');

    const slug = (await como(empresa.token).get('/api/perfiles/me')).body.data.slug;

    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'visita' });
    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'visita' });

    const cuenta = (await como(admin.token)
      .get('/api/admin/usuarios?busqueda=Negocio Multiplicado')).body.data[0];

    expect(cuenta.perfil.bloquesActivos).toBe(3);
    expect(cuenta.actividad.visitas).toBe(2);
  });

  test('una cuenta sin perfil se devuelve, no se esconde', async () => {
    const admin = await unAdministrador();

    // Las crea el administrador desde POST /api/usuarios, y son justo las
    // que quiere ver: registradas y sin usar
    const creada = await como(admin.token).post('/api/usuarios').send({
      nombre: 'Cuenta Sin Perfil',
      correo: `sin.perfil.${Date.now()}@ejemplo.co`,
      contrasena: CLAVE,
      rol: 'empresa'
    });

    expect(creada.status).toBe(201);

    const cuenta = (await como(admin.token)
      .get('/api/admin/usuarios?busqueda=Cuenta Sin Perfil')).body.data[0];

    expect(cuenta.perfil).toBeNull();
    expect(cuenta.actividad).toEqual({ escaneos: 0, visitas: 0, clics: 0 });
  });

  test('distingue un codigo sin generar de uno apagado', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta({ nombreNegocio: 'Negocio Sin Codigo' });

    const sinGenerar = (await como(admin.token)
      .get('/api/admin/usuarios?busqueda=Negocio Sin Codigo')).body.data[0];

    expect(sinGenerar.perfil.qr).toBeNull();

    await agregarBloque(empresa.token);
    await como(empresa.token).post('/api/qr');
    await como(empresa.token).patch('/api/qr/estado').send({ activo: false });

    const apagado = (await como(admin.token)
      .get('/api/admin/usuarios?busqueda=Negocio Sin Codigo')).body.data[0];

    expect(apagado.perfil.qr).toBe(false);
  });

  test('la busqueda encuentra por nombre, correo y negocio', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta({ nombreNegocio: 'Reposteria Buscada' });

    const porNegocio = await como(admin.token).get('/api/admin/usuarios?busqueda=Reposteria');
    const porCorreo = await como(admin.token).get(`/api/admin/usuarios?busqueda=${empresa.correo}`);

    expect(porNegocio.body.data.map((u) => u.correo)).toContain(empresa.correo);
    expect(porCorreo.body.data).toHaveLength(1);
  });

  test('el filtro de estado deja fuera a las demas', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta();

    await como(admin.token).patch(`/api/usuarios/${empresa.id}/estado`).send({ estado: 'restringido' });

    const restringidas = await como(admin.token).get('/api/admin/usuarios?estado=restringido');

    expect(restringidas.body.data.every((u) => u.estado === 'restringido')).toBe(true);
    expect(restringidas.body.data.map((u) => u.correo)).toContain(empresa.correo);

    const activas = await como(admin.token).get('/api/admin/usuarios?estado=activo');

    expect(activas.body.data.map((u) => u.correo)).not.toContain(empresa.correo);
  });

  test('un filtro inventado se ignora en lugar de fallar', async () => {
    const { token } = await unAdministrador();

    // Responder 400 porque alguien edito la URL dejaria la pantalla en
    // blanco por algo que no importa
    const respuesta = await como(token).get('/api/admin/usuarios?estado=loquesea&orden=inventado');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.length).toBeGreaterThan(0);
  });

  test('una busqueda desmedida si se rechaza', async () => {
    const { token } = await unAdministrador();

    // Acaba en tres LIKE '%...%' sobre la tabla de usuarios
    const respuesta = await como(token).get(`/api/admin/usuarios?busqueda=${'a'.repeat(200)}`);

    expect(respuesta.status).toBe(400);
  });

  test('pagina los resultados', async () => {
    const { token } = await unAdministrador();

    await crearCuenta();
    await crearCuenta();

    const respuesta = await como(token).get('/api/admin/usuarios?porPagina=2&pagina=1');

    expect(respuesta.body.data).toHaveLength(2);
    expect(respuesta.body.paginacion.porPagina).toBe(2);
    expect(respuesta.body.paginacion.paginas).toBeGreaterThanOrEqual(1);
  });

  test('las cuentas eliminadas desaparecen de la lista', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta();

    await como(admin.token).delete(`/api/usuarios/${empresa.id}`);

    const lista = await como(admin.token).get(`/api/admin/usuarios?busqueda=${empresa.correo}`);

    // El borrado es logico y la fila sigue ahi, pero para la administracion
    // esa cuenta ya no existe
    expect(lista.body.data).toHaveLength(0);
  });

  test('el detalle trae los ultimos eventos', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta({ nombreNegocio: 'Negocio Detallado' });

    await agregarBloque(empresa.token);
    await como(empresa.token).post('/api/qr');

    const slug = (await como(empresa.token).get('/api/perfiles/me')).body.data.slug;
    await request(app).post(`/api/publico/${slug}/eventos`).send({ tipo: 'escaneo' });

    const detalle = await como(admin.token).get(`/api/admin/usuarios/${empresa.id}`);

    expect(detalle.status).toBe(200);
    expect(detalle.body.data.ultimosEventos).toHaveLength(1);
    expect(detalle.body.data.ultimosEventos[0].tipo).toBe('escaneo');
  });

  test('el detalle de una cuenta que no existe es 404', async () => {
    const { token } = await unAdministrador();

    expect((await como(token).get('/api/admin/usuarios/999999')).status).toBe(404);
  });

  test('la lista no filtra la contrasena de nadie', async () => {
    const { token } = await unAdministrador();

    const cuerpo = JSON.stringify((await como(token).get('/api/admin/usuarios')).body);

    expect(cuerpo).not.toContain('contrasena');
    expect(cuerpo).not.toContain('$2b$');
  });
});

describe('Descarga de reportes (RF-15)', () => {
  test('se entrega como archivo CSV, no como texto para mirar', async () => {
    const { token } = await unAdministrador();

    const respuesta = await como(token).get('/api/admin/reportes/usuarios');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toContain('text/csv');
    expect(respuesta.headers['content-disposition']).toContain('attachment');
    expect(respuesta.headers['content-disposition']).toMatch(/usuarios-\d{4}-\d{2}-\d{2}\.csv/);
  });

  test('empieza con BOM, para que Excel no rompa las tildes', async () => {
    const { token } = await unAdministrador();

    const respuesta = await como(token).get('/api/admin/reportes/usuarios');

    expect(respuesta.text.charCodeAt(0)).toBe(0xfeff);
  });

  test('trae una fila por cuenta, con su actividad', async () => {
    const admin = await unAdministrador();
    const empresa = await crearCuenta({ nombreNegocio: 'Negocio Reportado' });

    await agregarBloque(empresa.token);

    const csv = (await como(admin.token).get('/api/admin/reportes/usuarios')).text;
    const lineas = csv.trim().split('\r\n');

    expect(lineas[0]).toBe(
      'id,nombre,correo,rol,estado,fecha_registro,ultimo_acceso,negocio,slug,' +
      'bloques_activos,codigo_qr,escaneos,visitas,clics'
    );

    const fila = lineas.find((l) => l.includes(empresa.correo));

    expect(fila).toBeDefined();
    expect(fila).toContain('"Negocio Reportado"');
    expect(fila).toContain('"sin generar"');
  });

  test('una coma en el nombre del negocio no parte la fila', async () => {
    const admin = await unAdministrador();

    await crearCuenta({ nombreNegocio: 'Panaderia, Cafe y Algo Mas' });

    const csv = (await como(admin.token).get('/api/admin/reportes/usuarios')).text;
    const fila = csv.split('\r\n').find((l) => l.includes('Panaderia, Cafe'));

    // Sin entrecomillar, esa coma correria todas las columnas siguientes
    expect(fila).toContain('"Panaderia, Cafe y Algo Mas"');
    expect(fila.split('","')).toHaveLength(14);
  });

  test('respeta los mismos filtros que la lista', async () => {
    const admin = await unAdministrador();
    const dentro = await crearCuenta({ nombreNegocio: 'Floristeria Incluida' });
    const fuera = await crearCuenta({ nombreNegocio: 'Ferreteria Excluida' });

    const csv = (await como(admin.token)
      .get('/api/admin/reportes/usuarios?busqueda=Floristeria')).text;

    expect(csv).toContain(dentro.correo);
    expect(csv).not.toContain(fuera.correo);
  });

  test('no se pagina: el reporte es el conjunto completo', async () => {
    const admin = await unAdministrador();

    await crearCuenta();
    await crearCuenta();

    const pagina = await como(admin.token).get('/api/admin/usuarios?porPagina=1');
    const csv = (await como(admin.token).get('/api/admin/reportes/usuarios?porPagina=1')).text;

    const filas = csv.trim().split('\r\n').length - 1;

    expect(pagina.body.data).toHaveLength(1);
    expect(filas).toBe(pagina.body.paginacion.total);
  });
});
