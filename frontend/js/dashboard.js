// ============================================
// DASHBOARD.JS — estadísticas reales con Chart.js (RF-11)
//
// Las cifras venían escritas a mano en este archivo: 2.847 escaneos, 1.932
// visitantes, una gráfica con la semana inventada. Ahora salen de
// GET /api/estadisticas, que cuenta los eventos que informa la vista pública.
//
// Una de las tarjetas decía "Visitantes únicos", y eso no se puede saber con
// lo que se guarda: la tabla de eventos no identifica a quien visita, a
// propósito. El RF-11 pide "visitas al perfil", que es lo que ahora muestra.
// ============================================

// Las gráficas se guardan para poder destruirlas antes de volver a
// dibujarlas: Chart.js no admite dos sobre el mismo <canvas>.
let graficas = [];

// Mientras llega la respuesta, la semana se dibuja en cero: así la pantalla
// no salta de unos números a otros, y nunca muestra cifras que no son.
const SERIE_VACIA = [
  { etiqueta: "", escaneos: 0, visitas: 0, clics: 0 }
];

let estadisticas = {
  totales: { escaneos: 0, visitas: 0, clics: 0, conversion: 0 },
  serie: SERIE_VACIA,
  enlacesMasPulsados: []
};

/** Las cuatro tarjetas, en el orden en que las muestra la pantalla. */
function tarjetas() {
  const t = estadisticas.totales;
  const serie = estadisticas.serie;

  return [
    { label: "Escaneos del QR", val: t.escaneos, spark: serie.map((d) => d.escaneos),
      color: "var(--color-primary)", bg: "var(--color-primary-light)" },
    { label: "Visitas al perfil", val: t.visitas, spark: serie.map((d) => d.visitas),
      color: "#047c57", bg: "#D1FAE5" },
    { label: "Clics en enlaces", val: t.clics, spark: serie.map((d) => d.clics),
      color: "#7d52dd", bg: "rgba(139,92,246,.10)" },
    { label: "Tasa de conversión", val: `${t.conversion}%`, spark: serie.map((d) => d.clics),
      color: "#a75b04", bg: "#FEF3C7" }
  ];
}

/** Miles con separador, como se leen en Colombia. */
function formatear(valor) {
  return typeof valor === "number" ? valor.toLocaleString("es-CO") : valor;
}

function cssVar(name) {
  const v = name.startsWith("var(") ? name.slice(4, -1) : name;
  return getComputedStyle(document.body).getPropertyValue(v).trim() || name;
}

