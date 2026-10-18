// ============================================
// ESTADISTICA.REPOSITORY.JS — acceso a datos de los eventos (RF-11)
//
// La tabla `evento` es la que más va a crecer del esquema: una fila por cada
// escaneo, visita y clic. Por eso las consultas agregan en SQL y no traen
// filas para contarlas en JavaScript, y todas filtran por (id_perfil, tipo,
// fecha), que es el índice de la migración 010.
// ============================================

const pool = require('../../config/database');

/**
 * Registra un evento.
 *
 * La fecha la pone la base (migración 010): es la hora del servidor, no la
 * del dispositivo que lo informa, que podría estar mal puesta.
 *
 * @param {number} idPerfil
 * @param {'escaneo'|'visita'|'clic'} tipo
 * @param {number|null} idEnlace - Solo en los clics.
 * @returns {Promise<number>}
 */
async function registrar(idPerfil, tipo, idEnlace = null) {
  const [resultado] = await pool.execute(
    'INSERT INTO evento (tipo, id_perfil, id_enlace) VALUES (?, ?, ?)',
    [tipo, idPerfil, idEnlace]
  );

  return resultado.insertId;
}

/**
 * Totales por tipo en los últimos N días.
 *
 * Se devuelven los tres tipos aunque alguno tenga cero: un perfil sin clics
 * debe mostrar "0", no quedarse sin la tarjeta.
 *
 * @param {number} idPerfil
 * @param {number} dias
 * @returns {Promise<{escaneo: number, visita: number, clic: number}>}
 */
async function totalesPorTipo(idPerfil, dias) {
  const [filas] = await pool.execute(
    `SELECT tipo, COUNT(*) AS total
     FROM evento
     WHERE id_perfil = ?
       AND fecha >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY tipo`,
    [idPerfil, dias]
  );

  const totales = { escaneo: 0, visita: 0, clic: 0 };

  for (const fila of filas) {
    totales[fila.tipo] = Number(fila.total);
  }

  return totales;
}

/**
 * Serie diaria de los últimos N días, por tipo.
 *
 * Devuelve solo los días con actividad; los vacíos los completa el Service,
 * porque la gráfica necesita los siete días aunque alguno esté a cero y
 * rellenar huecos en SQL obligaría a una tabla de calendario.
 *
 * @param {number} idPerfil
 * @param {number} dias
 * @returns {Promise<object[]>} Filas con dia, tipo y total.
 */
async function serieDiaria(idPerfil, dias) {
  const [filas] = await pool.execute(
    `SELECT DATE(fecha) AS dia, tipo, COUNT(*) AS total
     FROM evento
     WHERE id_perfil = ?
       AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(fecha), tipo
     ORDER BY dia`,
    [idPerfil, dias - 1]
  );

  return filas;
}

/**
 * Enlaces más pulsados.
 *
 * Se une con `enlace` para devolver el título, y no solo el identificador:
 * al dueño del negocio le sirve saber que pulsaron "Ver el menú", no que
 * pulsaron el enlace 12.
 *
 * Los enlaces que se eliminaron no aparecen: el borrado de contenido ya
 * limpia sus eventos.
 *
 * @param {number} idPerfil
 * @param {number} dias
 * @param {number} limite
 * @returns {Promise<object[]>}
 */
async function enlacesMasPulsados(idPerfil, dias, limite) {
  // El límite va interpolado y no como parámetro porque MySQL no acepta un
  // marcador en LIMIT con sentencias preparadas. Se fuerza a entero antes,
  // así que no puede llegar nada que no sea un número.
  const tope = Math.max(1, Math.min(Number.parseInt(limite, 10) || 5, 20));

  const [filas] = await pool.execute(
    `SELECT e.id_enlace, e.titulo, c.nombre AS categoria, COUNT(*) AS clics
     FROM evento ev
     JOIN enlace e ON e.id_enlace = ev.id_enlace
     JOIN categoria_enlace c ON c.id_categoria_enlace = e.id_categoria_enlace
     WHERE ev.id_perfil = ?
       AND ev.tipo = 'clic'
       AND ev.fecha >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY e.id_enlace, e.titulo, c.nombre
     ORDER BY clics DESC, e.titulo
     LIMIT ${tope}`,
    [idPerfil, dias]
  );

  return filas;
}

/**
 * Comprueba que un enlace sea de ese perfil.
 *
 * Lo necesita el registro de clics: el identificador llega desde la vista
 * pública, que es una pantalla abierta, así que no se puede confiar en él.
 *
 * @param {number} idEnlace
 * @param {number} idPerfil
 * @returns {Promise<boolean>}
 */
async function enlaceEsDelPerfil(idEnlace, idPerfil) {
  const [filas] = await pool.execute(
    'SELECT id_enlace FROM enlace WHERE id_enlace = ? AND id_perfil = ?',
    [idEnlace, idPerfil]
  );

  return filas.length > 0;
}

module.exports = {
  registrar,
  totalesPorTipo,
  serieDiaria,
  enlacesMasPulsados,
  enlaceEsDelPerfil
};
