// ============================================
// TESTS/SETUP/GLOBAL-TEARDOWN.JS
//
// La base de pruebas se deja en pie a proposito: si una prueba falla, poder
// mirar las filas que quedaron es la forma mas rapida de entender por que.
// La siguiente ejecucion la recrea desde cero, asi que no se acumula nada.
// ============================================

module.exports = async function cerrar() {
  // El pool de la aplicacion se cierra en por-archivo.js, que es donde se
  // sabe si llego a abrirse
};
