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

// ============================================
// Las reglas del validador, una por una
//
// Cada rama de usuario.validator.js es una regla que protege los datos, y
// tres cuartas partes no se habian ejecutado nunca: las pruebas entraban por
// el camino bueno y por uno o dos malos, no por todos.
//
// Van en tablas porque es lo que son: una lista de reglas. Un caso por rama,
// con el cuerpo que la dispara y el mensaje que debe salir.
//
// Los tres casos de la contrasena esperan el mismo mensaje a proposito: el
// validador da uno solo para las cuatro condiciones. Lo que cambia entre
// ellos no es el texto, es la rama que lo produce.
// ============================================

describe('crear una cuenta: cada regla rechaza lo suyo', () => {
  const completo = () => ({
    nombre: 'Persona Nueva',
    correo: correoNuevo(),
    contrasena: CLAVE,
    rol: 'empresa'
  });

  const CASOS = [
    ['sin nombre', { nombre: undefined }, /nombre, correo y contrasena son obligatorios/],
    ['sin correo', { correo: undefined }, /nombre, correo y contrasena son obligatorios/],
    ['sin contrasena', { contrasena: undefined }, /nombre, correo y contrasena son obligatorios/],
    ['con el nombre de una letra', { nombre: 'A' }, /al menos 2 caracteres/],
    ['con el nombre casi en blanco', { nombre: '   x' }, /al menos 2 caracteres/],
    ['con el nombre que no es texto', { nombre: 12345 }, /al menos 2 caracteres/],
    ['con un correo sin arroba', { correo: 'sinarroba.co' }, /formato del correo/],
    ['con un correo sin punto', { correo: 'ana@ejemplo' }, /formato del correo/],
    ['con un correo con espacios', { correo: 'a n@ejemplo.co' }, /formato del correo/],
    ['con la contrasena corta', { contrasena: 'Cl4v*' }, /mínimo 8 caracteres/],
    ['con la contrasena sin mayuscula', { contrasena: 'clave123*' }, /una mayúscula/],
    ['con la contrasena sin numero', { contrasena: 'ClaveClave*' }, /un número/],
    ['con la contrasena sin simbolo', { contrasena: 'Clave12345' }, /un símbolo/],
    ['con la contrasena que no es texto', { contrasena: 12345678 }, /mínimo 8 caracteres/],
    ['con un rol inventado', { rol: 'superusuario' }, /empresa o administrador/]
  ];

  test.each(CASOS)('no deja crearla %s', async (_, cambio, mensaje) => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const respuesta = await como(token).post('/api/usuarios').send({ ...completo(), ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(mensaje);
  });

  // El rol es opcional al crear: sin el, la cuenta nace como empresa.
  test('sin rol la crea igual, como empresa', async () => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const datos = completo();

    delete datos.rol;

    const respuesta = await como(token).post('/api/usuarios').send(datos);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.rol).toBe('empresa');
  });
});

describe('actualizar una cuenta: las mismas reglas, y el rol obligatorio', () => {
  const CASOS = [
    ['sin nombre', { nombre: undefined }, /nombre, correo y rol son obligatorios/],
    ['sin correo', { correo: undefined }, /nombre, correo y rol son obligatorios/],
    // Al crear es opcional; al actualizar no, porque cambiarlo es una de las
    // cosas que se hacen desde esa pantalla.
    ['sin rol', { rol: undefined }, /nombre, correo y rol son obligatorios/],
    ['con el nombre de una letra', { nombre: 'A' }, /al menos 2 caracteres/],
    ['con un correo invalido', { correo: 'no-es-correo' }, /formato del correo/],
    ['con un rol inventado', { rol: 'jefe' }, /empresa o administrador/]
  ];

  test.each(CASOS)('no deja actualizarla %s', async (_, cambio, mensaje) => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);
    const otra = await crearCuenta();

    const respuesta = await como(token).put(`/api/usuarios/${otra.id}`).send({
      nombre: 'Nombre Nuevo',
      correo: correoNuevo(),
      rol: 'empresa',
      ...cambio
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(mensaje);
  });
});

