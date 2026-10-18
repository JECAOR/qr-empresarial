// ============================================
// JEST.CONFIG.JS — pruebas automaticas de la API
//
// Son pruebas de integracion: levantan la aplicacion de Express con
// supertest y hablan con una base MySQL de verdad. No se simulan ni el
// servidor ni la base, porque casi todo lo que puede salir mal en esta API
// esta justo ahi: una consulta mal escrita, una restriccion del esquema, un
// middleware en el orden equivocado. Lo unico simulado es el envio de
// correo, que si saldria a la red.
// ============================================

module.exports = {
  testEnvironment: 'node',

  // Se corre en serie: todas las pruebas comparten una sola base de datos, y
  // en paralelo se pisarian entre ellas
  maxWorkers: 1,

  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',

  // ANTES de cargar la aplicacion: cambia la base y simula el correo
  setupFiles: ['<rootDir>/tests/setup/entorno.js'],

  // DESPUES de cargarla: lo que necesita el framework ya en marcha
  setupFilesAfterEnv: ['<rootDir>/tests/setup/por-archivo.js'],

  testMatch: ['<rootDir>/tests/**/*.test.js'],

  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],

  testTimeout: 15000
};