// --- Tarjetas KPI con mini-gráficas (sparklines) reales ---
function renderKPIs() {
  const grid = document.getElementById("kpi-grid");
  const datos = tarjetas();

  // La "pill" mostraba una variación inventada (+18%, +12%...). Para
  // calcularla de verdad habría que comparar con el periodo anterior, que el
  // endpoint todavía no devuelve; se muestra el rango en su lugar, que sí es
  // información cierta.
  const rango = `${estadisticas.dias || 7} días`;

  grid.innerHTML = datos.map(
    (k, i) => `
    <div class="kpi-card">
      <div class="kpi-top-row">
        <div class="kpi-label">${k.label}</div>
        <span class="kpi-pill" style="color:${k.color};background:${k.bg}">${rango}</span>
      </div>
      <div class="kpi-value">${formatear(k.val)}</div>
      <div class="kpi-spark"><canvas id="spark-${i}"></canvas></div>
    </div>`
  ).join("");

  datos.forEach((k, i) => {
    graficas.push(new Chart(document.getElementById(`spark-${i}`), {
      type: "line",
      data: {
        labels: k.spark.map((_, idx) => idx),
        datasets: [{
          data: k.spark,
          borderColor: cssVar(k.color),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: { x: { display: false }, y: { display: false } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    }));
  });
}

// --- Gráfica principal: escaneos vs clics, últimos 7 días ---
function renderMainChart() {
  const ctx = document.getElementById("main-chart");
  const primary = cssVar("var(--color-primary)");
  const complement = "#8B5CF6";

  const gradPrimary = ctx.getContext("2d").createLinearGradient(0, 0, 0, 260);
  gradPrimary.addColorStop(0, hexToRgba(primary, 0.18));
  gradPrimary.addColorStop(1, hexToRgba(primary, 0));

  const gradComplement = ctx.getContext("2d").createLinearGradient(0, 0, 0, 260);
  gradComplement.addColorStop(0, hexToRgba(complement, 0.15));
  gradComplement.addColorStop(1, hexToRgba(complement, 0));

  graficas.push(new Chart(ctx, {
    type: "line",
    data: {
      labels: estadisticas.serie.map((d) => d.etiqueta),
      datasets: [
        {
          label: "Escaneos",
          data: estadisticas.serie.map((d) => d.escaneos),
          borderColor: primary,
          backgroundColor: gradPrimary,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: true,
        },
        {
          label: "Clics",
          data: estadisticas.serie.map((d) => d.clics),
          borderColor: complement,
          backgroundColor: gradComplement,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar("var(--slate-400)"), font: { size: 10 } } },
        y: { grid: { color: cssVar("var(--slate-200)") }, ticks: { color: cssVar("var(--slate-400)"), font: { size: 10 } } },
      },
      plugins: {
        legend: { display: false }, // la leyenda ya está construida en HTML
        tooltip: {
          backgroundColor: cssVar("var(--slate-950)"),
          padding: 10,
          cornerRadius: 8,
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
        },
      },
    },
  }));
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// --- Datos del negocio (nombre, URL del QR) ---
function renderBusinessInfo() {
  const biz = getBusinessData();
  document.getElementById("dash-biz-name").textContent = biz.name;
  document.getElementById("dash-qr-url").textContent = getQrUrl(biz).replace(/^https?:\/\//, "");
}

// --- QR activo (mismo generador real de la Fase 5) ---
function renderActiveQR() {
  const biz = getBusinessData();
  QRCode.toCanvas(document.getElementById("qr-active-canvas"), getQrUrl(biz), {
    width: 104,
    margin: 1,
    color: { dark: cssVar("var(--color-primary)"), light: "#FFFFFF" },
  });
}

document.getElementById("qr-active-download").addEventListener("click", () => {
  window.location.href = "qr.html";
});
document.getElementById("qr-active-share").addEventListener("click", () => {
  window.location.href = "qr.html";
});

/**
 * El saludo del panel.
 *
 * Decía "2.847 escaneos este mes" escrito en el HTML. Ahora cuenta los de
 * verdad, y mientras no haya ninguno no inventa un número: dice que el perfil
 * está activo y se queda ahí.
 */
function renderBanner() {
  const sub = document.getElementById("dash-banner-sub");

  if (!sub) return;

  const escaneos = estadisticas.totales.escaneos;
  const dias = estadisticas.dias || 7;

  if (escaneos === 0) {
    sub.textContent = "Tu perfil está activo";
    return;
  }

  const veces = escaneos === 1 ? "escaneo" : "escaneos";

  sub.innerHTML = `Tu perfil está activo · <strong>${formatear(escaneos)} ${veces}</strong> en los últimos ${dias} días`;
}

function dibujarTodo() {
  graficas.forEach((g) => g.destroy());
  graficas = [];

  renderBanner();
  renderKPIs();
  renderMainChart();
}

/**
 * Trae las estadísticas y redibuja (RF-11).
 *
 * Si falla, la pantalla se queda con los ceros del dibujado inicial: es
 * preferible a mostrar cifras de ejemplo, que es lo que hacía antes.
 */
async function cargarEstadisticas() {
  try {
    const { data } = await Api.misEstadisticas(7);

    estadisticas = data;
    dibujarTodo();
  } catch (error) {
    // 404: la cuenta todavía no tiene perfil, así que no hay nada que contar
    if (error.status !== 404) {
      console.warn("No se pudieron cargar las estadísticas:", error.message);
    }
  }
}

renderBusinessInfo();
dibujarTodo();
renderActiveQR();

cargarEstadisticas();

// Cuando la guardia trae el perfil, el nombre y la URL del QR pueden cambiar
window.addEventListener("perfil:sincronizado", renderBusinessInfo);
