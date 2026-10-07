// ============================================
// DATABASE.JS — conexión con MySQL
// Crea un único pool de conexiones reutilizable por toda la aplicación.
// Los datos nunca se escriben aquí: se leen del archivo .env
// ============================================

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

module.exports = pool;
