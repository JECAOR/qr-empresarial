// ============================================
// TESTS/SETUP/GLOBAL-SETUP.JS — prepara la base de pruebas, una sola vez
//
// Se recrea en cada ejecucion en lugar de limpiarla: asi una prueba no puede
// aprobar por los datos que dejo otra, que es la forma mas facil de tener una
// suite verde que no prueba nada.
// ============================================

const path = require('node:path');
const mysql = require('mysql2/promise');

const { NOMBRE, sentencias } = require('./base-de-pruebas');

require('dotenv').config({ quiet: true, path: path.join(__dirname, '..', '..', '.env') });

module.exports = async function prepararBaseDePruebas() {
  // Un seguro: este archivo borra una base entera. Si por un error de
  // configuracion el nombre fuera el de desarrollo, se perderia el trabajo
  // del proyecto.
  if (!NOMBRE.endsWith('_test')) {
    throw new Error(`La base de pruebas debe terminar en _test; llego "${NOMBRE}"`);
  }

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    multipleStatements: false
  });

  await conexion.query(`DROP DATABASE IF EXISTS \`${NOMBRE}\``);
  await conexion.query(
    `CREATE DATABASE \`${NOMBRE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conexion.query(`USE \`${NOMBRE}\``);

  for (const sentencia of sentencias()) {
    await conexion.query(sentencia);
  }

  await conexion.end();
};
