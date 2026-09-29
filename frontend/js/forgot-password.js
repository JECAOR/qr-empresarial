// ============================================
// FORGOT-PASSWORD.JS
// ============================================

const forgotForm = document.getElementById("forgot-form");
const requestStep = document.getElementById("request-step");
const sentStep = document.getElementById("sent-step");
const sentMessage = document.getElementById("sent-message");

forgotForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const emailInput = document.getElementById("forgot-email");
  const field = emailInput.closest(".form-field");
  const valido = emailInput.value.trim() !== "" && emailInput.value.includes("@");

  if (!valido) {
    field.classList.add("has-error");
    return;
  }
  field.classList.remove("has-error");

  sentMessage.textContent = `Enviamos un enlace de recuperación a ${emailInput.value}.`;
  requestStep.hidden = true;
  sentStep.hidden = false;
  // Aquí, más adelante, se conectará con el backend real para enviar el correo.
});

document.getElementById("resend-btn").addEventListener("click", () => {
  sentStep.hidden = true;
  requestStep.hidden = false;
});
