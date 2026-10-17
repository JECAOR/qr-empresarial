// ============================================
// API.JS — cliente de la API y manejo de la sesión
// Único archivo del frontend que habla con el backend. Las pantallas no
// llaman a fetch: piden "inicia sesión" o "dame mi perfil" y reciben datos
// o un error ya traducido a algo que se le puede mostrar a la persona.
//
// Se carga antes que los demás scripts de cada pantalla.
// ============================================

// --- Dirección de la API ---
//
// El backend publica también estas pantallas en el puerto 3000, así que en
// ese caso basta una ruta relativa. Pero el frontend se abre también desde
// otros servidores mientras se desarrolla: http-server en el 4173 (pruebas
// de Playwright) o Live Server en el 5500. Desde ahí hay que apuntar al
// backend de forma explícita.
function direccionApi() {
  if (window.QR_API_URL) return window.QR_API_URL;

  if (window.location.port === "3000") return "/api";

  return "http://localhost:3000/api";
}

// --- Error de la API ---
//
// Lleva el código HTTP junto al mensaje, para que quien llama pueda
// distinguir un 401 de un 409 sin leer el texto.
class ErrorApi extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = "ErrorApi";
    this.status = status;
  }
}

// --- Sesión ---
//
// Dónde se guarda depende de si la persona marcó "Recordarme":
//   localStorage   sobrevive a cerrar el navegador
//   sessionStorage se borra al cerrar la pestaña
// Se lee de los dos, para no tener que saber cuál se usó.
const CLAVE_SESION = "qr.sesion";

const Sesion = {
  guardar({ token, usuario, recordar = false }) {
    const principal = recordar ? localStorage : sessionStorage;
    const secundario = recordar ? sessionStorage : localStorage;

    try {
      principal.setItem(CLAVE_SESION, JSON.stringify({ token, usuario }));
      // Evita quedar con dos copias que se contradigan
      secundario.removeItem(CLAVE_SESION);
    } catch (error) {
      // Modo privado o almacenamiento lleno: la sesión durará solo
      // mientras no se recargue la página
      console.warn("No se pudo guardar la sesión:", error.message);
    }
  },

  obtener() {
    try {
      const guardado =
        sessionStorage.getItem(CLAVE_SESION) || localStorage.getItem(CLAVE_SESION);

      return guardado ? JSON.parse(guardado) : null;
    } catch (error) {
      return null;
    }
  },

  token() {
    const sesion = this.obtener();
    return sesion ? sesion.token : null;
  },

  usuario() {
    const sesion = this.obtener();
    return sesion ? sesion.usuario : null;
  },

  // El nombre o el rol pueden haber cambiado desde que se inició sesión
  actualizarUsuario(usuario) {
    const sesion = this.obtener();
    if (!sesion) return;

    const enLocal = Boolean(localStorage.getItem(CLAVE_SESION));
    this.guardar({ token: sesion.token, usuario, recordar: enLocal });
  },

  limpiar() {
    try {
      localStorage.removeItem(CLAVE_SESION);
      sessionStorage.removeItem(CLAVE_SESION);
    } catch (error) {
      console.warn("No se pudo borrar la sesión:", error.message);
    }
  }
};

// --- Peticiones ---

/**
 * Hace una petición a la API y devuelve el cuerpo ya convertido.
 *
 * @param {string} camino - Ruta dentro de la API, por ejemplo "/auth/login".
 * @param {object} opciones
 * @param {string} [opciones.metodo] - GET por defecto.
 * @param {object} [opciones.cuerpo] - Se envía como JSON.
 * @param {boolean} [opciones.autenticada] - Si adjunta el token. true por defecto.
 * @param {boolean} [opciones.salirSi401] - Si un 401 significa que la sesión
 *   dejó de servir. true por defecto, que es lo normal. Se pasa false en los
 *   endpoints donde un 401 habla de otra cosa: al cambiar la contraseña, el
 *   401 es "la contraseña actual no es correcta", no "su sesión venció", y
 *   echar a la persona de la pantalla por escribir mal un campo sería absurdo.
 * @throws {ErrorApi} Con el status de la respuesta, o 0 si no hubo respuesta.
 */
