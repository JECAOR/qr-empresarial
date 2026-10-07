// ============================================
// SERVER.JS — punto de entrada de la aplicacion
// Carga las variables de entorno, comprueba la conexion con MySQL
// y pone el servidor Express a escuchar peticiones.
// ============================================

require('dotenv').config();

const app = require('./app');
const pool = require('./config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Consulta minima para verificar que la base de datos responde
    await pool.query('SELECT 1');
    console.log('MySQL connected successfully');

    app.listen(PORT, () => {
      console.log(`QR Empresarial API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error connecting to MySQL:', error.message);
  }
}

startServer();
