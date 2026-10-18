// ============================================
// ADMIN.REPOSITORY.JS — acceso a datos de la administracion (RF-13, RF-15)
//
// Lo que pide el RF-13 es "la cantidad de usuarios registrados y su
// actividad". Casi toda esa actividad ya estaba repartida por el esquema:
// si la cuenta tiene perfil, cuanto contenido publico, si su codigo QR esta
// encendido y cuantos eventos acumula. Aqui se junta en una sola consulta.
//
// Se agrega en SQL y no trayendo filas para contarlas en JavaScript. La
// tabla `evento` es la que mas crece del esquema, y una pantalla de
// administracion que listara 200 cuentas haria 200 consultas de eventos si
// se resolviera por fuera.
// ============================================

const pool = require('../../config/database');

// Las cuentas eliminadas no se listan: el borrado es logico y la fila sigue
// ahi, pero para la administracion esa cuenta ya no existe.
const VIVAS = 'u.deleted_at IS NULL';

/**
 * Cuantas cuentas hay, por estado y por rol (RF-13).
 *
 * @returns {Promise<object>}
 */
async function resumen() {
  const [filas] = await pool.execute(
    `SELECT
       COUNT(*)                                                   AS total,
       SUM(u.estado = 'activo')                                   AS activos,
       SUM(u.estado = 'restringido')                              AS restringidos,
       SUM(u.rol = 'administrador')                               AS administradores,
       SUM(u.ultimo_acceso IS NULL)                               AS nuncaEntraron,
       SUM(u.ultimo_acceso < DATE_SUB(NOW(), INTERVAL 30 DAY))    AS inactivos30Dias,
       SUM(u.fecha_registro >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS nuevos30Dias
     FROM usuario u
     WHERE ${VIVAS}`
  );

  const fila = filas[0];

  // SUM() sobre cero filas devuelve NULL, y la pantalla necesita numeros
  const numero = (valor) => Number(valor || 0);

  return {
    total: numero(fila.total),
    activos: numero(fila.activos),
    restringidos: numero(fila.restringidos),
    administradores: numero(fila.administradores),
    nuncaEntraron: numero(fila.nuncaEntraron),
    inactivos30Dias: numero(fila.inactivos30Dias),
    nuevos30Dias: numero(fila.nuevos30Dias)
  };
}

// El perfil, el contenido y los eventos se cuentan en subconsultas
// correlacionadas en lugar de con JOIN + GROUP BY: con los JOIN, una cuenta
// con 3 bloques y 50 eventos multiplicaria las filas y los dos conteos
// saldrian inflados.
const SELECT_USUARIOS = `
  SELECT
    u.id_usuario, u.nombre, u.correo, u.rol, u.estado,
    u.fecha_registro, u.ultimo_acceso,
    p.id_perfil, p.nombre_negocio, p.slug,
    (SELECT COUNT(*) FROM enlace   e  WHERE e.id_perfil  = p.id_perfil AND e.activo = 1) +
    (SELECT COUNT(*) FROM elemento el WHERE el.id_perfil = p.id_perfil AND el.activo = 1)
      AS bloques_activos,
    q.activo AS qr_activo,
    (SELECT COUNT(*) FROM evento ev WHERE ev.id_perfil = p.id_perfil AND ev.tipo = 'escaneo') AS escaneos,
    (SELECT COUNT(*) FROM evento ev WHERE ev.id_perfil = p.id_perfil AND ev.tipo = 'visita')  AS visitas,
    (SELECT COUNT(*) FROM evento ev WHERE ev.id_perfil = p.id_perfil AND ev.tipo = 'clic')    AS clics
  FROM usuario u
  LEFT JOIN perfil_empresarial p ON p.id_usuario = u.id_usuario
  LEFT JOIN codigo_qr q          ON q.id_perfil  = p.id_perfil
`;

/**
 * Construye el WHERE y sus parametros a partir de los filtros.
 *
 * Se devuelve el texto y los valores por separado para que todo lo que
 * venga del cliente viaje como parametro: el buscador escribe texto libre y
 * concatenarlo seria una inyeccion SQL de manual.
 *
 * @param {{busqueda?: string, estado?: string, rol?: string}} filtros
 * @returns {{where: string, valores: Array}}
 */
