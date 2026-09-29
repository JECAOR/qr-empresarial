// ============================================
// QR.JS — generación real de QR (PNG/SVG/PDF),
// color, tamaño y acciones de compartir
// ============================================

const BIZ = getBusinessData();
const QR_URL = getQrUrl(BIZ);

const QR_COLORS = [
  { hex: getCssVar("--color-sidebar-bg"), name: "Oscuro" },
  { hex: getCssVar("--color-primary"), name: "Color de marca" },
  { hex: "#8B5CF6", name: "Violeta" }, // color "complemento" del tema
  { hex: "#059669", name: "Verde" },
  { hex: "#7C3AED", name: "Púrpura" },
];

const FORMATS = ["PNG", "SVG", "PDF"];

// --- Persistencia real en localStorage: el color/tamaño/formato elegidos
// sobreviven a recargar la página, en vez de resetearse cada vez ---
const QR_STATE_KEY = "qre-qr-state";
const QR_STATE_DEFAULTS = { format: 0, color: 1, size: 512 };

function loadQrState() {
  try {
    const stored = localStorage.getItem(QR_STATE_KEY);
    return stored ? { ...QR_STATE_DEFAULTS, ...JSON.parse(stored) } : { ...QR_STATE_DEFAULTS };
  } catch {
    return { ...QR_STATE_DEFAULTS };
  }
}

function saveQrState() {
  localStorage.setItem(QR_STATE_KEY, JSON.stringify(state));
}

let state = loadQrState(); // format / color / size (px, equivalente al slider 256–1024)

function getCssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

// --- Dibuja el QR real en el <canvas> usando la librería qrcode.min.js ---
function drawQR() {
  const canvas = document.getElementById("qr-canvas");
  QRCode.toCanvas(
    canvas,
    QR_URL,
    {
      width: 148, // tamaño de la vista previa; la descarga usa state.size real
      margin: 1,
      color: {
        dark: QR_COLORS[state.color].hex,
        light: "#FFFFFF",
      },
    },
    (err) => {
      if (err) console.error("Error generando el QR:", err);
    }
  );
}

function renderFormatButtons() {
  const wrap = document.getElementById("format-buttons");
  wrap.innerHTML = FORMATS.map(
    (f, i) => `<button class="qr-format-btn ${i === state.format ? "active" : ""}" data-i="${i}">${f}</button>`
  ).join("");
  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.format = Number(btn.dataset.i);
      saveQrState();
      renderFormatButtons();
      document.getElementById("download-label").textContent = `Descargar ${FORMATS[state.format]}`;
    });
  });
}

function renderColorButtons() {
  const wrap = document.getElementById("color-buttons");
  wrap.innerHTML = QR_COLORS.map(
    (c, i) =>
      `<button class="qr-color-dot ${i === state.color ? "active" : ""}" style="background:${c.hex};--dot-color:${c.hex}" data-i="${i}" aria-label="Color del QR: ${c.name}" aria-pressed="${i === state.color}"></button>`
  ).join("");
  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.color = Number(btn.dataset.i);
      saveQrState();
      renderColorButtons();
      drawQR();
    });
  });
}

// --- Tamaño ---
const sizeSlider = document.getElementById("size-slider");
const sizeValue = document.getElementById("size-value");
sizeSlider.addEventListener("input", () => {
  state.size = Number(sizeSlider.value);
  sizeValue.textContent = `${state.size} × ${state.size} px`;
  saveQrState();
});

// --- Toast (confirmación visual, sin usar alert()) ---
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
}

// --- Compartir (Web Share API nativa, con respaldo si el navegador no la soporta) ---
document.getElementById("share-btn").addEventListener("click", async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Fonda La Cosecha",
        text: "Escanea mi código QR para ver el menú y más",
        url: QR_URL,
      });
    } catch (err) {
      // El usuario canceló el cuadro de compartir — no es un error real, no hacer nada.
    }
  } else {
    // Navegadores de escritorio sin Web Share API: se copia el enlace como respaldo.
    await navigator.clipboard.writeText(QR_URL);
    showToast("Tu navegador no soporta compartir directo — enlace copiado");
  }
});

// --- Copiar enlace ---
document.getElementById("copy-link-btn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(QR_URL);
    showToast("Enlace copiado");
  } catch {
    showToast("No se pudo copiar el enlace");
  }
});

// --- Descargar (real, según formato elegido) ---
document.getElementById("download-btn").addEventListener("click", async () => {
  const color = QR_COLORS[state.color].hex;
  const format = FORMATS[state.format];

  if (format === "PNG") {
    const dataUrl = await QRCode.toDataURL(QR_URL, {
      width: state.size,
      margin: 2,
      color: { dark: color, light: "#FFFFFF" },
    });
    triggerDownload(dataUrl, `qr-${slugify(BIZ.name)}.png`);
  }

  if (format === "SVG") {
    const svgString = await QRCode.toString(QR_URL, {
      type: "svg",
      width: state.size,
      margin: 2,
      color: { dark: color, light: "#FFFFFF" },
    });
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    triggerDownload(URL.createObjectURL(blob), `qr-${slugify(BIZ.name)}.svg`);
  }

  if (format === "PDF") {
    // Sin librería de PDF: se abre una vista de impresión con el QR
    // a tamaño completo, y el usuario elige "Guardar como PDF" desde
    // el diálogo de impresión del propio navegador.
    const dataUrl = await QRCode.toDataURL(QR_URL, {
      width: state.size,
      margin: 2,
      color: { dark: color, light: "#FFFFFF" },
    });
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head><title>QR — Fonda La Cosecha</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <img src="${dataUrl}" style="width:60vw;max-width:500px;" onload="window.print()">
        </body>
      </html>
    `);
  }

  showToast(`Descargando ${format}…`);
});

// --- Compartir por WhatsApp / correo (enlaces reales, igual que public.html) ---
document.getElementById("share-whatsapp").href = `https://wa.me/?text=${encodeURIComponent(QR_URL)}`;
document.getElementById("share-email").href = `mailto:?subject=${encodeURIComponent("Nuestro perfil QR")}&body=${encodeURIComponent(QR_URL)}`;

function renderUrlChips() {
  const displayUrl = QR_URL.replace("https://", "");
  document.getElementById("qr-chip-url").textContent = displayUrl;
  document.getElementById("qr-link-row-url").textContent = displayUrl;
}

renderUrlChips();
renderFormatButtons();
renderColorButtons();
drawQR();

// Sincroniza la posición del control deslizante y el texto con lo que
// ya estaba guardado (si no, se vería en 512px aunque el estado real
// cargado sea otro tamaño).
sizeSlider.value = state.size;
sizeValue.textContent = `${state.size} × ${state.size} px`;
document.getElementById("download-label").textContent = `Descargar ${FORMATS[state.format]}`;

function triggerDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
