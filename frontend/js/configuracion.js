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
  document.getElementById("biz-image").value = biz.image || "";
}
loadBusinessForm();

// La guardia trae el perfil del servidor despues de que esta pantalla ya se
// dibujo: cuando llega, se vuelve a llenar el formulario con lo que hay
// guardado de verdad.
window.addEventListener("perfil:sincronizado", loadBusinessForm);

// --- Guardar información del negocio (localStorage — persiste de verdad) ---
businessForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const campo = (id) => document.getElementById(id).value.trim();
  const marcar = (id, mal) => {
    document.getElementById(id).closest(".form-field").classList.toggle("has-error", mal);
  };

  // RF-10: campos obligatorios y formato. El servidor valida lo mismo; esto
  // solo adelanta el aviso para no esperar la respuesta.
  const nombre = campo("biz-name");
  marcar("biz-name", nombre.length < 2);

  const imagen = campo("biz-image");
  const imagenMal = Boolean(imagen) && !/^https?:\/\//i.test(imagen);
  marcar("biz-image", imagenMal);

  if (nombre.length < 2 || imagenMal) {
    mostrarToast("business-saved-toast", "Revise los campos marcados", "error");
    return;
  }

  const datosLocales = {
    name: nombre,
    category: campo("biz-category"),
    description: campo("biz-desc"),
    address: campo("biz-address"),
    phone: campo("biz-phone"),
    email: campo("biz-email"),
    instagram: campo("biz-instagram"),
    hours: campo("biz-hours"),
    image: imagen
  };

  const boton = businessForm.querySelector('button[type="submit"]');
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  boton.textContent = "Guardando...";

  try {
    const respuesta = await Api.guardarMiPerfilEmpresarial(datosLocalesAPerfilApi(datosLocales));

    // Se guarda lo que devolvió el servidor, no lo que se envió: el slug y la
    // fecha de actualización los decide él.
    saveBusinessData({
      ...getBusinessData(),
      ...perfilApiADatosLocales(respuesta.data)
    });

    mostrarToast("business-saved-toast", "✓ Cambios guardados");

    // El sidebar de esta misma página también refleja el cambio al instante.
    renderSidebar();
  } catch (error) {
    mostrarToast("business-saved-toast", error.message, "error");
  } finally {
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
    boton.textContent = textoOriginal;
  }
});

// --- Datos personales (RF-12) ---
//
// La contraseña solo se pide cuando el correo cambia. Es el identificador con
// el que se inicia sesión y al que llega el enlace de recuperación: quien se
// hiciera con una sesión abierta podría cambiarlo y después apropiarse de la
// cuenta con "olvidé mi contraseña".
const accountForm = document.getElementById("account-form");
const accEmail = document.getElementById("acc-email");
const accPasswordField = document.getElementById("acc-password-field");

let correoOriginal = "";

function cargarDatosPersonales() {
  const cuenta = typeof Sesion !== "undefined" ? Sesion.usuario() : null;

  if (!cuenta) return;

  document.getElementById("acc-name").value = cuenta.nombre || "";
  accEmail.value = cuenta.correo || "";
  correoOriginal = cuenta.correo || "";

  accPasswordField.hidden = true;
}

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (accountForm) {
  cargarDatosPersonales();

  // La guardia confirma la cuenta contra el servidor después de que esta
  // pantalla se dibujó: cuando llega, se rellena con lo confirmado
  window.addEventListener("perfil:sincronizado", cargarDatosPersonales);

  // El campo de la contraseña aparece en cuanto el correo deja de ser el
  // mismo, para que no sorprenda al enviar
  accEmail.addEventListener("input", () => {
    const cambio = accEmail.value.trim().toLowerCase() !== correoOriginal.toLowerCase();

    accPasswordField.hidden = !cambio;
  });

  accountForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombreEl = document.getElementById("acc-name");
    const passEl = document.getElementById("acc-password");

    const nombre = nombreEl.value.trim();
    const correo = accEmail.value.trim();
    const correoCambia = correo.toLowerCase() !== correoOriginal.toLowerCase();

    const marcar = (el, mal) => el.closest(".form-field").classList.toggle("has-error", mal);

    const nombreMal = nombre.length < 2;
    const correoMal = !FORMATO_CORREO.test(correo);
    const faltaClave = correoCambia && !passEl.value;

    marcar(nombreEl, nombreMal);
    marcar(accEmail, correoMal);
    marcar(passEl, faltaClave);

    if (nombreMal || correoMal || faltaClave) {
      mostrarToast("account-saved-toast", "Revise los campos marcados", "error");
      return;
    }

    const boton = accountForm.querySelector('button[type="submit"]');
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
      const respuesta = await Api.actualizarMisDatos(
        nombre, correo, correoCambia ? passEl.value : null
      );

      // La sesión guarda el nombre y el correo: hay que refrescarla o la
      // barra lateral seguiría mostrando los de antes
      Sesion.actualizarUsuario(respuesta.data);

      correoOriginal = respuesta.data.correo;
      passEl.value = "";
      accPasswordField.hidden = true;

      mostrarToast("account-saved-toast", "✓ Datos actualizados");
      renderSidebar();
      prepararCierreDeSesion();
    } catch (error) {
      if (error.status === 401) marcar(passEl, true);

      mostrarToast("account-saved-toast", error.message, "error");
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  });
}

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

/**
 * Muestra un aviso junto al botón de guardar de una tarjeta.
 * @param {string} id - Elemento del aviso.
 * @param {string} texto
 * @param {"ok"|"error"} [tipo]
 */
