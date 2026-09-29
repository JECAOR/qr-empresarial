// ============================================
// AUTH.JS — lógica compartida de Login y Registro
// (sin frameworks: DOM + eventos puros)
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
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (validarFormulario(loginForm)) {
      // Aquí, más adelante, se conectará con el backend real (fase de base de datos).
      window.location.href = "dashboard.html";
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

  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();

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

    if (valido) {
      // Aquí, más adelante, se conectará con el backend real (fase de base de datos).
      window.location.href = "dashboard.html";
    }
  });
}
