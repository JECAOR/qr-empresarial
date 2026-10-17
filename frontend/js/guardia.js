// ============================================
// GUARDIA.JS — protege las pantallas privadas
// Se carga después de api.js en el dashboard, contenido, código QR y
// configuración. Las pantallas públicas (login, registro, vista pública,
// menú) no lo usan.
//
// Son dos comprobaciones, y cada una resuelve un caso distinto:
//
//   1. Sin token guardado, se sale de inmediato. Es instantáneo, así que
//      quien no inició sesión no alcanza a ver la pantalla.
//   2. Con token, se pregunta al servidor. Hace falta porque el navegador
//      no se enteró si la cuenta fue restringida, si se cerró la sesión
//      desde otro dispositivo o si el token venció: para eso hay que
//      preguntar, y eso toma un momento.
// ============================================

if (!Sesion.token()) {
  redirigirALogin();
}

(async () => {
  const usuario = await protegerPantalla();

  // null significa que la sesión no sirve y ya se está redirigiendo
  if (!usuario) return;

  // La barra lateral se dibujó con lo que había guardado; ahora que llegó
  // el dato confirmado del servidor, se vuelve a dibujar. El nombre o el
  // rol pueden haber cambiado desde el último inicio de sesión.
  if (typeof renderSidebar === "function") renderSidebar();
})();
