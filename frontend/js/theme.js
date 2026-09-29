// ============================================
// THEME.JS — elegir entre 3 temas (Índigo, Esmeralda,
// Terracota). Persiste en localStorage para que se
// mantenga en todas las páginas del sitio (incluida
// la página pública, ya que es el color de marca del
// negocio, no una preferencia personal del visitante).
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

function setTheme(themeId) {
  localStorage.setItem(THEME_KEY, themeId);
  // Se recarga la página: así los elementos ya dibujados en <canvas>
  // (el código QR y las gráficas de Chart.js) se generan de nuevo
  // con el color correcto, en vez de quedar a medio actualizar.
  location.reload();
}

// Aplica el tema apenas carga este script (antes de pintar el body).
applyStoredTheme();
