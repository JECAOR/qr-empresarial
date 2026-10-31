// ============================================
// SERVER.JS — punto de entrada de la aplicacion
// Carga las variables de entorno, comprueba la conexion con MySQL
// y pone el servidor Express a escuchar peticiones.
// ============================================

require('dotenv').config();

const app = require('./app');
const pool = require('./config/database');
const frontend = require('./config/frontend');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Consulta minima para verificar que la base de datos responde
    await pool.query('SELECT 1');
    console.log('MySQL connected successfully');

    // Se avisa, pero no se impide arrancar: la API sirve igual aunque no
    // haya pantallas que publicar, y quien solo use Postman no deberia
    // quedarse sin servidor por eso.
    const problema = frontend.revisar();

    if (problema) {
      console.warn('\n  AVISO: no se pueden publicar las pantallas.');
      console.warn(`  ${problema}\n`);
    }

    app.listen(PORT, () => {
      console.log(`QR Empresarial API running on port ${PORT}`);
      console.log(`Frontend publicado: ${frontend.EN_REACT ? 'React' : 'clasico'}`);
    });
  } catch (error) {
    console.error('Error connecting to MySQL:', error.message);
  }
}

startServer();
