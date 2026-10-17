// ============================================
// AUTH.JS — lógica compartida de Login y Registro
// (sin frameworks: DOM + eventos puros)
//
// La validación se hace aquí para avisar sin esperar al servidor, pero no
// sustituye la del backend: es la del backend la que manda. Lo mismo vale
// para la fuerza de la contraseña, que aquí es una guía visual y allá es la
// regla RN-02.
// ============================================

// --- Mostrar / ocultar contraseña ---
document.querySelectorAll(".toggle-password").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = toggle.closest(".form-input-wrap").querySelector("input");
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    toggle.setAttribute("aria-label", isHidden ? "Ocultar contraseña" : "Mostrar contraseña");
  });
});

// --- Avisos generales del formulario ---
// Para lo que no pertenece a un campo concreto: credenciales inválidas,
// correo ya registrado, servidor apagado.
function mostrarAviso(mensaje, tipo = "error") {
  const aviso = document.getElementById("form-alert");
  if (!aviso) return;

  aviso.textContent = mensaje;
  aviso.className = "form-alert form-alert--" + (tipo === "ok" ? "ok" : "error");
  aviso.hidden = false;
}

function ocultarAviso() {
  const aviso = document.getElementById("form-alert");
  if (aviso) aviso.hidden = true;
}

// Mientras se espera al servidor: evita el doble envío y lo hace visible
function ocupar(boton, textoEspera) {
  const original = boton.innerHTML;
  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  boton.textContent = textoEspera;

  return function liberar() {
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
    boton.innerHTML = original;
  };
}

// --- Validación simple al enviar el formulario ---
function validarFormulario(form) {
  let valido = true;

  form.querySelectorAll("[data-required]").forEach((input) => {
    const field = input.closest(".form-field") || input.closest(".terms-label");
    let esInvalido = false;

    if (input.type === "checkbox") {
      esInvalido = !input.checked;
    } else {
      const vacio = input.value.trim() === "";
      const emailInvalido = input.type === "email" && input.value.trim() !== "" && !input.value.includes("@");
      esInvalido = vacio || emailInvalido;
    }

    if (esInvalido) {
      field.classList.add("has-error");
      valido = false;
    } else {
      field.classList.remove("has-error");
    }
  });

  return valido;
}

// --- Formulario de Login ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  // Si llegó aquí porque su sesión dejó de servir, conviene explicarlo:
  // de lo contrario parecería que la aplicación lo expulsó sin motivo.
  const motivo = new URLSearchParams(window.location.search).get("motivo");

  if (motivo === "sesion-expirada") {
    mostrarAviso("Su sesión terminó. Inicie sesión de nuevo.", "error");
  } else if (motivo === "cuenta-eliminada") {
    mostrarAviso("Su cuenta fue eliminada. Gracias por usar QR Empresarial.", "ok");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultarAviso();

    if (!validarFormulario(loginForm)) return;

    const boton = loginForm.querySelector('button[type="submit"]');
    const liberar = ocupar(boton, "Verificando...");

    try {
      const respuesta = await Api.iniciarSesion(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );

      Sesion.guardar({
        token: respuesta.data.token,
        usuario: respuesta.data.usuario,
        recordar: document.getElementById("remember").checked
      });

      window.location.href = "dashboard.html";
    } catch (error) {
      liberar();

      // El backend responde lo mismo para correo inexistente, contraseña
      // equivocada y cuenta restringida, a propósito: así nadie averigua
      // qué correos están registrados probando uno por uno.
      mostrarAviso(error.message);
    }
  });
}

// --- Medidor de fuerza de contraseña (usado en Registro y Configuración) ---
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

// --- Formulario de Registro ---
const registerForm = document.getElementById("register-form");
if (registerForm) {
  // --- Medidor de fuerza de contraseña ---
  const passInput = registerForm.querySelector("#password");
  const strengthBar = document.getElementById("password-strength-bar");
  const strengthLabel = document.getElementById("password-strength-label");

  passInput.addEventListener("input", () => {
    const { level, label, color } = evaluarFuerza(passInput.value);
    strengthBar.style.width = `${(level / 3) * 100}%`;
    strengthBar.style.background = color;
    strengthLabel.textContent = label;
    strengthLabel.style.color = color;
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultarAviso();

    const pass = registerForm.querySelector("#password");
    const confirm = registerForm.querySelector("#confirm-password");
    const passField = pass.closest(".form-field");
    const confirmField = confirm.closest(".form-field");

    let valido = validarFormulario(registerForm);

    const fuerza = evaluarFuerza(pass.value);
    if (pass.value && fuerza.level < 2) {
      passField.classList.add("has-error");
      passField.querySelector(".form-error").textContent = "Usa al menos 8 caracteres, mayúsculas, minúsculas y un número.";
      valido = false;
    }

    if (pass.value !== confirm.value) {
      confirmField.classList.add("has-error");
      confirmField.querySelector(".form-error").textContent = "Las contraseñas no coinciden.";
      valido = false;
    }

    if (!valido) return;

    const boton = registerForm.querySelector('button[type="submit"]');
    const liberar = ocupar(boton, "Creando la cuenta...");

    const nombre = document.getElementById("fullname").value.trim();
    const correo = document.getElementById("reg-email").value.trim();

    try {
      // La cuenta se crea con el rol "empresa"; el backend ignora cualquier
      // otro rol que llegue en la petición.
      await Api.registrar(nombre, correo, pass.value);

      // Se inicia sesión en seguida, para no pedir los mismos datos otra vez
      const respuesta = await Api.iniciarSesion(correo, pass.value);

      Sesion.guardar({
        token: respuesta.data.token,
        usuario: respuesta.data.usuario,
        recordar: true
      });

      guardarDatosDelNegocio(correo);

      window.location.href = "dashboard.html";
    } catch (error) {
      liberar();

      // El correo repetido es el único error que se puede señalar en su campo
      if (error.status === 409) {
        const campoCorreo = document.getElementById("reg-email").closest(".form-field");
        campoCorreo.classList.add("has-error");
        campoCorreo.querySelector(".form-error").textContent = error.message;
      }

      mostrarAviso(error.message);
    }
  });
}

/**
 * Guarda los datos del paso 2 del registro.
 *
 * El perfil empresarial todavía no tiene endpoints: es el módulo 2 del
 * proyecto (RF-04). Hasta entonces se conservan en el navegador, igual que
 * hacen las demás pantallas, para que el panel muestre el negocio que la
 * persona acaba de registrar en lugar del de ejemplo.
 */
function guardarDatosDelNegocio(correoDeLaCuenta) {
  const campo = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };

  const nombre = campo("reg-biz-name");
  if (!nombre) return;

  try {
    const actuales = getBusinessData();

    saveBusinessData({
      ...actuales,
      name: nombre,
      category: campo("reg-biz-category") || actuales.category,
      address: campo("reg-biz-address") || actuales.address,
      phone: campo("reg-biz-phone") || actuales.phone,
      email: correoDeLaCuenta || actuales.email
    });
  } catch (error) {
    console.warn("No se pudieron guardar los datos del negocio:", error.message);
  }
}