async function peticion(camino, {
  metodo = "GET",
  cuerpo,
  autenticada = true,
  salirSi401 = true
} = {}) {
  const cabeceras = {};

  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";

  const token = Sesion.token();
  if (autenticada && token) cabeceras.Authorization = "Bearer " + token;

  let respuesta;

  try {
    respuesta = await fetch(direccionApi() + camino, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
  } catch (error) {
    // fetch solo rechaza cuando no llegó ninguna respuesta: servidor
    // apagado, sin red, o CORS sin autorizar
    throw new ErrorApi(
      "No se pudo conectar con el servidor. Verifique que esté encendido.",
      0
    );
  }

  // Algunas respuestas llegan sin cuerpo
  const texto = await respuesta.text();
  let datos = null;

  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch (error) {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    // El token dejó de servir: venció, la cuenta fue restringida o se cerró
    // la sesión. No tiene sentido seguir en una pantalla privada.
    if (respuesta.status === 401 && autenticada && token && salirSi401) {
      Sesion.limpiar();
      redirigirALogin("sesion-expirada");
    }

    throw new ErrorApi(
      (datos && datos.message) || "Ocurrió un error inesperado.",
      respuesta.status
    );
  }

  return datos;
}

// --- Operaciones disponibles ---

const Api = {
  // Autenticación
  iniciarSesion: (correo, contrasena) =>
    peticion("/auth/login", {
      metodo: "POST",
      cuerpo: { correo, contrasena },
      autenticada: false
    }),

  cerrarSesion: () => peticion("/auth/logout", { metodo: "POST" }),

  // El negocio es opcional: son los datos del paso 2 del registro. Con ellos
  // el backend crea la cuenta y su perfil empresarial en una sola operación.
  registrar: (nombre, correo, contrasena, negocio) =>
    peticion("/auth/registro", {
      metodo: "POST",
      cuerpo: negocio
        ? { nombre, correo, contrasena, negocio }
        : { nombre, correo, contrasena },
      autenticada: false
    }),

  // Recuperación de contraseña
  solicitarRecuperacion: (correo) =>
    peticion("/auth/recuperar-contrasena", {
      metodo: "POST",
      cuerpo: { correo },
      autenticada: false
    }),

  validarEnlaceRecuperacion: (token) =>
    peticion("/auth/restablecer/" + encodeURIComponent(token), {
      autenticada: false
    }),

  restablecerContrasena: (token, contrasena) =>
    peticion("/auth/restablecer-contrasena", {
      metodo: "POST",
      cuerpo: { token, contrasena },
      autenticada: false
    }),

  // Perfil propio
  miPerfil: () => peticion("/usuarios/me"),

  // Perfil empresarial (RF-04). Es el del negocio, no el de la cuenta.
  miPerfilEmpresarial: () => peticion("/perfiles/me"),

  // PUT reemplaza el perfil completo: hay que enviar todos los campos, no
  // solo los que cambiaron, o los ausentes quedan vacíos.
  guardarMiPerfilEmpresarial: (datos) =>
    peticion("/perfiles/me", { metodo: "PUT", cuerpo: datos }),

  cambiarContrasena: (contrasenaActual, contrasenaNueva) =>
    peticion("/usuarios/me/contrasena", {
      metodo: "PUT",
      cuerpo: { contrasenaActual, contrasenaNueva },
      salirSi401: false
    }),

  // La contraseña viaja en el cuerpo porque es una acción irreversible y no
  // basta con tener la sesión abierta. Igual que al cambiarla, un 401 aquí
  // significa que la contraseña está mal escrita, no que la sesión venció.
  eliminarMiCuenta: (contrasena) =>
    peticion("/usuarios/me", {
      metodo: "DELETE",
      cuerpo: { contrasena },
      salirSi401: false
    })
};

// --- Ayudas para las pantallas ---

function redirigirALogin(motivo) {
  if (window.location.pathname.endsWith("login.html")) return;

  window.location.replace(motivo ? "login.html?motivo=" + motivo : "login.html");
}

/**
 * Protege una pantalla privada. Se llama al cargar.
 *
 * Primero mira si hay token, que es inmediato, para no mostrar la pantalla
 * a quien no inició sesión. Después confirma contra el servidor, porque el
 * token pudo quedar inservible sin que el navegador lo sepa.
 *
 * @returns {Promise<object|null>} El usuario, o null si se está redirigiendo.
 */
async function protegerPantalla() {
  if (!Sesion.token()) {
    redirigirALogin();
    return null;
  }

  try {
    const respuesta = await Api.miPerfil();
    Sesion.actualizarUsuario(respuesta.data);
    return respuesta.data;
  } catch (error) {
    // Un 401 ya limpió la sesión y redirigió desde peticion()
    if (error.status === 0) {
      // El backend está apagado. Se deja ver la pantalla con lo último que
      // se sabe, en lugar de echar a alguien que sí inició sesión.
      console.warn("Sin conexión con el servidor; se muestran los últimos datos conocidos.");
      return Sesion.usuario();
    }

    return null;
  }
}

/**
 * Reemplaza el token de la sesión conservando dónde estaba guardado.
 *
 * Lo usa el cambio de contraseña: la operación cierra todas las sesiones de la
 * cuenta —incluida esta— y el servidor devuelve un token nuevo. Si no se
 * guardara, la siguiente petición recibiría un 401 y echaría de la pantalla a
 * quien acaba de cambiar su contraseña.
 */
function reemplazarToken(token) {
  const sesion = Sesion.obtener();
  if (!sesion) return;

  const enLocal = Boolean(localStorage.getItem(CLAVE_SESION));
  Sesion.guardar({ token, usuario: sesion.usuario, recordar: enLocal });
}

/**
 * Cierra la sesión y vuelve al login.
 * Avisa al servidor para que revoque el token (RF-02), pero no depende de
 * que lo consiga: si falla, se borra igual en el navegador.
 */
async function cerrarSesionYSalir() {
  try {
    await Api.cerrarSesion();
  } catch (error) {
    console.warn("No se pudo avisar al servidor del cierre:", error.message);
  }

  Sesion.limpiar();
  window.location.href = "login.html";
}