function construirFiltro({ busqueda, estado, rol }) {
  const condiciones = [VIVAS];
  const valores = [];

  if (busqueda) {
    condiciones.push('(u.nombre LIKE ? OR u.correo LIKE ? OR p.nombre_negocio LIKE ?)');
    valores.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
  }

  if (estado) {
    condiciones.push('u.estado = ?');
    valores.push(estado);
  }

  if (rol) {
    condiciones.push('u.rol = ?');
    valores.push(rol);
  }

  return { where: `WHERE ${condiciones.join(' AND ')}`, valores };
}

const ORDENES = {
  registro: 'u.fecha_registro DESC, u.id_usuario DESC',
  // Las que nunca entraron primero: son las que mas probablemente haya que
  // revisar, y con NULLS al final quedarian escondidas al final de la lista
  acceso: 'u.ultimo_acceso IS NULL DESC, u.ultimo_acceso ASC',
  nombre: 'u.nombre ASC',
  actividad: 'escaneos + visitas + clics DESC'
};

/**
 * Lista los usuarios con su actividad (RF-13).
 *
 * @param {object} opciones
 * @returns {Promise<{usuarios: object[], total: number}>}
 */
async function listarConActividad({ busqueda, estado, rol, orden, pagina, porPagina }) {
  const { where, valores } = construirFiltro({ busqueda, estado, rol });

  const [conteo] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM usuario u
     LEFT JOIN perfil_empresarial p ON p.id_usuario = u.id_usuario
     ${where}`,
    valores
  );

  // LIMIT y OFFSET van interpolados porque MySQL no acepta marcadores ahi
  // con sentencias preparadas. Se fuerzan a entero antes, asi que no puede
  // llegar nada que no sea un numero.
  const tope = Math.max(1, Math.min(Number.parseInt(porPagina, 10) || 20, 100));
  const desde = Math.max(0, (Math.max(1, Number.parseInt(pagina, 10) || 1) - 1) * tope);

  const [filas] = await pool.execute(
    `${SELECT_USUARIOS} ${where}
     ORDER BY ${ORDENES[orden] || ORDENES.registro}
     LIMIT ${tope} OFFSET ${desde}`,
    valores
  );

  return { usuarios: filas, total: Number(conteo[0].total) };
}

/**
 * Todos los usuarios que pasan el filtro, sin paginar (RF-15).
 *
 * El reporte descargable no se pagina: quien lo abre en una hoja de calculo
 * espera el conjunto completo, no la pagina que estaba viendo.
 */
async function listarParaReporte({ busqueda, estado, rol, orden }) {
  const { where, valores } = construirFiltro({ busqueda, estado, rol });

  const [filas] = await pool.execute(
    `${SELECT_USUARIOS} ${where} ORDER BY ${ORDENES[orden] || ORDENES.registro}`,
    valores
  );

  return filas;
}

/**
 * Un usuario con su actividad, para el detalle.
 */
async function buscarConActividad(idUsuario) {
  const [filas] = await pool.execute(
    `${SELECT_USUARIOS} WHERE ${VIVAS} AND u.id_usuario = ?`,
    [idUsuario]
  );

  return filas[0];
}

/**
 * Los ultimos eventos de un perfil, para el detalle de la cuenta.
 *
 * @param {number} idPerfil
 * @param {number} limite
 */
async function ultimosEventos(idPerfil, limite = 10) {
  const tope = Math.max(1, Math.min(Number.parseInt(limite, 10) || 10, 50));

  const [filas] = await pool.execute(
    `SELECT ev.tipo, ev.fecha, e.titulo AS enlace
     FROM evento ev
     LEFT JOIN enlace e ON e.id_enlace = ev.id_enlace
     WHERE ev.id_perfil = ?
     ORDER BY ev.fecha DESC
     LIMIT ${tope}`,
    [idPerfil]
  );

  return filas;
}

module.exports = {
  resumen,
  listarConActividad,
  listarParaReporte,
  buscarConActividad,
  ultimosEventos
};
