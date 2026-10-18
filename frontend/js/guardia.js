// ============================================
// GUARDIA.JS — protege las pantallas privadas y trae los datos del negocio
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

/**
 * Trae el perfil empresarial del servidor y lo deja en el almacén local
 * (RF-04).
 *
 * Las pantallas leen `getBusinessData()`, que antes solo vivía en el
 * navegador. Ahora el servidor es la fuente de verdad y esto lo sincroniza:
 * así el dashboard, el código QR y la barra lateral no tuvieron que cambiar.
 *
 * Al terminar avisa con un evento, porque las pantallas ya se dibujaron con
 * lo que había en caché y puede que haya cambiado.
 */
async function sincronizarPerfilEmpresarial() {
  try {
    const respuesta = await Api.miPerfilEmpresarial();

    saveBusinessData({
      ...getBusinessData(),
      ...perfilApiADatosLocales(respuesta.data)
    });

    // El tema es del negocio y puede haberse cambiado desde otro equipo
    if (respuesta.data.tema && respuesta.data.tema !== getStoredTheme()) {
      localStorage.setItem("qre-theme", respuesta.data.tema);
      applyStoredTheme();
    }

    window.dispatchEvent(new CustomEvent("perfil:sincronizado"));
  } catch (error) {
    // 404: la cuenta no tiene perfil todavía. Les pasa a las que creó el
    // administrador desde POST /api/usuarios, y a las registradas antes de
    // que el registro lo creara. Se sigue con los datos locales y se creará
    // en cuanto la persona guarde Configuración.
    if (error.status === 404) {
      console.warn("Esta cuenta todavía no tiene perfil empresarial.");
      return;
    }

    // El 401 ya lo manejó peticion(); cualquier otro fallo no debe dejar la
    // pantalla en blanco, así que se trabaja con lo último que se sabe.
    console.warn("No se pudo traer el perfil del negocio:", error.message);
  }
}

(async () => {
  const usuario = await protegerPantalla();

  // null significa que la sesión no sirve y ya se está redirigiendo
  if (!usuario) return;

  // La barra lateral se dibujó con lo que había guardado; ahora que llegó
  // el dato confirmado del servidor, se vuelve a dibujar. El nombre o el
  // rol pueden haber cambiado desde el último inicio de sesión.
  if (typeof renderSidebar === "function") renderSidebar();

  await sincronizarPerfilEmpresarial();
})();
