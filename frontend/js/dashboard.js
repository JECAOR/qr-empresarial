// ============================================
// DASHBOARD.JS — gráficas reales con Chart.js
// ============================================

const WEEK = [
  { d: "Lun", s: 124, c: 82 },
  { d: "Mar", s: 193, c: 141 },
  { d: "Mié", s: 157, c: 104 },
  { d: "Jue", s: 238, c: 178 },
  { d: "Vie", s: 291, c: 204 },
  { d: "Sáb", s: 210, c: 155 },
  { d: "Dom", s: 176, c: 122 },
];

const KPIS = [
  { label: "Escaneos totales", val: "2,847", delta: "+18%", spark: [80, 110, 95, 140, 160, 130, 176], color: "var(--color-primary)", bg: "var(--color-primary-light)" },
  { label: "Visitantes únicos", val: "1,932", delta: "+12%", spark: [60, 80, 70, 110, 130, 100, 122], color: "#047c57", bg: "#D1FAE5" },
  { label: "Clics en enlaces", val: "1,284", delta: "+7%", spark: [50, 70, 55, 90, 100, 85, 95], color: "#7d52dd", bg: "rgba(139,92,246,.10)" },
  { label: "Tasa de conversión", val: "45.1%", delta: "+2pp", spark: [38, 42, 40, 46, 48, 44, 45], color: "#a75b04", bg: "#FEF3C7" },
];

function cssVar(name) {
  const v = name.startsWith("var(") ? name.slice(4, -1) : name;
  return getComputedStyle(document.body).getPropertyValue(v).trim() || name;
}

// --- Tarjetas KPI con mini-gráficas (sparklines) reales ---
function renderKPIs() {
  const grid = document.getElementById("kpi-grid");
  grid.innerHTML = KPIS.map(
    (k, i) => `
    <div class="kpi-card">
      <div class="kpi-top-row">
        <div class="kpi-label">${k.label}</div>
        <span class="kpi-pill" style="color:${k.color};background:${k.bg}">${k.delta}</span>
      </div>
      <div class="kpi-value">${k.val}</div>
      <div class="kpi-spark"><canvas id="spark-${i}"></canvas></div>
    </div>`
  ).join("");

  KPIS.forEach((k, i) => {
    new Chart(document.getElementById(`spark-${i}`), {
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
    });
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

  new Chart(ctx, {
    type: "line",
    data: {
      labels: WEEK.map((w) => w.d),
      datasets: [
        {
          label: "Escaneos",
          data: WEEK.map((w) => w.s),
          borderColor: primary,
          backgroundColor: gradPrimary,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: true,
        },
        {
          label: "Clics",
          data: WEEK.map((w) => w.c),
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
  });
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

renderBusinessInfo();
renderKPIs();
renderMainChart();
renderActiveQR();