describe('el identificador de la direccion', () => {
  // Se convierte con Number y se exige entero positivo: "2.5" no cuela, que
  // es lo que pasaria con parseInt.
  test.each(['abc', '0', '-3', '2.5'])('%s no es un identificador', async (id) => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const respuesta = await como(token).get(`/api/usuarios/${id}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/identificador del usuario no es válido/);
  });
});

describe('el estado, la contrasena propia y los avisos', () => {
  test.each(['inventado', '', 'ACTIVO'])('el estado "%s" se rechaza', async (estado) => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);
    const otra = await crearCuenta();

    const respuesta = await como(token).patch(`/api/usuarios/${otra.id}/estado`).send({ estado });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/activo o restringido/);
  });

  // Sin la actual, quien se sentara ante una sesion abierta podria cambiarla
  // y quedarse con la cuenta.
  test.each([undefined, '', 12345])(
    'cambiar la contrasena sin la actual (%s) se rechaza',
    async (contrasenaActual) => {
      const { token } = await crearCuenta();

      const respuesta = await como(token).put('/api/usuarios/me/contrasena')
        .send({ contrasenaActual, contrasenaNueva: 'OtraClave1*' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message).toMatch(/contraseña actual es obligatoria/);
    }
  );

  test.each([undefined, ''])('darse de baja sin confirmar (%s) se rechaza', async (contrasena) => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).delete('/api/usuarios/me').send({ contrasena });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/confirmar su contraseña/);
  });

  // Son dos interruptores. Guardar "si" o 1 seria guardar basura en una
  // columna que luego alguien leera como booleano.
  test.each([
    { resumen: 'si', novedades: true },
    { resumen: true, novedades: 1 },
    { resumen: null, novedades: false },
    { resumen: true }
  ])('las preferencias %o se rechazan', async (preferencias) => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me/preferencias').send(preferencias);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/true o false/);
  });
});

describe('los datos propios', () => {
  const LARGO = 'a'.repeat(101);

  test.each([
    ['el nombre de una letra', { nombre: 'A' }, /al menos 2 caracteres/],
    ['el nombre que no es texto', { nombre: null }, /al menos 2 caracteres/],
    ['un correo invalido', { correo: 'sin-arroba' }, /formato del correo/],
    ['un correo que no es texto', { correo: 99 }, /formato del correo/],
    ['un nombre larguísimo', { nombre: LARGO }, /no pueden superar los 100/],
    ['un correo larguísimo', { correo: `${LARGO}@ejemplo.co` }, /no pueden superar los 100/]
  ])('no se guardan con %s', async (_, cambio, mensaje) => {
    const { token, correo } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me')
      .send({ nombre: 'Nombre Valido', correo, ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(mensaje);
  });
});

// ============================================
// Lo ultimo que quedaba con riesgo de verdad
// ============================================

const jwt = require('jsonwebtoken');

describe('un token sin identificador de sesion', () => {
  // Cada token lleva un jti con el que se comprueba si la sesion fue
  // cerrada. Uno sin jti no se puede consultar contra esa lista: aunque
  // estuviera bien firmado, aceptarlo significaria que cerrar sesion no
  // sirve de nada para el. Se rechaza.
  test('se rechaza aunque la firma sea buena', async () => {
    const { id } = await crearCuenta();

    const sinJti = jwt.sign(
      { id, correo: 'da@igual.co', rol: 'empresa' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    const respuesta = await como(sinJti).get('/api/usuarios/me');

    expect(respuesta.status).toBe(401);
  });
});

describe('el enlace de recuperacion, al abrirlo', () => {
  // La pantalla consulta el enlace antes de ensenar el formulario: si no
  // sirve, se dice ahi y no despues de escribir la contrasena nueva.
  test('uno desconocido se rechaza al comprobarlo', async () => {
    const respuesta = await request(app).get(`/api/auth/restablecer/${'c'.repeat(64)}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/no es válido o ya expiró/);
  });
});

