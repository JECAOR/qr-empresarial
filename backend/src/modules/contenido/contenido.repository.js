// ============================================
// CONTENIDO.REPOSITORY.JS — acceso a datos del contenido (RF-05, RF-06)
//
// El esquema parte el contenido en dos tablas: `enlace` para lo que lleva a
// otra parte y `elemento` para los textos y botones. La pantalla, en cambio,
// maneja una sola lista. Esta capa lee de las dos y las devuelve con la
// misma forma, para que el Service no tenga que saber de dónde vino cada
// fila. Las diferencias entre tablas se concentran aquí.
// ============================================

const pool = require('../../config/database');

// Las dos consultas devuelven las mismas columnas con los mismos nombres.
// "clase" dice de qué tabla salió cada fila: hace falta para construir el
// identificador que usa la API (enlace-12, elemento-7) y para saber a qué
// tabla escribir después.
const SELECT_ENLACES = `
  SELECT 'enlace' AS clase, e.id_enlace AS id, e.titulo, e.seccion,
         e.url AS detalle, e.orden, e.activo,
         c.id_categoria_enlace AS id_categoria, c.nombre AS categoria, c.icono
  FROM enlace e
  JOIN categoria_enlace c ON c.id_categoria_enlace = e.id_categoria_enlace
  WHERE e.id_perfil = ?
`;

const SELECT_ELEMENTOS = `
  SELECT 'elemento' AS clase, el.id_elemento AS id, el.titulo, el.seccion,
         el.contenido AS detalle, el.orden, el.activo,
         c.id_categoria_elemento AS id_categoria, c.nombre AS categoria, c.icono
  FROM elemento el
  JOIN categoria_elemento c ON c.id_categoria_elemento = el.id_categoria_elemento
  WHERE el.id_perfil = ?
`;

/**
 * Devuelve todo el contenido de un perfil, de las dos tablas.
 *
 * Se ordena en SQL y no en JavaScript para que la base aproveche el índice
 * (id_perfil, seccion, orden) de la migración 008.
 *
 * @param {number} idPerfil
 * @returns {Promise<object[]>}
 */
async function listarPorPerfil(idPerfil) {
  const [filas] = await pool.execute(
    `${SELECT_ENLACES} UNION ALL ${SELECT_ELEMENTOS} ORDER BY seccion, orden, id`,
    [idPerfil, idPerfil]
  );

  return filas;
}

/**
 * Busca un contenido concreto, comprobando que sea del perfil indicado.
 *
 * El perfil va en la consulta y no se comprueba después: así una petición
 * con el identificador de otra empresa no devuelve nada, en lugar de
 * devolver sus datos y confiar en que alguien los filtre.
 *
 * @param {'enlace'|'elemento'} clase
 * @param {number} id
 * @param {number} idPerfil
 * @returns {Promise<object|undefined>}
 */
async function buscarPorId(clase, id, idPerfil) {
  const consulta = clase === 'enlace' ? SELECT_ENLACES : SELECT_ELEMENTOS;
  const columnaId = clase === 'enlace' ? 'e.id_enlace' : 'el.id_elemento';

  const [filas] = await pool.execute(`${consulta} AND ${columnaId} = ?`, [idPerfil, id]);

  return filas[0];
}

/**
 * Cuántos bloques activos tiene un perfil, de las dos tablas.
 *
 * Lo usan dos reglas distintas y conviene que sea la misma cuenta: el módulo
 * 4 no genera un código QR para un perfil vacío, y el módulo 3 no deja
 * quitar el último bloque de un perfil que ya tiene código. Si cada una
 * contara por su cuenta, podrían dejar de estar de acuerdo.
 *
 * @param {number} idPerfil
 * @returns {Promise<number>}
 */
async function contarActivos(idPerfil) {
  const [filas] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM enlace   WHERE id_perfil = ? AND activo = 1) +
       (SELECT COUNT(*) FROM elemento WHERE id_perfil = ? AND activo = 1) AS total`,
    [idPerfil, idPerfil]
  );

  return Number(filas[0].total);
}

/**
 * Siguiente posición libre dentro de una sección.
 *
 * Se mira en las dos tablas porque el orden es de la sección completa, no de
 * cada tabla: en la pantalla los enlaces y los textos se intercalan.
 *
 * @param {number} idPerfil
 * @param {string} seccion
 * @returns {Promise<number>}
 */
async function siguienteOrden(idPerfil, seccion) {
  const [filas] = await pool.execute(
    `SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM (
       SELECT orden FROM enlace   WHERE id_perfil = ? AND seccion = ?
       UNION ALL
       SELECT orden FROM elemento WHERE id_perfil = ? AND seccion = ?
     ) AS todo`,
    [idPerfil, seccion, idPerfil, seccion]
  );

  return filas[0].siguiente;
}

/**
 * Crea un enlace.
 * @returns {Promise<number>} Identificador creado.
 */
async function crearEnlace(datos) {
  const { idPerfil, titulo, seccion, detalle, idCategoria, orden } = datos;

  const [resultado] = await pool.execute(
    `INSERT INTO enlace (titulo, seccion, url, orden, id_perfil, id_categoria_enlace)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [titulo, seccion, detalle, orden, idPerfil, idCategoria]
  );

  return resultado.insertId;
}

/**
 * Crea un texto o un botón.
 *
 * La columna `tipo` repite el nombre de la categoría. Es redundante, pero
 * viene del esquema original: se mantiene coherente guardando el nombre de
 * la categoría elegida.
 *
 * @returns {Promise<number>}
 */
