// ============================================
// FORGOT-PASSWORD.JS — paso 1 de la recuperación (RF-03)
// Pide el enlace al backend. El paso 2 está en restablecer.js.
// ============================================

const forgotForm = document.getElementById("forgot-form");
const requestStep = document.getElementById("request-step");
const sentStep = document.getElementById("sent-step");
const sentMessage = document.getElementById("sent-message");
const avisoForgot = document.getElementById("form-alert");

let ultimoCorreo = "";

function avisar(mensaje) {
  if (!avisoForgot) return;
  avisoForgot.textContent = mensaje;
  avisoForgot.className = "form-alert form-alert--error";
  avisoForgot.hidden = false;
}

async function solicitarEnlace(correo, boton) {
  if (avisoForgot) avisoForgot.hidden = true;

  const textoOriginal = boton ? boton.innerHTML : null;

  if (boton) {
    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");
    boton.textContent = "Enviando...";
  }

  try {
    await Api.solicitarRecuperacion(correo);

    // El backend responde lo mismo exista o no el correo, para no revelar
    // qué cuentas están registradas. Por eso el mensaje es condicional.
    sentMessage.textContent =
      `Si ${correo} está registrado, recibirá un enlace para restablecer su contraseña. ` +
      "Revise también la carpeta de correo no deseado.";

    requestStep.hidden = true;
    sentStep.hidden = false;
  } catch (error) {
    // 429: se agotó el cupo de solicitudes desde esta conexión
    avisar(error.message);
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute("aria-busy");
      boton.innerHTML = textoOriginal;
    }
  }
}

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

  ultimoCorreo = emailInput.value.trim();
  solicitarEnlace(ultimoCorreo, forgotForm.querySelector('button[type="submit"]'));
});

// "Reenviar" pide otro enlace: el anterior queda invalidado por el backend
document.getElementById("resend-btn").addEventListener("click", (e) => {
  if (ultimoCorreo) {
    solicitarEnlace(ultimoCorreo, e.currentTarget);
    return;
  }

  sentStep.hidden = true;
  requestStep.hidden = false;
});
