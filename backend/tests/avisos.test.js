// ============================================
// TESTS/AVISOS.TEST.JS — el resumen semanal por correo (RF-12)
//
// Lo que se prueba aqui no es una ruta: es un proceso que nadie mira cuando
// corre. Un error en una peticion web lo ve quien la hizo; un error aqui son
// correos repetidos a cien negocios, o ninguno, y nadie se enteraria hasta
// que alguien se queje. Por eso las pruebas se centran en las dos cosas que
// de verdad pueden doler: a quien se le manda y cuantas veces.
//
// nodemailer esta simulado en tests/setup/entorno.js y cada mensaje queda en
// global.__correosEnviados, asi que se comprueba el correo DE VERDAD —asunto,
// texto y HTML— sin abrir una conexion. por-archivo.js vacia esa lista antes
// de cada prueba.
//
// La base de pruebas es una sola para toda la suite y se llena de cuentas de
// otros archivos, asi que ninguna prueba cuenta correos en total: todas
// filtran por la direccion de la cuenta que acaban de crear.
// ============================================

const { app, request, CLAVE, crearCuenta, entrar, agregarBloque, como } = require('./ayudas');
const pool = require('../src/config/database');
const avisoService = require('../src/modules/avisos/aviso.service');
const avisoRepository = require('../src/modules/avisos/aviso.repository');
const correo = require('../src/utils/correo');

const LUNES = new Date('2026-11-23T09:00:00');

/** Los correos que se le mandaron a una direccion en esta prueba. */
const correosPara = (direccion) =>
  global.__correosEnviados.filter((m) => m.to === direccion);

/** Un negocio publicado y con una visita contada en la semana. */
async function negocioConActividad(nombreNegocio) {
  const cuenta = await crearCuenta(nombreNegocio ? { nombreNegocio } : {});

  const idEnlace = await agregarBloque(cuenta.token, {
    titulo: 'Ver el menu',
    detalle: 'https://ejemplo.co/menu'
  });

  await como(cuenta.token).post('/api/qr');
  await request(app).post(`/api/publico/${cuenta.slug}/eventos`).send({ tipo: 'visita' });

  return { ...cuenta, idEnlace };
}

/** Las filas de aviso_enviado de una cuenta. */
async function reservasDe(idUsuario) {
  const [filas] = await pool.execute(
    'SELECT tipo, periodo FROM aviso_enviado WHERE id_usuario = ?',
    [idUsuario]
  );

  return filas;
}

describe('a quien le llega el resumen', () => {
  test('a un negocio con actividad, una vez', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });

  // La fila de preferencia_usuario no existe hasta que alguien guarda algo en
  // Configuracion, y eso es la mayoria de las cuentas. Si la consulta tratara
  // esa ausencia como un no, el resumen no le llegaria a casi nadie y seria
  // dificil de notar: no hay error, simplemente no sale.
  test('aunque nunca haya tocado la preferencia', async () => {
    const cuenta = await negocioConActividad();

    const [filas] = await pool.execute(
      'SELECT id_preferencia FROM preferencia_usuario WHERE id_usuario = ?',
      [cuenta.id]
    );

    expect(filas).toHaveLength(0);

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });

  test('no le llega a quien lo apago', async () => {
    const cuenta = await negocioConActividad();

    await como(cuenta.token).put('/api/usuarios/me/preferencias').send({ resumen: false });

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(0);
  });

  test('y si lo vuelve a encender, le llega', async () => {
    const cuenta = await negocioConActividad();

    await como(cuenta.token).put('/api/usuarios/me/preferencias').send({ resumen: false });
    await como(cuenta.token).put('/api/usuarios/me/preferencias').send({ resumen: true });

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });
});

