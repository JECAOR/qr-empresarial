// ============================================
// TESTS/SETUP/POR-ARCHIVO.JS — se ejecuta en cada archivo de pruebas
// ============================================

const pool = require('../../src/config/database');
const { reiniciarContadores } = require('../../src/middlewares/limite.middleware');

beforeEach(async () => {
  // El limite del RN-03 cuenta por IP, y en las pruebas todas las peticiones
  // salen de la misma. Sin vaciarlo, las que comprueban un 401 gastarian el
  // cupo de las siguientes y la suite fallaria segun el orden en que corre.
  // Su propia prueba lo vacia primero y luego agota los cinco intentos a
  // proposito, asi que la regla se sigue comprobando.
  await reiniciarContadores();

  global.__correosEnviados.length = 0;
});

afterAll(async () => {
  await pool.end();
});

// La aplicacion escribe bastante en consola: el enlace de recuperacion, los
// avisos del limitador, los intentos de login rechazados. Son utiles
// ejecutandola, y aqui tapan el informe de las pruebas. Se silencian los
// informativos y se deja pasar console.error, que si avisa de algo roto.
const log = console.log;
const warn = console.warn;

beforeAll(() => {
  console.log = () => {};
  console.warn = () => {};
});

afterAll(() => {
  console.log = log;
  console.warn = warn;
});
