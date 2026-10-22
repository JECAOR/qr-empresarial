// ============================================
// TESTS/USUARIOS.TEST.JS — RF-01 (administracion) y RF-12 (cuenta propia)
// ============================================

const { app, request, CLAVE, correoNuevo, crearCuenta, entrar, como } = require('./ayudas');

const pool = require('../src/config/database');

/** Asciende una cuenta a administrador por la base, que es la unica via. */
async function hacerAdministrador(correo) {
  await pool.execute("UPDATE usuario SET rol = 'administrador' WHERE correo = ?", [correo]);

  return entrar(correo);
}

describe('Datos personales (RF-12)', () => {
  test('cambiar solo el nombre no pide la contrasena', async () => {
    const { token, correo } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me').send({
      nombre: 'Nombre Corregido',
      correo
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.nombre).toBe('Nombre Corregido');
  });

  test('cambiar el correo SIN la contrasena no se permite', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me').send({
      nombre: 'Persona de Prueba',
      correo: correoNuevo('otro')
    });

    // El correo es el identificador con el que se entra y al que llega el
    // enlace de recuperacion: quien se hiciera con una sesion abierta podria
    // cambiarlo y despues apropiarse de la cuenta
    expect(respuesta.status).toBe(401);
  });

  test('con la contrasena, el correo cambia y es con el que se entra', async () => {
    const { token, correo } = await crearCuenta();
    const nuevo = correoNuevo('cambiado');

    const respuesta = await como(token)
      .put('/api/usuarios/me')
      .send({ nombre: 'Persona de Prueba', correo: nuevo, contrasena: CLAVE });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.correo).toBe(nuevo);

    expect(await entrar(nuevo)).toEqual(expect.any(String));
    expect((await request(app).post('/api/auth/login').send({ correo, contrasena: CLAVE })).status)
      .toBe(401);
  });

  test('RN-01: no se puede tomar el correo de otra cuenta', async () => {
    const ocupado = await crearCuenta();
    const { token } = await crearCuenta();

    const respuesta = await como(token)
      .put('/api/usuarios/me')
      .send({ nombre: 'Persona de Prueba', correo: ocupado.correo, contrasena: CLAVE });

    expect(respuesta.status).toBe(409);
  });

  test('nadie se asciende a administrador por aqui', async () => {
    const { token, correo } = await crearCuenta();

    const respuesta = await como(token)
      .put('/api/usuarios/me')
      .send({ nombre: 'Persona de Prueba', correo, rol: 'administrador' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.rol).toBe('empresa');

    // Y tampoco en la base, que es lo que de verdad decide
    const [filas] = await pool.execute('SELECT rol FROM usuario WHERE correo = ?', [correo]);
    expect(filas[0].rol).toBe('empresa');
  });
});

describe('Preferencias de avisos (RF-12)', () => {
  test('sin haber guardado nada devuelve los valores por defecto, no 404', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).get('/api/usuarios/me/preferencias');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ resumen: true, novedades: false, guardadas: false });
  });

  test('ya no existe el aviso de resenas', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).get('/api/usuarios/me/preferencias');

    // El sistema no tiene resenas en ninguna parte: ninguna de las once
    // tablas guarda calificaciones de clientes
    expect(respuesta.body.data).not.toHaveProperty('resenas');
  });

  test('se guardan y se vuelven a leer igual', async () => {
    const { token } = await crearCuenta();

    await como(token).put('/api/usuarios/me/preferencias').send({ resumen: false, novedades: true });

    const respuesta = await como(token).get('/api/usuarios/me/preferencias');

    expect(respuesta.body.data).toEqual({ resumen: false, novedades: true, guardadas: true });
  });

  test('un cuerpo a medias se rechaza', async () => {
    const { token } = await crearCuenta();

    // Aceptarlo dejaria el que falta en su valor por defecto sin que nadie
    // lo pidiera
    expect((await como(token).put('/api/usuarios/me/preferencias').send({ resumen: true })).status)
      .toBe(400);

    expect(
      (await como(token)
        .put('/api/usuarios/me/preferencias')
        .send({ resumen: 'si', novedades: false })).status
    ).toBe(400);
  });
});