describe('a quien no se le escribe', () => {
  // Un correo semanal que dice "cero escaneos" es la razon mas comun por la
  // que alguien apaga los avisos.
  test('a un negocio sin actividad esa semana', async () => {
    const cuenta = await crearCuenta();

    await agregarBloque(cuenta.token);
    await como(cuenta.token).post('/api/qr');

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(0);
  });

  // Y no se le aparta el envio: si se reservara, el negocio se quedaria sin
  // resumen tambien la semana en que por fin tenga visitas.
  test('y no se le aparta nada, para que lo reciba cuando tenga visitas', async () => {
    const cuenta = await crearCuenta();

    await agregarBloque(cuenta.token);
    await como(cuenta.token).post('/api/qr');

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(await reservasDe(cuenta.id)).toHaveLength(0);

    await request(app).post(`/api/publico/${cuenta.slug}/eventos`).send({ tipo: 'visita' });
    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });

  test('ni a una cuenta restringida', async () => {
    const cuenta = await negocioConActividad();

    await pool.execute("UPDATE usuario SET estado = 'restringido' WHERE id_usuario = ?", [cuenta.id]);

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(0);
  });

  // Escribirle a quien se dio de baja es lo que convierte un aviso en correo
  // no deseado.
  //
  // Lo que bloquea esta cuenta es el filtro de estado, no el de deleted_at:
  // la baja pone los dos a la vez (estado = 'restringido' y deleted_at), asi
  // que las dos condiciones se solapan por este camino y la de deleted_at es
  // un cinturon de mas. Se deja escrito para que nadie lea esta prueba como
  // la que demuestra que deleted_at sirve.
  test('ni a una cuenta dada de baja', async () => {
    const cuenta = await negocioConActividad();

    await como(cuenta.token).delete('/api/usuarios/me').send({ contrasena: CLAVE });

    // La baja reescribe el correo a 'eliminado_<id>_<correo>'. Filtrar solo
    // por el de antes hacia que esta prueba pasara aunque el mensaje se
    // mandara: no distinguia nada. Se comprueban las dos direcciones.
    const [[fila]] = await pool.execute(
      'SELECT correo FROM usuario WHERE id_usuario = ?',
      [cuenta.id]
    );

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(0);
    expect(correosPara(fila.correo)).toHaveLength(0);
  });

  test('ni a un administrador, que no tiene negocio que resumir', async () => {
    const cuenta = await negocioConActividad();

    await pool.execute(
      "UPDATE usuario SET rol = 'administrador' WHERE id_usuario = ?",
      [cuenta.id]
    );

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(0);
  });

  // Es la cuenta que crea el administrador desde POST /api/usuarios: existe,
  // esta activa y es de empresa, pero no completo el perfil. Sin el JOIN, el
  // proceso pediria sus estadisticas y recibiria el 404 del servicio.
  test('ni a una cuenta de empresa que aun no tiene perfil', async () => {
    const base = await crearCuenta();

    await pool.execute(
      "UPDATE usuario SET rol = 'administrador' WHERE id_usuario = ?",
      [base.id]
    );

    const admin = await entrar(base.correo);
    const sinPerfil = `sin.perfil.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@ejemplo.co`;

    await como(admin).post('/api/usuarios')
      .send({ nombre: 'Sin Perfil', correo: sinPerfil, contrasena: CLAVE, rol: 'empresa' });

    const cuenta = await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(sinPerfil)).toHaveLength(0);
    expect(cuenta.fallidos).toBe(0);
  });
});

describe('no se manda dos veces', () => {
  test('dos corridas el mismo dia dejan un solo correo', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });
    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });

  // REGRESION del diseno. La primera version calculaba el periodo restando
  // siete dias a la fecha de la corrida. Con eso, la tarea del lunes y una
  // ejecucion a mano del jueves daban claves distintas y el negocio recibia
  // dos resumenes de la misma semana. El periodo se ancla al lunes para que
  // cualquier corrida de esa semana caiga en el mismo.
  test('ni una corrida a mano tres dias despues', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });
    await avisoService.enviarResumenesSemanales({ ahora: new Date('2026-11-26T18:00:00') });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });

  test('ni el domingo, que sigue siendo la misma semana', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });
    await avisoService.enviarResumenesSemanales({ ahora: new Date('2026-11-29T23:30:00') });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });

  test('pero la semana siguiente vuelve a llegar', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });
    await avisoService.enviarResumenesSemanales({ ahora: new Date('2026-11-30T09:00:00') });

    expect(correosPara(cuenta.correo)).toHaveLength(2);
  });

  test('y queda registrado con el lunes de su semana', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: new Date('2026-11-26T18:00:00') });

    const reservas = await reservasDe(cuenta.id);

    expect(reservas).toHaveLength(1);
    expect(reservas[0].tipo).toBe('resumen');

    // mysql2 devuelve una columna DATE como objeto Date. Se comparan las
    // partes locales: su representacion en texto trae la zona horaria.
    const periodo = new Date(reservas[0].periodo);

    expect(periodo.getFullYear()).toBe(2026);
    expect(periodo.getMonth() + 1).toBe(11);
    expect(periodo.getDate()).toBe(23);
  });
});

describe('cuando un envio falla', () => {
  test('se suelta la reserva y el siguiente intento vuelve a probar', async () => {
    const cuenta = await negocioConActividad();

    const roto = async () => {
      throw new Error('El servidor SMTP rechazo el mensaje');
    };

    const fallida = await avisoService.enviarResumenesSemanales({ ahora: LUNES, enviar: roto });

    expect(fallida.fallidos).toBeGreaterThanOrEqual(1);
    expect(await reservasDe(cuenta.id)).toHaveLength(0);

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)).toHaveLength(1);
  });

  // Cien negocios esperando el resumen no pueden quedarse sin el porque una
  // direccion rebote.
  test('un fallo no deja sin resumen a los demas', async () => {
    const malo = await negocioConActividad('Negocio Que Rebota');
    const bueno = await negocioConActividad('Negocio Que Si Recibe');

    const soloFallaUno = async (destinatario, datos) => {
      if (destinatario === malo.correo) {
        throw new Error('Direccion inexistente');
      }

      return correo.enviarResumenSemanal(destinatario, datos);
    };

    await avisoService.enviarResumenesSemanales({ ahora: LUNES, enviar: soloFallaUno });

    expect(correosPara(malo.correo)).toHaveLength(0);
    expect(correosPara(bueno.correo)).toHaveLength(1);
  });
});

