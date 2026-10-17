// ============================================
// tests/ayudas.js — apoyo compartido de las pruebas
//
// Desde que el frontend habla con la API, las pantallas privadas necesitan
// una sesión y las públicas hacen peticiones al backend. Estas pruebas no
// levantan el backend a propósito: comprueban el frontend, y deben pasar
// igual en una máquina sin MySQL y sin el servidor encendido.
//
// Para eso se hacen dos cosas:
//   simularApi    responde las peticiones a /api/... sin salir del navegador
//   sembrarSesion deja un token guardado antes de que cargue la página
// ============================================

const USUARIO = {
  idUsuario: 5,
  nombre: "Fonda La Cosecha",
  correo: "camila@fondalacosecha.co",
  rol: "empresa",
  estado: "activo"
};

const TOKEN = "token-de-prueba-sin-valor-real";
const TOKEN_NUEVO = "token-de-prueba-emitido-tras-el-cambio";

/**
 * Intercepta todas las peticiones a la API y las responde con datos fijos.
 *
 * El patrón no lleva host: api.js apunta al puerto 3000 cuando las páginas
 * se sirven desde otro sitio, y así se atrapa igual.
 */
async function simularApi(page, opciones = {}) {
  const {
    enlaceInvalido = false,
    contrasenaActualIncorrecta = false,
    contrasenaIncorrectaAlBorrar = false
  } = opciones;

  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const metodo = route.request().method();

    const responder = (status, cuerpo) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(cuerpo)
      });

    if (url.includes("/auth/login")) {
      return responder(200, {
        message: "Inicio de sesión correcto",
        data: { token: TOKEN, usuario: USUARIO }
      });
    }

    if (url.includes("/auth/registro")) {
      return responder(201, { message: "Cuenta creada correctamente", data: USUARIO });
    }

    if (url.includes("/auth/logout")) {
      return responder(200, { message: "Sesión cerrada correctamente" });
    }

    if (url.includes("/auth/recuperar-contrasena")) {
      return responder(200, {
        message: "Si el correo está registrado, recibirá un enlace para restablecer su contrasena"
      });
    }

    if (url.includes("/auth/restablecer")) {
      if (enlaceInvalido) {
        return responder(400, { message: "El enlace de recuperación no es válido o ya expiró" });
      }

      return responder(200, { message: "El enlace es válido" });
    }

    if (url.includes("/usuarios/me") && metodo === "DELETE") {
      if (contrasenaIncorrectaAlBorrar) {
        return responder(401, { message: "La contraseña no es correcta" });
      }

      return responder(200, { message: "Cuenta eliminada correctamente" });
    }

    if (url.includes("/usuarios/me/contrasena")) {
      if (contrasenaActualIncorrecta) {
        // Un 401 aquí no significa que la sesión venció, sino que la
        // contraseña actual está mal escrita
        return responder(401, { message: "La contraseña actual no es correcta" });
      }

      // El cambio cierra todas las sesiones y devuelve un token nuevo
      return responder(200, {
        message: "Contraseña actualizada correctamente. Se cerraron las demás sesiones",
        data: { token: TOKEN_NUEVO }
      });
    }

    if (url.includes("/usuarios/me")) {
      return responder(200, { data: USUARIO });
    }

    return responder(404, { message: "Recurso no encontrado" });
  });
}

/**
 * Deja una sesión guardada antes de que corra cualquier script de la página.
 * Hace falta en las pantallas privadas: sin token, la guardia redirige al
 * login antes de que haya algo que comprobar.
 */
async function sembrarSesion(page) {
  await page.addInitScript((datos) => {
    // addInitScript corre en cada navegación, no solo en la primera. Sin esta
    // marca, una prueba que cierre sesión se encontraría con la sesión puesta
    // otra vez al llegar al login, y no podría comprobar que se borró.
    if (window.sessionStorage.getItem(datos.marca)) return;

    window.sessionStorage.setItem(datos.marca, "1");
    window.localStorage.setItem(datos.clave, datos.valor);
  }, {
    clave: "qr.sesion",
    marca: "qr.sesion.sembrada",
    valor: JSON.stringify({ token: TOKEN, usuario: USUARIO })
  });
}

/** Lo habitual en una pantalla privada: sesión guardada y API simulada. */
async function prepararSesion(page) {
  await simularApi(page);
  await sembrarSesion(page);
}

module.exports = { USUARIO, TOKEN, TOKEN_NUEVO, simularApi, sembrarSesion, prepararSesion };
