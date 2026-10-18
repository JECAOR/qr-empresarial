// ============================================
// QR.JS — código QR del perfil (RF-07 y RF-08)
//
// El código lo registra el servidor: hay uno por perfil y su dirección no
// cambia aunque el negocio se renombre, porque un código ya impreso tiene que
// seguir llevando al mismo sitio.
//
// La vista previa se dibuja aquí con qrcode.min.js, que es instantáneo y
// permite ver el color y el tamaño al momento. La descarga, en cambio, la
// genera el servidor: así el archivo sale igual en cualquier equipo y el PDF
// es un PDF de verdad, no una vista de impresión.
// ============================================

const BIZ = getBusinessData();

// Se rellena con lo que responda el servidor. Mientras llega se usa la
// dirección que se puede deducir del perfil en caché, para no dibujar vacío.
let QR_URL = getQrUrl(BIZ);
let qrRegistrado = null;

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

// --- Descargar (RF-08) ---
//
// Los tres formatos los genera el servidor. Antes el PDF era un apaño: se
// abría una vista de impresión y se dejaba que la persona eligiera "Guardar
// como PDF" en el diálogo del navegador. Eso no es descargar un PDF, y en
// algunos navegadores no hay esa opción.
document.getElementById("download-btn").addEventListener("click", async () => {
  const boton = document.getElementById("download-btn");
  const etiqueta = document.getElementById("download-label");
  const formato = FORMATS[state.format].toLowerCase();

  if (!qrRegistrado) {
    showToast("Todavía no hay un código QR generado");
    return;
  }

  const textoOriginal = etiqueta.textContent;
  boton.disabled = true;
  etiqueta.textContent = "Generando...";

  try {
    const { blob, nombre } = await descargarImagenQr({
      formato,
      tamano: state.size,
      color: QR_COLORS[state.color].hex
    });

    const url = URL.createObjectURL(blob);
    triggerDownload(url, nombre);

    // El objeto queda en memoria hasta que se suelta
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    showToast(`Descargando ${FORMATS[state.format]}...`);
  } catch (error) {
    showToast(error.message);
  } finally {
    boton.disabled = false;
    etiqueta.textContent = textoOriginal;
  }
});

// --- Compartir por WhatsApp / correo (enlaces reales, igual que public.html) ---
function renderShareLinks() {
  document.getElementById("share-whatsapp").href =
    `https://wa.me/?text=${encodeURIComponent(QR_URL)}`;
  document.getElementById("share-email").href =
    `mailto:?subject=${encodeURIComponent("Nuestro perfil QR")}&body=${encodeURIComponent(QR_URL)}`;
}

// Instagram no admite compartir una dirección por enlace, así que lo que
// sirve de verdad es copiarla para pegarla en la biografía.
document.getElementById("share-instagram").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(QR_URL);
    showToast("Enlace copiado para tu biografía de Instagram");
  } catch {
    showToast("No se pudo copiar el enlace");
  }
});

// --- Publicar o retirar la página (RF-07 y RF-09) ---

const dialogoQr = document.getElementById("qr-confirmar");

let accionPendiente = null;

/**
 * Pinta el estado del código y el botón que lo cambia.
 *
 * La etiqueta de la tarjeta decía "En línea" pasara lo que pasara. Ahora
 * dice lo que responde el servidor, que es lo único que decide si la vista
 * pública contesta.
 */
function pintarVisibilidad() {
  const etiqueta = document.getElementById("qr-estado");
  const texto = document.getElementById("qr-visibilidad-texto");
  const boton = document.getElementById("qr-visibilidad-btn");

  if (!qrRegistrado) {
    etiqueta.hidden = true;
    texto.textContent = "Todavía no has generado tu código.";
    boton.hidden = true;
    return;
  }

  const publicada = qrRegistrado.activo;

  etiqueta.hidden = false;
  etiqueta.textContent = publicada ? "● Publicada" : "● Retirada";
  etiqueta.className = publicada ? "pill-online" : "pill-offline";

  texto.textContent = publicada
    ? "Tu página responde a quien escanee el código."
    : "Tu página no responde. Quien escanee el código no encontrará nada hasta que la publiques de nuevo.";

  boton.hidden = false;
  boton.textContent = publicada ? "Retirar mi página" : "Publicar mi página";
}

document.getElementById("qr-visibilidad-btn").addEventListener("click", () => {
  const retirar = qrRegistrado && qrRegistrado.activo;

  document.getElementById("qr-confirmar-titulo").textContent =
    retirar ? "Retirar tu página" : "Publicar tu página";

  document.getElementById("qr-confirmar-texto").textContent = retirar
    ? "Los códigos que ya repartiste o imprimiste dejarán de llevar a ninguna parte. El código no se borra: puedes volver a publicarlo cuando quieras y seguirá siendo el mismo."
    : "Tu página volverá a responder y los códigos que ya repartiste funcionarán otra vez.";

  document.getElementById("qr-confirmar-aceptar").textContent =
    retirar ? "Retirar" : "Publicar";

  accionPendiente = !retirar;

  dialogoQr.showModal();
});

document.getElementById("qr-confirmar-cancelar").addEventListener("click", () => {
  accionPendiente = null;
  dialogoQr.close();
});

document.getElementById("qr-confirmar-aceptar").addEventListener("click", async () => {
  const activo = accionPendiente;

  accionPendiente = null;
  dialogoQr.close();

  if (activo === null) return;

  try {
    qrRegistrado = (await Api.cambiarEstadoQr(activo)).data;

    pintarVisibilidad();
    showToast(activo ? "Tu página está publicada" : "Tu página quedó retirada");
  } catch (error) {
    // 409: el perfil no tiene contenido activo, así que publicarlo llevaría
    // a una página en blanco. El mensaje del servidor ya lo explica.
    showToast(error.message);
  }
});

function renderUrlChips() {
  const displayUrl = QR_URL.replace(/^https?:\/\//, "");
  document.getElementById("qr-chip-url").textContent = displayUrl;
  document.getElementById("qr-link-row-url").textContent = displayUrl;
}

/**
 * Pide el código al servidor y, si el perfil no lo tiene, lo genera (RF-07).
 *
 * Generarlo es idempotente: si ya existía, el servidor devuelve el mismo sin
 * cambiar su dirección. Por eso se puede llamar sin preguntar antes.
 */
async function cargarQr() {
  try {
    qrRegistrado = (await Api.miQr()).data;
  } catch (error) {
    if (error.status !== 404) {
      showToast(error.message);
      return;
    }

    // Todavía no existe: se genera
    try {
      qrRegistrado = (await Api.generarMiQr()).data;
    } catch (fallo) {
      // 409: el perfil no tiene contenido activo. 404: no hay perfil.
      showToast(fallo.message);
      return;
    }
  }

  QR_URL = qrRegistrado.url;

  renderUrlChips();
  renderShareLinks();
  pintarVisibilidad();
  drawQR();
}

renderUrlChips();
renderShareLinks();
renderFormatButtons();

cargarQr();
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