async function crearElemento(datos) {
  const { idPerfil, titulo, seccion, detalle, idCategoria, orden, tipo } = datos;

  const [resultado] = await pool.execute(
    `INSERT INTO elemento (titulo, tipo, seccion, contenido, orden, id_perfil, id_categoria_elemento)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [titulo, tipo, seccion, detalle, orden, idPerfil, idCategoria]
  );

  return resultado.insertId;
}

/**
 * Actualiza un enlace del perfil indicado.
 * @returns {Promise<number>} Filas afectadas; 0 si no era de ese perfil.
 */
async function actualizarEnlace(id, idPerfil, datos) {
  const { titulo, seccion, detalle, idCategoria } = datos;

  const [resultado] = await pool.execute(
    `UPDATE enlace
     SET titulo = ?, seccion = ?, url = ?, id_categoria_enlace = ?
     WHERE id_enlace = ? AND id_perfil = ?`,
    [titulo, seccion, detalle, idCategoria, id, idPerfil]
  );

  return resultado.affectedRows;
}

/**
 * Actualiza un texto o botón del perfil indicado.
 * @returns {Promise<number>}
 */
async function actualizarElemento(id, idPerfil, datos) {
  const { titulo, seccion, detalle, idCategoria, tipo } = datos;

  const [resultado] = await pool.execute(
    `UPDATE elemento
     SET titulo = ?, tipo = ?, seccion = ?, contenido = ?, id_categoria_elemento = ?
     WHERE id_elemento = ? AND id_perfil = ?`,
    [titulo, tipo, seccion, detalle, idCategoria, id, idPerfil]
  );

  return resultado.affectedRows;
}

/**
 * Activa o desactiva un contenido (RF-06).
 * @returns {Promise<number>}
 */
async function cambiarEstado(clase, id, idPerfil, activo) {
  const tabla = clase === 'enlace' ? 'enlace' : 'elemento';
  const columnaId = clase === 'enlace' ? 'id_enlace' : 'id_elemento';

  const [resultado] = await pool.execute(
    `UPDATE ${tabla} SET activo = ? WHERE ${columnaId} = ? AND id_perfil = ?`,
    [activo ? 1 : 0, id, idPerfil]
  );

  return resultado.affectedRows;
}

/**
 * Elimina un contenido (RF-06).
 *
 * Aquí el borrado sí es definitivo, a diferencia del de usuarios: un enlace
 * que se quita no tiene historial que conservar ni claves foráneas que
 * dependan de él, salvo los eventos, que se borran con él.
 *
 * @returns {Promise<number>}
 */
async function eliminar(clase, id, idPerfil) {
  const tabla = clase === 'enlace' ? 'enlace' : 'elemento';
  const columnaId = clase === 'enlace' ? 'id_enlace' : 'id_elemento';

  // Los eventos del RF-11 apuntan al enlace: hay que soltarlos antes o la
  // clave foránea impediría el borrado.
  if (clase === 'enlace') {
    await pool.execute('DELETE FROM evento WHERE id_enlace = ?', [id]);
  }

  const [resultado] = await pool.execute(
    `DELETE FROM ${tabla} WHERE ${columnaId} = ? AND id_perfil = ?`,
    [id, idPerfil]
  );

  return resultado.affectedRows;
}

/**
 * Cambia la posición de un contenido dentro de su sección.
 * @returns {Promise<number>}
 */
async function fijarOrden(clase, id, idPerfil, orden) {
  const tabla = clase === 'enlace' ? 'enlace' : 'elemento';
  const columnaId = clase === 'enlace' ? 'id_enlace' : 'id_elemento';

  const [resultado] = await pool.execute(
    `UPDATE ${tabla} SET orden = ? WHERE ${columnaId} = ? AND id_perfil = ?`,
    [orden, id, idPerfil]
  );

  return resultado.affectedRows;
}

/**
 * Busca una categoría concreta, para comprobar que existe antes de usarla.
 *
 * @param {'enlace'|'elemento'} clase
 * @param {number} id
 * @returns {Promise<object|undefined>}
 */
async function buscarCategoria(clase, id) {
  const [filas] = clase === 'enlace'
    ? await pool.execute(
      `SELECT id_categoria_enlace AS id, nombre, icono
       FROM categoria_enlace WHERE id_categoria_enlace = ?`,
      [id]
    )
    : await pool.execute(
      `SELECT id_categoria_elemento AS id, nombre, icono
       FROM categoria_elemento WHERE id_categoria_elemento = ?`,
      [id]
    );

  return filas[0];
}

/**
 * Categorías disponibles, para que la pantalla ofrezca las ocho del RF-05
 * en lugar de tenerlas escritas en el código.
 */
async function listarCategorias() {
  const [enlaces] = await pool.execute(
    `SELECT id_categoria_enlace AS id, nombre, descripcion, icono
     FROM categoria_enlace ORDER BY id_categoria_enlace`
  );

  const [elementos] = await pool.execute(
    `SELECT id_categoria_elemento AS id, nombre, descripcion, icono
     FROM categoria_elemento ORDER BY id_categoria_elemento`
  );

  return { enlaces, elementos };
}

module.exports = {
  listarPorPerfil,
  buscarPorId,
  contarActivos,
  siguienteOrden,
  crearEnlace,
  crearElemento,
  actualizarEnlace,
  actualizarElemento,
  cambiarEstado,
  eliminar,
  fijarOrden,
  buscarCategoria,
  listarCategorias
};
