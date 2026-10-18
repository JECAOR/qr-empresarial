// ============================================
// TESTS/SETUP/ENTORNO.JS — se ejecuta ANTES de cargar la aplicacion
//
// Jest lo corre como `setupFiles`, es decir antes de que el archivo de
// pruebas haga sus require. Eso importa: config/database.js lee
// process.env.DB_NAME en el momento en que se carga, asi que si la variable
// se cambiara mas tarde el pool ya estaria apuntando a la base de desarrollo.
// ============================================

const path = require('node:path');

require('dotenv').config({ quiet: true, path: path.join(__dirname, '..', '..', '.env') });

// Las pruebas escriben, borran y vacian tablas. Van a su propia base, que
// global-setup.js crea desde cero en cada ejecucion.
process.env.DB_NAME = require('./base-de-pruebas').NOMBRE;

process.env.NODE_ENV = 'test';

// Las pruebas no deben mandar correo de verdad. El unico que el sistema
// envia es el enlace de recuperacion, y su .env puede traer un SMTP real:
// sin esto, cada ejecucion de la suite mandaria mensajes a direcciones
// inventadas desde la cuenta del proyecto.
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: async (mensaje) => {
      // Se guarda para que una prueba pueda comprobar que se envio, y a
      // quien, sin que salga nada a la red
      global.__correosEnviados.push(mensaje);
      return { messageId: 'prueba', envelope: { to: [mensaje.to] } };
    },
    verify: async () => true
  }),
  createTestAccount: async () => ({ user: 'prueba', pass: 'prueba', smtp: {} }),
  getTestMessageUrl: () => null
}));

global.__correosEnviados = [];