describe('lo que dice el correo', () => {
  test('el asunto lleva el nombre del negocio', async () => {
    const cuenta = await negocioConActividad('Panaderia Del Resumen');

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    expect(correosPara(cuenta.correo)[0].subject).toContain('Panaderia Del Resumen');
  });

  // Las dos versiones, por lo mismo que el correo de recuperacion: algunos
  // filtros antispam desconfian de los mensajes que solo traen HTML.
  test('va en texto y en HTML', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    const mensaje = correosPara(cuenta.correo)[0];

    expect(mensaje.text).toBeTruthy();
    expect(mensaje.html).toBeTruthy();
    expect(mensaje.text).not.toMatch(/<div/);
  });

  test('trae las cifras de la semana', async () => {
    const cuenta = await negocioConActividad();

    await request(app).post(`/api/publico/${cuenta.slug}/eventos`).send({ tipo: 'visita' });

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    const mensaje = correosPara(cuenta.correo)[0];

    // Dos visitas: la del montaje y la de aqui
    expect(mensaje.text).toMatch(/Visitas a la pagina:\s+2/);
    expect(mensaje.html).toContain('visitas');
  });

  test('nombra los enlaces mas pulsados', async () => {
    const cuenta = await negocioConActividad();
    const numero = Number(cuenta.idEnlace.split('-')[1]);

    await request(app).post(`/api/publico/${cuenta.slug}/eventos`)
      .send({ tipo: 'clic', idEnlace: numero });

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    const mensaje = correosPara(cuenta.correo)[0];

    expect(mensaje.text).toContain('Ver el menu');
    expect(mensaje.html).toContain('Ver el menu');
  });

  // El nombre lo escribe una persona y acaba dentro del cuerpo del mensaje.
  test('un nombre con signos de HTML no se escribe en crudo', async () => {
    const cuenta = await negocioConActividad('Pan y Cafe <Centro>');

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    const mensaje = correosPara(cuenta.correo)[0];

    expect(mensaje.html).toContain('&lt;Centro&gt;');
    expect(mensaje.html).not.toContain('<Centro>');
  });

  test('y se dice como dejar de recibirlo', async () => {
    const cuenta = await negocioConActividad();

    await avisoService.enviarResumenesSemanales({ ahora: LUNES });

    const mensaje = correosPara(cuenta.correo)[0];

    expect(mensaje.text).toMatch(/configuracion/i);
    expect(mensaje.html).toContain('/configuracion');
  });
});

describe('en produccion sin SMTP', () => {
  // Es un error de despliegue. Conviene que se vea entero y de una vez, no
  // como un fallo por cada negocio, y antes de tocar la base.
  test('no se intenta y se dice que falta configurarlo', async () => {
    const antes = {
      NODE_ENV: process.env.NODE_ENV,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS
    };

    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    try {
      await expect(avisoService.enviarResumenesSemanales({ ahora: LUNES }))
        .rejects.toThrow(/falta configurar SMTP_HOST/);
    } finally {
      Object.entries(antes).forEach(([clave, valor]) => {
        if (valor === undefined) {
          delete process.env[clave];
        } else {
          process.env[clave] = valor;
        }
      });
    }
  });
});

describe('la reserva ante un error que no es un duplicado', () => {
  // Importa mucho mas de lo que parece. reservarEnvio() devuelve false
  // cuando choca con el UNIQUE, y el Service lee ese false como "este correo
  // ya salio". Si se tragara cualquier otro error de la base y devolviera
  // false igual, una base caida se veria exactamente como una semana en la
  // que ya se habia enviado todo: cero correos, cero fallos, cero rastro. El
  // proceso diria que fue bien y nadie recibiria su resumen.
  test('se propaga en lugar de parecer un envio ya hecho', async () => {
    // Una cuenta que no existe viola la clave ajena: es un error de la base
    // y no un duplicado.
    await expect(avisoRepository.reservarEnvio(999999, 'resumen', '2026-11-23'))
      .rejects.toThrow();
  });

  test('y el error que llega no es el de duplicado', async () => {
    await expect(avisoRepository.reservarEnvio(999999, 'resumen', '2026-11-23'))
      .rejects.toMatchObject({ code: expect.not.stringContaining('ER_DUP_ENTRY') });
  });
});

describe('la llamada tal como la hace la tarea', () => {
  // La tarea llama a enviarResumenesSemanales() sin un solo argumento, asi
  // que los valores por defecto —la fecha de hoy y el envio de verdad— son
  // el camino de produccion. Todas las demas pruebas pasan 'ahora' a mano,
  // de modo que sin esta prueba ese camino no se ejecutaria nunca aqui.
  test('sin argumentos funciona y resume la semana en curso', async () => {
    const cuenta = await avisoService.enviarResumenesSemanales();

    expect(cuenta.periodo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(avisoService.lunesDeLaSemana(new Date())).toBe(cuenta.periodo);
    expect(cuenta.fallidos).toBe(0);
  });
});
