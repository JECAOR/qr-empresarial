// ============================================
// PERFIL.REPOSITORY.JS — acceso a datos del perfil empresarial (RF-04)
// Unica capa que escribe SQL de este modulo. Siempre con consultas
// parametrizadas.
// ============================================

const pool = require('../../config/database');

// Campos que se devuelven al cliente. Se enumeran en lugar de usar SELECT *
// para que agregar una columna a la tabla no cambie la respuesta de la API
// sin que nadie lo decida.
const CAMPOS = `
  id_perfil, nombre_negocio, categoria, descripcion, direccion, telefono,
  correo_contacto, instagram, horario, imagen, slug,
  fecha_creacion, fecha_actualizacion, id_usuario
`;

/**
 * Busca el perfil de una cuenta.
 *
 * Hay como maximo uno: la columna id_usuario es UNIQUE desde la migracion 007.
 *
 * @param {number} idUsuario
 * @returns {Promise<object|undefined>}
 */
async function buscarPorUsuario(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT ${CAMPOS} FROM perfil_empresarial WHERE id_usuario = ?`,
    [idUsuario]
  );

  return filas[0];
}

/**
 * Busca un perfil por su slug, la parte legible de la URL publica.
 * La usara la vista publica del RF-09.
 *
 * @param {string} slug
 * @returns {Promise<object|undefined>}
 */
async function buscarPorSlug(slug) {
  const [filas] = await pool.execute(
    `SELECT ${CAMPOS} FROM perfil_empresarial WHERE slug = ?`,
    [slug]
  );

  return filas[0];
}

/**
 * Indica si un slug ya esta tomado.
 *
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
async function slugEnUso(slug) {
  const [filas] = await pool.execute(
    'SELECT id_perfil FROM perfil_empresarial WHERE slug = ?',
    [slug]
  );

  return filas.length > 0;
}

/**
 * Crea el perfil de una cuenta.
 *
 * Acepta una conexion para poder participar en una transaccion: al
 * registrarse se crean la cuenta y su perfil, y no debe quedar una sin el
 * otro. Si no se pasa ninguna, se usa el pool como en el resto del proyecto.
 *
 * @param {object} datos
 * @param {object} [conexion] - Conexion de una transaccion en curso.
 * @returns {Promise<number>} Identificador del perfil creado.
 */
async function crear(datos, conexion) {
  const ejecutor = conexion || pool;

  const {
    idUsuario, nombreNegocio, slug,
    categoria = null, descripcion = null, direccion = null,
    telefono = null, correoContacto = null, instagram = null,
    horario = null, imagen = null
  } = datos;

  const [resultado] = await ejecutor.execute(
    `INSERT INTO perfil_empresarial
       (id_usuario, nombre_negocio, slug, categoria, descripcion, direccion,
        telefono, correo_contacto, instagram, horario, imagen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [idUsuario, nombreNegocio, slug, categoria, descripcion, direccion,
      telefono, correoContacto, instagram, horario, imagen]
  );

  return resultado.insertId;
}

/**
 * Actualiza el perfil de una cuenta.
 *
 * El slug no se toca aqui: la URL publica no debe cambiar porque alguien
 * corrija una errata en el nombre, o los codigos QR ya impresos dejarian de
 * funcionar. Es la razon de ser del RF-09.
 *
 * fecha_actualizacion la pone MySQL sola (ON UPDATE CURRENT_TIMESTAMP).
 *
 * @param {number} idUsuario
 * @param {object} datos
 * @returns {Promise<number>} Filas afectadas.
 */
async function actualizarPorUsuario(idUsuario, datos) {
  const {
    nombreNegocio, categoria, descripcion, direccion,
    telefono, correoContacto, instagram, horario, imagen
  } = datos;

  const [resultado] = await pool.execute(
    `UPDATE perfil_empresarial
     SET nombre_negocio = ?, categoria = ?, descripcion = ?, direccion = ?,
         telefono = ?, correo_contacto = ?, instagram = ?, horario = ?,
         imagen = ?
     WHERE id_usuario = ?`,
    [nombreNegocio, categoria, descripcion, direccion, telefono,
      correoContacto, instagram, horario, imagen, idUsuario]
  );

  return resultado.affectedRows;
}

module.exports = {
  buscarPorUsuario,
  buscarPorSlug,
  slugEnUso,
  crear,
  actualizarPorUsuario
};
