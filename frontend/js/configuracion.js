// ============================================
// CONFIGURACION.JS
// ============================================

// --- Cargar los datos actuales del negocio en el formulario ---
const businessForm = document.getElementById("business-form");

// --- Selector de tema (accesible también desde el móvil, a diferencia
// del selector del sidebar, que solo existe en el layout de escritorio) ---
function renderThemeOptions() {
  const wrap = document.getElementById("theme-options");
  const actual = getStoredTheme();
  wrap.innerHTML = THEMES_LIST.map(
    (t) => `
    <button type="button" class="theme-option ${t.id === actual ? "active" : ""}" data-theme-id="${t.id}" style="color:${t.color}">
      <span class="theme-option-dot" style="background:${t.color}"></span>
      <span class="theme-option-label">${t.label}</span>
    </button>`
  ).join("");

  wrap.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeId));
  });
}
renderThemeOptions();

function loadBusinessForm() {
  const biz = getBusinessData();
  document.getElementById("biz-name").value = biz.name;
  document.getElementById("biz-category").value = biz.category;
  document.getElementById("biz-desc").value = biz.description;
  document.getElementById("biz-address").value = biz.address;
  document.getElementById("biz-phone").value = biz.phone;
  document.getElementById("biz-email").value = biz.email;
  document.getElementById("biz-instagram").value = biz.instagram;
  document.getElementById("biz-hours").value = biz.hours;
}
loadBusinessForm();

// --- Guardar información del negocio (localStorage — persiste de verdad) ---
businessForm.addEventListener("submit", (e) => {
  e.preventDefault();

  saveBusinessData({
    name: document.getElementById("biz-name").value.trim(),
    category: document.getElementById("biz-category").value.trim(),
    description: document.getElementById("biz-desc").value.trim(),
    address: document.getElementById("biz-address").value.trim(),
    phone: document.getElementById("biz-phone").value.trim(),
    email: document.getElementById("biz-email").value.trim(),
    instagram: document.getElementById("biz-instagram").value.trim(),
    hours: document.getElementById("biz-hours").value.trim(),
    // La calificación y las reseñas no las edita el dueño directamente
    // (vendrían de reseñas reales de clientes), se conservan tal cual.
    rating: getBusinessData().rating,
    reviews: getBusinessData().reviews,
  });

  showSavedToast("business-saved-toast");
  // El sidebar de esta misma página también refleja el cambio al instante.
  renderSidebar();
  // Aquí, más adelante, esto también se enviará a un backend real (fase de base de datos).
});

// --- Sesión (RF-02) ---
//
// La barra lateral tiene su propio botón de salida, pero desaparece en
// pantallas angostas: ahí la navegación inferior la reemplaza y no incluye
// uno. Este es el único cierre de sesión al alcance desde un teléfono.
function prepararCierreDeSesion() {
  const correo = document.getElementById("session-email");
  const boton = document.getElementById("btn-logout");

  if (!correo || !boton) return;

  const cuenta = typeof Sesion !== "undefined" ? Sesion.usuario() : null;
  correo.textContent = cuenta && cuenta.correo ? cuenta.correo : "—";

  boton.addEventListener("click", () => {
    if (typeof cerrarSesionYSalir === "function") {
      cerrarSesionYSalir();
    } else {
      window.location.href = "login.html";
    }
  });
}

prepararCierreDeSesion();

function showSavedToast(id) {
  const toast = document.getElementById(id);
  toast.textContent = "✓ Cambios guardados";
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

// --- Notificaciones (persistidas de verdad en localStorage) ---
const NOTIF_KEY = "qre-notifications";
const NOTIF_DEFAULTS = { weekly: true, reviews: true, updates: false };

function getNotifPrefs() {
  try {
    const stored = localStorage.getItem(NOTIF_KEY);
    return stored ? { ...NOTIF_DEFAULTS, ...JSON.parse(stored) } : { ...NOTIF_DEFAULTS };
  } catch {
    return { ...NOTIF_DEFAULTS };
  }
}

function saveNotifPrefs(prefs) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
}

// Al cargar la página, cada interruptor refleja lo que ya estaba guardado
// (en vez de siempre arrancar en su valor "de fábrica" del HTML).
function loadNotifToggles() {
  const prefs = getNotifPrefs();
  document.querySelectorAll(".settings-notif-toggle").forEach((toggle) => {
    const key = toggle.dataset.notifKey;
    const isOn = prefs[key];
    toggle.classList.toggle("on", isOn);
    toggle.setAttribute("aria-pressed", String(isOn));
    const base = toggle.getAttribute("aria-label").replace(/^(Activar|Desactivar)/, "");
    toggle.setAttribute("aria-label", (isOn ? "Desactivar" : "Activar") + base);
  });
}
loadNotifToggles();

