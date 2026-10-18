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
const publicoRoutes = require('./modules/publico/publico.routes');
const { paginaPublica } = require('./modules/publico/publico.metadatos');
const estadisticaRoutes = require('./modules/estadisticas/estadistica.routes');
const adminRoutes = require('./modules/admin/admin.routes');
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

// --- Vista publica (RF-09) ---
//
// Es la direccion que llevan codificada los codigos QR. No es un archivo, asi
// que express.static no la encuentra: se responde con la pantalla publica, y
// es su JavaScript el que pide los datos del negocio a /api/publico/:slug.
//
// El slug no se toca aqui. Se entrega siempre la misma pantalla, exista el
// perfil o no, y es la pantalla la que muestra el aviso si no hay nada: asi
// esta ruta no revela que slugs estan registrados.
app.get('/p/:slug', async (req, res, next) => {
  const archivo = path.join(__dirname, '..', '..', 'frontend', 'public.html');

  try {
    // Las etiquetas de vista previa se arman aqui con los datos del negocio.
    // No se puede dejar al navegador: los robots que las leen -WhatsApp,
    // Telegram, Google- no ejecutan JavaScript.
    const origen = `${req.protocol}://${req.get('host')}`;
    const html = await paginaPublica(req.params.slug, archivo, origen);

    res.type('html').send(html);
  } catch (error) {
    // Si algo falla armando las etiquetas, es preferible entregar la
    // pantalla tal cual que dejar sin nada a quien escaneo el codigo
    console.error('No se pudieron generar los metadatos publicos:', error.message);

    res.sendFile(archivo);
  }
});

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
app.use('/api/publico', publicoRoutes);    // RF-09: vista publica, sin token
app.use('/api/estadisticas', estadisticaRoutes); // RF-11: estadisticas
app.use('/api/admin', adminRoutes);        // RF-13 y RF-15: administracion

// Cualquier otra ruta /api/... no existe: se responde en JSON, no con el
// HTML que Express devuelve por defecto, porque quien llama espera JSON.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Recurso no encontrado' });
});

// Middleware global de errores: siempre despues de las rutas
app.use(errorHandler);

module.exports = app;
