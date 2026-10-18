// ============================================
// THEME.JS — elegir entre 3 temas (Índigo, Esmeralda, Terracota).
//
// Es el color de marca del negocio, no una preferencia de quien mira: por eso
// se guarda en el perfil empresarial (RF-12) y la vista pública lo aplica,
// de modo que quien escanea el código ve los colores que eligió el negocio.
//
// localStorage queda como caché. Hace falta porque el tema se aplica antes de
// pintar la página: esperar una petición dejaría ver un parpadeo de colores
// al cargar cada pantalla.
// ============================================

const THEME_KEY = "qre-theme"; // valores: "indigo" | "teal" | "terracota"
const THEMES_LIST = [
  { id: "indigo", label: "Índigo", color: "#4F46E5" },
  { id: "teal", label: "Esmeralda", color: "#0D9488" },
  { id: "terracota", label: "Terracota", color: "#C2410C" },
];

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || "indigo";
}

function applyStoredTheme() {
  const theme = getStoredTheme();
  if (theme === "indigo") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

/**
 * Cambia el tema y lo guarda (RF-12).
 *
 * El tema es del negocio, no de quien lo mira: la vista pública lo aplica
 * para que quien escanea el código vea los colores de marca. Por eso se
 * guarda en el perfil empresarial y no en una tabla de preferencias.
 *
 * localStorage queda como caché, y hace falta: el tema se aplica antes de
 * pintar la página, y esperar una petición dejaría ver un parpadeo de
 * colores al cargar cada pantalla.
 *
 * @param {string} themeId
 */
function setTheme(themeId) {
  localStorage.setItem(THEME_KEY, themeId);

  // Solo en el panel: las pantallas públicas no cargan api.js ni tienen
  // sesión con la que guardar nada.
  if (typeof Api !== "undefined" && typeof Sesion !== "undefined" && Sesion.token()) {
    guardarTemaEnElPerfil(themeId);
    return;
  }

  recargarParaRepintar();
}

/**
 * Guarda el tema en el perfil y después recarga.
 *
 * Se envía el perfil completo porque el PUT reemplaza el recurso; los demás
 * campos salen de la caché, que la guardia mantiene al día.
 */
async function guardarTemaEnElPerfil(themeId) {
  try {
    const datos = datosLocalesAPerfilApi(getBusinessData());

    await Api.guardarMiPerfilEmpresarial({ ...datos, tema: themeId });
  } catch (error) {
    // El color ya está aplicado en este navegador; si no se pudo guardar,
    // se avisa y al recargar desde otro equipo volverá el anterior
    console.warn("No se pudo guardar el tema en el perfil:", error.message);
  }

  recargarParaRepintar();
}

/**
 * Se recarga la página: así los elementos ya dibujados en <canvas> (el código
 * QR y las gráficas de Chart.js) se generan de nuevo con el color correcto,
 * en vez de quedar a medio actualizar.
 */
function recargarParaRepintar() {
  location.reload();
}

// Aplica el tema apenas carga este script (antes de pintar el body).
applyStoredTheme();