document.querySelectorAll(".settings-notif-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const isOn = toggle.classList.toggle("on");
    toggle.setAttribute("aria-pressed", String(isOn));
    const label = toggle.getAttribute("aria-label").replace(/^(Activar|Desactivar)/, isOn ? "Desactivar" : "Activar");
    toggle.setAttribute("aria-label", label);

    const prefs = getNotifPrefs();
    prefs[toggle.dataset.notifKey] = isOn;
    saveNotifPrefs(prefs);
  });
});

// --- Cambiar contraseña (con el mismo medidor de fuerza del registro) ---
const passwordForm = document.getElementById("password-form");
const newPassInput = document.getElementById("new-password");
const strengthBar = document.getElementById("settings-strength-bar");
const strengthLabel = document.getElementById("settings-strength-label");

function evaluarFuerza(pass) {
  let score = 0;
  if (pass.length >= 8) score++;
  if (pass.length >= 12) score++;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
  if (/\d/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  if (pass.length === 0) return { level: 0, label: "", color: "" };
  if (score <= 1) return { level: 1, label: "Débil", color: "#EF4444" };
  if (score <= 3) return { level: 2, label: "Media", color: "#F59E0B" };
  return { level: 3, label: "Fuerte", color: "#059669" };
}

newPassInput.addEventListener("input", () => {
  const { level, label, color } = evaluarFuerza(newPassInput.value);
  strengthBar.style.width = `${(level / 3) * 100}%`;
  strengthBar.style.background = color;
  strengthLabel.textContent = label;
  strengthLabel.style.color = color;
});

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const currentPass = document.getElementById("current-password");
  const newPass = document.getElementById("new-password");
  const confirmPass = document.getElementById("confirm-new-password");
  const currentField = currentPass.closest(".form-field");
  const confirmField = confirmPass.closest(".form-field");
  const newPassField = newPass.closest(".form-field");

  let valido = true;

  if (!currentPass.value) {
    currentField.classList.add("has-error");
    valido = false;
  } else {
    currentField.classList.remove("has-error");
  }

  const fuerza = evaluarFuerza(newPass.value);
  if (fuerza.level < 2) {
    newPassField.classList.add("has-error");
    valido = false;
  } else {
    newPassField.classList.remove("has-error");
  }

  if (newPass.value !== confirmPass.value) {
    confirmField.classList.add("has-error");
    valido = false;
  } else {
    confirmField.classList.remove("has-error");
  }

  if (!valido) return;

  const boton = passwordForm.querySelector('button[type="submit"]');
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  boton.textContent = "Actualizando...";

  try {
    const respuesta = await Api.cambiarContrasena(currentPass.value, newPass.value);

    // El cambio cerro todas las sesiones de la cuenta, incluida esta: hay que
    // guardar el token nuevo o la siguiente peticion recibiria un 401.
    reemplazarToken(respuesta.data.token);

    mostrarMensajeContrasena("✓ Contraseña actualizada. Se cerraron las demás sesiones");

    passwordForm.reset();
    strengthBar.style.width = "0%";
    strengthLabel.textContent = "";
  } catch (error) {
    // 401 aqui no es la sesion vencida, es la contrasena actual equivocada:
    // se senala en su campo en lugar de echar a la persona de la pantalla.
    if (error.status === 401) {
      currentField.classList.add("has-error");
    }

    mostrarMensajeContrasena(error.message, "error");
  } finally {
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
    boton.textContent = textoOriginal;
  }
});

/**
 * Reutiliza el aviso que ya existe junto al boton de guardar.
 * showSavedToast siempre dice "Cambios guardados"; aqui hace falta mostrar
 * tambien los errores que devuelve el servidor.
 */
function mostrarMensajeContrasena(texto, tipo = "ok") {
  const toast = document.getElementById("password-saved-toast");

  toast.textContent = texto;
  toast.style.color = tipo === "error" ? "#B91C1C" : "";
  toast.classList.add("show");

  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 4000);
}

// --- Eliminar cuenta (con confirmación mediante <dialog> nativo) ---
const deleteDialog = document.getElementById("delete-account-dialog");
document.getElementById("open-delete-dialog").addEventListener("click", () => deleteDialog.showModal());
document.getElementById("cancel-delete").addEventListener("click", () => deleteDialog.close());
document.getElementById("confirm-delete").addEventListener("click", () => {
  deleteDialog.close();
  window.location.href = "login.html";
});