describe('Cambio de contrasena (RF-12)', () => {
  test('exige la actual y devuelve un token nuevo', async () => {
    const { token, correo } = await crearCuenta();

    const respuesta = await como(token)
      .put('/api/usuarios/me/contrasena')
      .send({ contrasenaActual: CLAVE, contrasenaNueva: 'OtraClave1*' });

    expect(respuesta.status).toBe(200);

    // Se devuelve un token nuevo para no echar de la pantalla a quien acaba
    // de cambiarla
    expect(respuesta.body.data.token).toEqual(expect.any(String));
    expect((await como(respuesta.body.data.token).get('/api/usuarios/me')).status).toBe(200);

    expect(await entrar(correo, 'OtraClave1*')).toEqual(expect.any(String));
  });

  test('con la actual equivocada no cambia nada', async () => {
    const { token, correo } = await crearCuenta();

    const respuesta = await como(token)
      .put('/api/usuarios/me/contrasena')
      .send({ contrasenaActual: 'LaQueNoEs1*', contrasenaNueva: 'OtraClave1*' });

    expect(respuesta.status).toBe(401);
    expect(await entrar(correo, CLAVE)).toEqual(expect.any(String));
  });

  test('RN-02: la nueva tambien tiene que ser segura', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token)
      .put('/api/usuarios/me/contrasena')
      .send({ contrasenaActual: CLAVE, contrasenaNueva: 'facil' });

    expect(respuesta.status).toBe(400);
  });
});

describe('Eliminar la cuenta propia (RF-12)', () => {
  test('exige la contrasena, libera el correo y cierra el acceso', async () => {
    const { token, correo, id } = await crearCuenta();

    expect((await como(token).delete('/api/usuarios/me').send({ contrasena: 'LaQueNoEs1*' })).status)
      .toBe(401);

    expect((await como(token).delete('/api/usuarios/me').send({ contrasena: CLAVE })).status)
      .toBe(200);

    // Borrado logico: la fila sigue, con el correo prefijado para liberar la
    // direccion sin perder el historial ni romper las claves foraneas
    const [filas] = await pool.execute(
      'SELECT correo, deleted_at FROM usuario WHERE id_usuario = ?',
      [id]
    );

    expect(filas[0].deleted_at).not.toBeNull();
    expect(filas[0].correo).toBe(`eliminado_${id}_${correo}`);

    // Y la direccion queda libre para registrarse otra vez
    const otraVez = await request(app).post('/api/auth/registro').send({
      nombre: 'Otra Persona',
      correo,
      contrasena: CLAVE,
      negocio: { nombreNegocio: 'Negocio Reutilizado' }
    });

    expect(otraVez.status).toBe(201);
  });
});

