// ============================================
// REGISTER-STEPS.JS — navegación entre los 3 pasos
// del formulario de registro
// ============================================

const STEP_INFO = {
  1: { title: "Crea tu cuenta", subtitle: "Paso 1 de 3 · Solo toma 30 segundos" },
  2: { title: "Cuéntanos de tu negocio", subtitle: "Paso 2 de 3 · Así se verá tu perfil público" },
  3: { title: "Elige tu plan", subtitle: "Paso 3 de 3 · Puedes cambiarlo cuando quieras" },
};

function validarPaso(stepEl) {
  let valido = true;
  stepEl.querySelectorAll("[data-required]").forEach((input) => {
    const field = input.closest(".form-field") || input.closest(".terms-label");
    let esInvalido;
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

function goToStep(n) {
  document.querySelectorAll(".reg-step").forEach((el) => {
    el.hidden = Number(el.dataset.step) !== n;
  });

  document.querySelectorAll(".step-item").forEach((el, idx) => {
    el.classList.toggle("active", idx + 1 <= n);
  });

  document.getElementById("step-title").textContent = STEP_INFO[n].title;
  document.getElementById("step-subtitle").textContent = STEP_INFO[n].subtitle;
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Botones "Continuar" — validan el paso actual antes de avanzar
document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const currentStep = btn.closest(".reg-step");

    // Validación específica de contraseñas (solo aplica en el paso 1)
    if (currentStep.dataset.step === "1") {
      const pass = document.getElementById("password");
      const confirm = document.getElementById("confirm-password");
      const passField = pass.closest(".form-field");
      const confirmField = confirm.closest(".form-field");
      const fuerza = evaluarFuerza(pass.value);

      let pasoValido = validarPaso(currentStep);

      if (pass.value && fuerza.level < 2) {
        passField.classList.add("has-error");
        pasoValido = false;
      }
      if (pass.value !== confirm.value) {
        confirmField.classList.add("has-error");
        pasoValido = false;
      }
      if (!pasoValido) return;
    } else if (!validarPaso(currentStep)) {
      return;
    }

    goToStep(Number(btn.dataset.next));
  });
});

// Botones "Atrás" — no validan, solo retroceden
document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => goToStep(Number(btn.dataset.back)));
});
