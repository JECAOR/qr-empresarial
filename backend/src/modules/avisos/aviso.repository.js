// ============================================
// AVISO.REPOSITORY.JS — a quien se le manda y que ya se mando (RF-12)
// Unico sitio que consulta la preferencia junto con la cuenta y el perfil, y
// el que lleva la memoria de los correos ya enviados.
// ============================================

const pool = require('../../config/database');

/**
 * Las cuentas que deben recibir el resumen de actividad.
 *
 * Cuatro condiciones, y cada una esta por algo:
 *
 *   - deleted_at IS NULL y estado = 'activo': a una cuenta borrada o
 *     suspendida no se le escribe. Mandarle un resumen semanal a quien fue
 *     dado de baja es lo que convierte un aviso en correo no deseado.
 *   - rol = 'empresa': un administrador no tiene negocio que resumir.
 *   - JOIN con perfil_empresarial: sin perfil no hay actividad que contar.
 *     El JOIN deja fuera las cuentas que crea el administrador y que todavia
 *     no completaron el perfil.
 *
 * Y la preferencia con COALESCE: la fila de preferencia_usuario se crea la
 * primera vez que alguien guarda algo en Configuracion, asi que la mayoria
 * de las cuentas no tiene fila. Sin COALESCE el LEFT JOIN daria NULL y no
 * recibirian nada: justo al contrario de lo que dice la columna, cuyo valor
 * por defecto es 1. No tener fila significa "no lo he cambiado", y el
 * resumen viene encendido.
 *
 * @returns {Promise<Array<{id_usuario: number, correo: string, nombre_negocio: string}>>}
 */
async function destinatariosDelResumen() {
  const [filas] = await pool.execute(
    `SELECT u.id_usuario, u.correo, p.nombre_negocio
     FROM usuario u
     JOIN perfil_empresarial p ON p.id_usuario = u.id_usuario
     LEFT JOIN preferencia_usuario pr ON pr.id_usuario = u.id_usuario
     WHERE u.deleted_at IS NULL
       AND u.estado = 'activo'
       AND u.rol = 'empresa'
       AND COALESCE(pr.aviso_resumen, 1) = 1
     ORDER BY u.id_usuario`
  );

  return filas;
}

/**
 * Aparta el envio antes de mandarlo.
 *
 * La que decide si este correo ya salio es la base, no el codigo: la
 * restriccion uq_aviso_enviado sobre (id_usuario, tipo, periodo) rechaza el
 * segundo INSERT con ER_DUP_ENTRY. Por eso se reserva ANTES de enviar y no
 * despues: entre comprobar y enviar hay un hueco, y en ese hueco cabe otra
 * ejecucion del proceso.
 *
 * Devuelve false en lugar de lanzar: que el aviso ya estuviera enviado no es
 * un error, es el caso normal cuando la tarea corre dos veces en la semana.
 *
 * @param {number} idUsuario
 * @param {string} tipo
 * @param {string} periodo - Primer dia del periodo, 'AAAA-MM-DD'.
 * @returns {Promise<boolean>} true si quedo reservado aqui y ahora.
 */
async function reservarEnvio(idUsuario, tipo, periodo) {
  try {
    await pool.execute(
      `INSERT INTO aviso_enviado (id_usuario, tipo, periodo)
       VALUES (?, ?, ?)`,
      [idUsuario, tipo, periodo]
    );

    return true;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return false;
    }

    throw error;
  }
}

/**
 * Suelta una reserva cuyo correo no se pudo entregar.
 *
 * Sin esto, un fallo del servidor SMTP dejaria el aviso marcado como enviado
 * y el negocio no recibiria nunca el resumen de esa semana. Se prefiere el
 * riesgo de un duplicado —que haria falta que el envio fallara despues de
 * haber entregado el mensaje— al de un correo que se pierde en silencio.
 *
 * @param {number} idUsuario
 * @param {string} tipo
 * @param {string} periodo
 */
async function liberarEnvio(idUsuario, tipo, periodo) {
  await pool.execute(
    `DELETE FROM aviso_enviado
     WHERE id_usuario = ? AND tipo = ? AND periodo = ?`,
    [idUsuario, tipo, periodo]
  );
}

module.exports = {
  destinatariosDelResumen,
  reservarEnvio,
  liberarEnvio
};