describe('RN-22: la administracion es solo del rol administrador', () => {
  test('una cuenta de empresa recibe 403 en todas las rutas administrativas', async () => {
    const { token, id } = await crearCuenta();

    const intentos = [
      ['get', '/api/usuarios'],
      ['get', `/api/usuarios/${id}`],
      ['put', `/api/usuarios/${id}`],
      ['patch', `/api/usuarios/${id}/estado`],
      ['delete', `/api/usuarios/${id}`],
      ['post', '/api/usuarios']
    ];

    for (const [metodo, ruta] of intentos) {
      const respuesta = await como(token)[metodo](ruta).send({});
      expect([403]).toContain(respuesta.status);
    }
  });

  test('un administrador si puede listar y restringir cuentas', async () => {
    const empresa = await crearCuenta();
    const jefe = await crearCuenta();

    const tokenAdmin = await hacerAdministrador(jefe.correo);

    expect((await como(tokenAdmin).get('/api/usuarios')).status).toBe(200);

    const restringida = await como(tokenAdmin)
      .patch(`/api/usuarios/${empresa.id}/estado`)
      .send({ estado: 'restringido' });

    expect(restringida.status).toBe(200);

    // RN-23: una cuenta restringida no puede entrar ni seguir usando los
    // tokens que ya tenia
    expect(
      (await request(app).post('/api/auth/login').send({ correo: empresa.correo, contrasena: CLAVE }))
        .status
    ).toBe(401);

    expect((await como(empresa.token).get('/api/usuarios/me')).status).toBe(401);
  });

  // Este modulo devolvia las filas tal como salen de MySQL -id_usuario,
  // fecha_registro-, mientras que el inicio de sesion y GET /usuarios/me ya
  // respondian en camelCase. La misma entidad llegaba al cliente con dos
  // nombres distintos segun por donde se pidiera, y nadie lo notaba porque
  // el frontend original no llama a estas rutas: aparecio al escribir la
  // tabla de usuarios en React.
  test('las respuestas no llevan nombres de columnas de la base [regresion]', async () => {
    const empresa = await crearCuenta();
    const jefe = await crearCuenta();

    const tokenAdmin = await hacerAdministrador(jefe.correo);

    const respuestas = [
      (await como(tokenAdmin).get('/api/usuarios')).body.data[0],
      (await como(tokenAdmin).get(`/api/usuarios/${empresa.id}`)).body.data,
      (await como(tokenAdmin).put(`/api/usuarios/${empresa.id}`)
        .send({ nombre: 'Nombre Nuevo', correo: empresa.correo, rol: 'empresa' })).body.data,
      (await como(tokenAdmin).patch(`/api/usuarios/${empresa.id}/estado`)
        .send({ estado: 'restringido' })).body.data
    ];

    for (const usuario of respuestas) {
      expect(usuario).toHaveProperty('idUsuario');
      expect(usuario).toHaveProperty('fechaRegistro');

      expect(usuario).not.toHaveProperty('id_usuario');
      expect(usuario).not.toHaveProperty('fecha_registro');

      // Y lo de siempre: la contrasena no sale de la base
      expect(usuario).not.toHaveProperty('contrasena');
      expect(usuario).not.toHaveProperty('deleted_at');
    }
  });

  test('un administrador no puede eliminarse a si mismo', async () => {
    const jefe = await crearCuenta();
    const tokenAdmin = await hacerAdministrador(jefe.correo);

    // Si fuera el unico, nadie podria volver a administrar el sistema
    const respuesta = await como(tokenAdmin).delete(`/api/usuarios/${jefe.id}`);

    expect(respuesta.status).toBe(400);
  });
});

// Esta regla figuraba en el README como aplicada y no estaba en el codigo.
// La encontraron estas mismas pruebas: la primera version de la suite daba
// 200 donde el README prometia que no se podia.
describe('Un administrador no puede dejarse fuera a si mismo', () => {
  test('ni restringiendose', async () => {
    const jefe = await crearCuenta();
    const tokenAdmin = await hacerAdministrador(jefe.correo);

    const respuesta = await como(tokenAdmin)
      .patch(`/api/usuarios/${jefe.id}/estado`)
      .send({ estado: 'restringido' });

    expect(respuesta.status).toBe(400);

    // Y sigue pudiendo administrar, que es lo que importa
    expect((await como(tokenAdmin).get('/api/usuarios')).status).toBe(200);
  });

  test('pero si puede restringir y reactivar a otros', async () => {
    const otra = await crearCuenta();
    const jefe = await crearCuenta();
    const tokenAdmin = await hacerAdministrador(jefe.correo);

    expect(
      (await como(tokenAdmin).patch(`/api/usuarios/${otra.id}/estado`).send({ estado: 'restringido' }))
        .status
    ).toBe(200);

    expect(
      (await como(tokenAdmin).patch(`/api/usuarios/${otra.id}/estado`).send({ estado: 'activo' }))
        .status
    ).toBe(200);
  });

  test('tampoco por Configuracion: tiene que pedirselo a otro administrador', async () => {
    const jefe = await crearCuenta();
    const tokenAdmin = await hacerAdministrador(jefe.correo);

    const propia = await como(tokenAdmin).delete('/api/usuarios/me').send({ contrasena: CLAVE });

    expect(propia.status).toBe(403);
    expect(propia.body.message).toContain('otro administrador');
  });

  test('pero otro administrador si puede eliminarlo', async () => {
    const jefe = await crearCuenta();
    const otroJefe = await crearCuenta();

    await hacerAdministrador(jefe.correo);
    const tokenOtro = await hacerAdministrador(otroJefe.correo);

    // Lo que se corta es hacerlo contra uno mismo, no la operacion: si no,
    // una cuenta de administrador no se podria dar de baja nunca
    const respuesta = await como(tokenOtro).delete(`/api/usuarios/${jefe.id}`);

    expect(respuesta.status).toBe(200);
  });
});