describe('cambiar el correo con la contrasena equivocada', () => {
  // El correo es con el que se entra y al que llega el enlace de
  // recuperacion: quien se hiciera con una sesion abierta podria cambiarlo
  // y apropiarse de la cuenta. Por eso se pide la contrasena, y por eso
  // tiene que comprobarse de verdad.
  test('no se cambia, y se dice que la contrasena no es', async () => {
    const { token } = await crearCuenta();

    const respuesta = await como(token).put('/api/usuarios/me').send({
      nombre: 'Nombre Valido',
      correo: correoNuevo(),
      contrasena: 'EstaNoEsLaClave1*'
    });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toMatch(/contraseña no es correcta/);
  });

  test('y el correo sigue siendo el de antes', async () => {
    const { token, correo } = await crearCuenta();

    await como(token).put('/api/usuarios/me').send({
      nombre: 'Nombre Valido',
      correo: correoNuevo(),
      contrasena: 'EstaNoEsLaClave1*'
    });

    const yo = await como(token).get('/api/usuarios/me');

    expect(yo.body.data.correo).toBe(correo);
  });
});

describe('consultar una cuenta que no existe', () => {
  test('da 404 y no un cuerpo vacio', async () => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const respuesta = await como(token).get('/api/usuarios/999999');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toMatch(/Usuario no encontrado/);
  });
});

describe('los filtros de la administracion', () => {
  // Filtrar por rol es lo que usa el administrador para ver solo empresas.
  test('por rol devuelve solo los de ese rol', async () => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    await crearCuenta();

    const empresas = await como(token).get('/api/admin/usuarios?rol=empresa');

    expect(empresas.status).toBe(200);
    expect(empresas.body.data.length).toBeGreaterThan(0);
    expect(empresas.body.data.every((u) => u.rol === 'empresa')).toBe(true);

    const admins = await como(token).get('/api/admin/usuarios?rol=administrador');

    expect(admins.body.data.every((u) => u.rol === 'administrador')).toBe(true);
  });

  // Un filtro inventado no revienta ni cuela en la consulta: se ignora y se
  // devuelve la lista entera.
  test('un rol inventado se ignora en lugar de fallar', async () => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const respuesta = await como(token).get('/api/admin/usuarios?rol=jefazo');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.length).toBeGreaterThan(0);
  });

  test('y un orden inventado cae en el de siempre', async () => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const respuesta = await como(token).get('/api/admin/usuarios?orden=porLoQueSea');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.length).toBeGreaterThan(0);
  });
});

describe('la regla del correo unico al actualizar (RN-01)', () => {
  // Cambiar una cuenta al correo de otra la dejaria sin forma de entrar, y
  // a la otra con un duplicado que la base rechaza con un error crudo.
  test('no se puede poner el correo de otra cuenta', async () => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const una = await crearCuenta();
    const otra = await crearCuenta();

    const respuesta = await como(token).put(`/api/usuarios/${una.id}`).send({
      nombre: 'Nombre Valido',
      correo: otra.correo,
      rol: 'empresa'
    });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.message).toMatch(/correo ya está registrado/);
  });

  // Pero el suyo propio si: guardar sin tocar el correo es lo normal.
  test('pero si el suyo propio, que es lo normal al guardar', async () => {
    const jefe = await crearCuenta();
    const token = await hacerAdministrador(jefe.correo);

    const una = await crearCuenta();

    const respuesta = await como(token).put(`/api/usuarios/${una.id}`).send({
      nombre: 'Nombre Cambiado',
      correo: una.correo,
      rol: 'empresa'
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.nombre).toBe('Nombre Cambiado');
  });
});