function mostrarToast(id, texto, tipo = "ok") {
  const toast = document.getElementById(id);

  toast.textContent = texto;
  toast.style.color = tipo === "error" ? "#B91C1C" : "";
  toast.classList.add("show");

  clearTimeout(toast._t);
  // Los errores se dejan más tiempo: hay que leerlos, no solo verlos pasar
  toast._t = setTimeout(() => toast.classList.remove("show"), tipo === "error" ? 4000 : 2200);
}

function showSavedToast(id) {
  mostrarToast(id, "✓ Cambios guardados");
}

// --- Notificaciones (RF-12) ---
//
// Vivían solo en el navegador: quien entraba desde otro equipo las perdía.
// Ahora las guarda el servidor, y localStorage queda como caché para que los
// interruptores no empiecen en su valor de fábrica mientras llega la
// respuesta.
//
// Las claves de la pantalla y las de la API no se llaman igual: la pantalla
// ya existía en inglés y la API sigue el español del esquema. Esta es la
// única traducción.
const NOTIF_KEY = "qre-notifications";
const NOTIF_DEFAULTS = { weekly: true, reviews: true, updates: false };

const NOMBRE_EN_LA_API = { weekly: "resumen", reviews: "resenas", updates: "novedades" };

function getNotifPrefs() {
  try {
    const stored = localStorage.getItem(NOTIF_KEY);
    return stored ? { ...NOTIF_DEFAULTS, ...JSON.parse(stored) } : { ...NOTIF_DEFAULTS };
  } catch {
    return { ...NOTIF_DEFAULTS };
  }
}

function saveNotifPrefs(prefs) {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn("No se pudieron guardar las preferencias en el navegador:", error.message);
  }
}

/** Traduce las claves de la pantalla a las de la API. */
function prefsParaLaApi(prefs) {
  return {
    resumen: Boolean(prefs.weekly),
    resenas: Boolean(prefs.reviews),
    novedades: Boolean(prefs.updates)
  };
}

/**
 * Trae las preferencias del servidor y pone los interruptores como están.
 *
 * Si nunca se guardaron, el servidor devuelve los valores por defecto, así
 * que no hay nada que distinguir aquí.
 */
async function sincronizarNotificaciones() {
  try {
    const { data } = await Api.misPreferencias();

    saveNotifPrefs({
      weekly: data.resumen,
      reviews: data.resenas,
      updates: data.novedades
    });

    loadNotifToggles();
  } catch (error) {
    // Sin conexión se queda con lo que haya en caché: es mejor que dejar los
    // interruptores en una posición que no es la de nadie
    console.warn("No se pudieron traer las preferencias:", error.message);
  }
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

    // Se manda al servidor sin esperarlo para que el interruptor responda al
    // momento. Si falla, se vuelve a poner como estaba y se avisa: dejarlo
    // encendido en la pantalla y apagado en el servidor sería peor.
    Api.guardarMisPreferencias(prefsParaLaApi(prefs)).catch((error) => {
      prefs[toggle.dataset.notifKey] = !isOn;
      saveNotifPrefs(prefs);
      loadNotifToggles();

      mostrarToast("notif-saved-toast", error.message, "error");
    });
  });
});

sincronizarNotificaciones();

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

function mostrarMensajeContrasena(texto, tipo = "ok") {
  mostrarToast("password-saved-toast", texto, tipo);
}

// --- Eliminar cuenta (con confirmación mediante <dialog> nativo) ---
//
// El borrado es logico: la fila no desaparece, se marca deleted_at y se libera
// el correo. Aun asi, desde la aplicacion no hay vuelta atras, asi que se pide
// la contrasena antes de llamar al servidor.
const deleteDialog = document.getElementById("delete-account-dialog");
const deletePassword = document.getElementById("delete-password");
const deleteAlert = document.getElementById("delete-alert");
const confirmDeleteBtn = document.getElementById("confirm-delete");

document.getElementById("open-delete-dialog").addEventListener("click", () => {
  // El nombre se toma de los datos guardados en lugar de dejarlo fijo en el
  // HTML, para que el aviso hable del negocio de quien lo está leyendo.
  document.getElementById("delete-biz-name").textContent = getBusinessData().name;

  deletePassword.value = "";
  deleteAlert.hidden = true;
  deletePassword.closest(".form-field").classList.remove("has-error");

  deleteDialog.showModal();
});

document.getElementById("cancel-delete").addEventListener("click", () => deleteDialog.close());

confirmDeleteBtn.addEventListener("click", async () => {
  deleteAlert.hidden = true;

  if (!deletePassword.value) {
    deletePassword.closest(".form-field").classList.add("has-error");
    return;
  }
  deletePassword.closest(".form-field").classList.remove("has-error");

  const textoOriginal = confirmDeleteBtn.textContent;
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.setAttribute("aria-busy", "true");
  confirmDeleteBtn.textContent = "Eliminando...";

  try {
    await Api.eliminarMiCuenta(deletePassword.value);

    // La cuenta ya no existe: el token guardado no sirve para nada
    Sesion.limpiar();
    window.location.href = "login.html?motivo=cuenta-eliminada";
  } catch (error) {
    deleteAlert.textContent = error.message;
    deleteAlert.hidden = false;

    if (error.status === 401) {
      deletePassword.closest(".form-field").classList.add("has-error");
    }
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.removeAttribute("aria-busy");
    confirmDeleteBtn.textContent = textoOriginal;
  }
});
