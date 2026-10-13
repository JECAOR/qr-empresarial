// ============================================
// APP.JS — configuracion de la aplicacion Express
// Define los middlewares y las rutas, pero NO pone el servidor a escuchar:
// de eso se encarga server.js. Esta separacion permite probar la aplicacion
// sin ocupar el puerto.
// ============================================

const express = require('express');

const authRoutes = require('./modules/auth/auth.routes');
const usuarioRoutes = require('./modules/usuarios/usuario.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Permite recibir informacion en formato JSON desde el frontend o Postman
app.use(express.json());

// Endpoint de comprobacion: verifica que la API esta en funcionamiento
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'QR Empresarial API is running'
  });
});

// Rutas de cada modulo
app.use('/api/auth', authRoutes);          // publicas: login y registro
app.use('/api/usuarios', usuarioRoutes);

// Middleware global de errores: siempre despues de las rutas
app.use(errorHandler);

module.exports = app;
