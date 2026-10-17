// ============================================
// APP.JS — configuracion de la aplicacion Express
// Define los middlewares y las rutas, pero NO pone el servidor a escuchar:
// de eso se encarga server.js. Esta separacion permite probar la aplicacion
// sin ocupar el puerto.
// ============================================

const path = require('path');

const cors = require('cors');
const express = require('express');

const authRoutes = require('./modules/auth/auth.routes');
const usuarioRoutes = require('./modules/usuarios/usuario.routes');
const perfilRoutes = require('./modules/perfiles/perfil.routes');
const contenidoRoutes = require('./modules/contenido/contenido.routes');
const qrRoutes = require('./modules/qr/qr.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// --- CORS ---
//
// El navegador bloquea las peticiones entre origenes distintos salvo que el
// servidor las autorice. Hace falta porque el frontend puede servirse desde
// otro puerto: las pruebas de Playwright lo publican en el 4173, y Live
// Server de VS Code suele usar el 5500.
//
// En desarrollo se acepta cualquier origen, para no tener que registrar cada
// puerto que se use al probar. En produccion solo los de CORS_ORIGINS, que es
// una lista separada por comas.
const origenesPermitidos = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? origenesPermitidos : true,

  // De una respuesta de otro origen, el navegador solo deja leer unas pocas
  // cabeceras. Content-Disposition no es una de ellas, y ahi viaja el nombre
  // del archivo de la descarga del codigo QR (RF-08): sin esto, el frontend
  // servido desde otro puerto guardaria los archivos con un nombre generico.
  exposedHeaders: ['Content-Disposition']
}));

// Permite recibir informacion en formato JSON desde el frontend o Postman
app.use(express.json());

// --- Frontend ---
//
// El backend publica tambien las pantallas, de modo que toda la aplicacion
// queda en una sola direccion (http://localhost:3000) y no hace falta un
// segundo servidor. Importa para el RF-03: el enlace del correo de
// recuperacion apunta a este mismo origen.
//
// Va antes de las rutas de la API, pero no las tapa: estas viven bajo /api,
// y ahi no hay archivos que servir.
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Endpoint de comprobacion: verifica que la API esta en funcionamiento
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'QR Empresarial API is running'
  });
});

// Rutas de cada modulo
app.use('/api/auth', authRoutes);          // publicas, salvo el cierre de sesion
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/perfiles', perfilRoutes);   // RF-04: perfil empresarial
app.use('/api/contenido', contenidoRoutes); // RF-05 y RF-06: contenido
app.use('/api/qr', qrRoutes);              // RF-07 y RF-08: codigo QR

// Cualquier otra ruta /api/... no existe: se responde en JSON, no con el
// HTML que Express devuelve por defecto, porque quien llama espera JSON.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Recurso no encontrado' });
});

// Middleware global de errores: siempre despues de las rutas
app.use(errorHandler);

module.exports = app;
