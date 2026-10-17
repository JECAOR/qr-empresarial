// ============================================
// RESTABLECER.JS — paso 2 de la recuperación (RF-03)
// Es la pantalla que abre el enlace del correo. El token viaja en la URL:
// restablecer.html?token=...
//
// Se comprueba el enlace antes de mostrar el formulario, para no hacer que
// alguien escriba una contraseña nueva y descubrir solo al enviarla que el
// enlace ya había vencido.
// ============================================

const pasoComprobando = document.getElementById("checking-step");
const pasoFormulario = document.getElementById("form-step");
const pasoInvalido = document.getElementById("invalid-step");
const pasoListo = document.getElementById("done-step");

const tokenDelEnlace = new URLSearchParams(window.location.search).get("token");

function mostrarPaso(paso) {
  [pasoComprobando, pasoFormulario, pasoInvalido, pasoListo].forEach((el) => {
    el.hidden = el !== paso;
  });
}

function marcarEnlaceInvalido(mensaje) {
  if (mensaje) {
    document.getElementById("invalid-message").textContent = mensaje;
  }
  mostrarPaso(pasoInvalido);
}

// --- Al cargar: comprobar el enlace ---
async function comprobarEnlace() {
  if (!tokenDelEnlace) {
    marcarEnlaceInvalido("El enlace está incompleto. Ábralo de nuevo desde el correo que recibió.");
    return;
  }

  try {
    await Api.validarEnlaceRecuperacion(tokenDelEnlace);
    mostrarPaso(pasoFormulario);
  } catch (error) {
    if (error.status === 0) {
      marcarEnlaceInvalido(
        "No se pudo conectar con el servidor para comprobar el enlace. Inténtelo de nuevo en un momento."
      );
      return;
    }

    marcarEnlaceInvalido();
  }
}

comprobarEnlace();

// --- Medidor de fuerza (evaluarFuerza viene de auth.js) ---
const campoContrasena = document.getElementById("password");
const barraFuerza = document.getElementById("password-strength-bar");
const etiquetaFuerza = document.getElementById("password-strength-label");

campoContrasena.addEventListener("input", () => {
  const { level, label, color } = evaluarFuerza(campoContrasena.value);
  barraFuerza.style.width = `${(level / 3) * 100}%`;
  barraFuerza.style.background = color;
  etiquetaFuerza.textContent = label;
  etiquetaFuerza.style.color = color;
});

// --- Envío del formulario ---
const formulario = document.getElementById("reset-form");

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  ocultarAviso();

  const confirmacion = document.getElementById("confirm-password");
  const campoContrasenaWrap = campoContrasena.closest(".form-field");
  const campoConfirmacionWrap = confirmacion.closest(".form-field");

  let valido = validarFormulario(formulario);

  // La regla real es RN-02 y la aplica el backend; aquí solo se adelanta
  // el aviso para no gastar el enlace en un intento que va a fallar.
  const fuerza = evaluarFuerza(campoContrasena.value);
  if (campoContrasena.value && fuerza.level < 2) {
    campoContrasenaWrap.classList.add("has-error");
    campoContrasenaWrap.querySelector(".form-error").textContent =
      "Use al menos 8 caracteres, una mayúscula, un número y un símbolo.";
    valido = false;
  }

  if (campoContrasena.value !== confirmacion.value) {
    campoConfirmacionWrap.classList.add("has-error");
    valido = false;
  }

  if (!valido) return;

  const boton = formulario.querySelector('button[type="submit"]');
  const textoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  boton.textContent = "Guardando...";

  try {
    await Api.restablecerContrasena(tokenDelEnlace, campoContrasena.value);

    // Si había una sesión abierta en este navegador, su contraseña ya no es
    // la que se usó para iniciarla: lo limpio para que vuelva a entrar.
    Sesion.limpiar();

    mostrarPaso(pasoListo);
  } catch (error) {
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
    boton.innerHTML = textoOriginal;

    // Un 400 aquí casi siempre significa que el enlace se consumió o venció
    // mientras la pantalla estaba abierta; no tiene arreglo desde el formulario.
    if (error.status === 400 && !error.message.toLowerCase().includes("contrase")) {
      marcarEnlaceInvalido();
      return;
    }

    mostrarAviso(error.message);
  }
});
