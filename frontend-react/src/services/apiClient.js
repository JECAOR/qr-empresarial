// ============================================
// APICLIENT.JS — la unica puerta de salida hacia la API
//
// Pone la direccion base, el tipo de contenido y el token de la sesion, y
// convierte un error del servidor en una excepcion con su mensaje. Todo lo
// que hable con el backend pasa por aqui.
// ============================================

const API_URL = import.meta.env.VITE_API_URL;

const CLAVE_TOKEN = "qre_token";
const CLAVE_USUARIO = "qre_usuario";

/**
 * Lo que se lee cuando la sesion se termina sola.
 *
 * Lo escribe el frontend y no se reenvia el del servidor. Los del servidor
 * -"Token invalido o vencido", "Usuario invalido o restringido"- son correctos
 * para quien lee un registro y no dicen que hacer a quien esta delante. Esta
 * frase vale para los cinco motivos, y la segunda mitad es la que importa:
 * quien estaba escribiendo tiene derecho a saber que no se guardo.
 */
const MENSAJE_SESION_TERMINADA =
  "Tu sesión terminó. Entra de nuevo para seguir; lo que estuvieras escribiendo no se guardó.";

// Quien quiera enterarse. Lo registra AuthContext al montarse, porque esto
// pasa fuera de React -en medio de un fetch- y no hay forma de llamar a un
// hook desde aqui.
let avisarDeLaSesion = null;

/**
 * Registra a quien hay que avisar cuando la sesion se termine.
 *
 * @param {(mensaje: string) => void} fn
 */
export function alTerminarLaSesion(fn) {
  avisarDeLaSesion = fn;
}

/**
 * Cierra la sesion local y avisa, al recibir un 401 de sesion.
 *
 * ESTO ES LO QUE ARREGLA. Antes un 401 se trataba como cualquier otro error:
 * el token se quedaba guardado, la barra seguia con el nombre del negocio y
 * la pantalla ensenaba el mensaje del servidor en crudo. Peor todavia, las
 * pantallas interpretaban la respuesta vacia como que no habia nada:
 * Contenido decia "esta seccion todavia no tiene bloques", Codigo QR ofrecia
 * "Generar mi codigo" y Actividad decia que no habia nada que contar. Al
 * dueno de un negocio le estabamos diciendo que su contenido, su codigo y
 * sus estadisticas habian desaparecido. Solo se salia recargando, y nada lo
 * sugeria.
 *
 * Se llamaba a cerrarSesion() aqui en la primera version, y eso era un bucle:
 * cerrarSesion() hace POST /auth/logout, que con el token muerto contesta
 * otro 401 de sesion y vuelve a entrar aqui. Se borra la sesion local a
 * mano, que ademas es lo correcto: el servidor ya rechazo el token, pedirle
 * que lo revoque no tiene sentido.
 *
 * @returns {Error} Para lanzarlo.
 */
function terminarLaSesion() {
  sessionStorage.removeItem(CLAVE_TOKEN);
  sessionStorage.removeItem(CLAVE_USUARIO);

  avisarDeLaSesion?.(MENSAJE_SESION_TERMINADA);

  const error = new Error(MENSAJE_SESION_TERMINADA);

  error.status = 401;
  error.sesionTerminada = true;

  return error;
}

/**
 * Dice si una respuesta es un 401 de los que terminan la sesion.
 *
 * Por el `codigo` que manda el middleware del backend, no por el texto del
 * mensaje: comparar frases significaria romperse al reescribir una. Y no por
 * el 401 a secas, porque hay 401 que NO son de sesion: cambiar el correo,
 * cambiar la contrasena y darse de baja piden confirmar la contrasena y
 * responden 401 cuando no es la que es. Esos tienen que quedarse en el
 * formulario para poder reintentar; echar fuera a quien se equivoco al
 * teclear seria un defecto peor que el que esto arregla.
 */
function esSesionMuerta(respuesta, cuerpo) {
  return respuesta.status === 401 && cuerpo?.codigo === "sesion";
}

/**
 * Hace una peticion a la API.
 *
 * El ejemplo de la guia comprueba `body.success === false`. Esta API no tiene
 * ese campo: el codigo HTTP es el que dice si salio bien, y el cuerpo trae un
 * `message` cuando algo falla. Fiarse de un `success` que no existe haria que
 * todo pareciera correcto.
 *
 * @param {string} ruta  Por ejemplo "/usuarios/4".
 * @param {object} opciones  Las de fetch: method, body, headers.
 * @returns {Promise<object|null>} El cuerpo ya convertido, o null en un 204.
 * @throws {Error} Con el mensaje del servidor y su `status`.
 */
/**
 * fetch, con el fallo de red dicho en castellano.
 *
 * Cuando no hay conexion -o el servidor no esta levantado, o lo corta un
 * cortafuegos-, fetch rechaza con un TypeError cuyo mensaje lo pone el
 * navegador: "Failed to fetch" en Chrome, "Load failed" en Safari, "NetworkError
 * when attempting to fetch resource" en Firefox. Ese texto acababa en pantalla
 * tal cual, en ingles y sin decir que hacer, porque las pantallas ensenan el
 * mensaje del error.
 *
 * Se distingue por el tipo y no por el texto: comparar cadenas significaria
 * acertar en un navegador y fallar en los otros dos.
 *
 * Se exporta porque no todas las llamadas pasan por peticion(): la descarga
 * del codigo QR devuelve un Blob y la consulta publica no lleva token, y las
 * dos tienen que fallar igual de claro.
 */
export async function pedir(url, opciones) {
  try {
    return await fetch(url, opciones);
  } catch (fallo) {
    if (fallo instanceof TypeError) {
      // El original, para quien revise la consola
      console.error("La petición no salió:", url, fallo.message);

      const error = new Error(
        "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
      );

      error.esDeRed = true;
      throw error;
    }

    throw fallo;
  }
}

export async function peticion(ruta, opciones = {}) {
  const token = sessionStorage.getItem(CLAVE_TOKEN);

  const respuesta = await pedir(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers
    }
  });

  // 204 No Content: no hay cuerpo que leer
  if (respuesta.status === 204) return null;

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (esSesionMuerta(respuesta, cuerpo)) throw terminarLaSesion();

    const error = new Error(cuerpo?.message || `Error HTTP ${respuesta.status}`);

    error.status = respuesta.status;
    throw error;
  }

  return cuerpo;
}

/**
 * El origen del backend, deducido de VITE_API_URL.
 *
 * Hace falta para componer la direccion publica completa: la API devuelve el
 * codigo QR con una ruta relativa, "/p/mi-negocio", y quien lo escanea
 * necesita el enlace entero.
 */
export function origenDelBackend() {
  return API_URL.replace(/\/api\/?$/, "");
}

/**
 * Pide un archivo en lugar de JSON.
 *
 * La descarga del codigo (RF-08) no se puede hacer con un <a href> normal:
 * la ruta exige el token y una etiqueta de enlace no manda cabeceras. Se trae
 * el archivo como blob y se dispara la descarga desde el navegador.
 *
 * El nombre sale de Content-Disposition, que el servidor expone a proposito
 * con Access-Control-Expose-Headers; sin eso el navegador no deja leerla
 * desde otro origen y el archivo se guardaria con un nombre generico.
 *
 * @returns {Promise<{blob: Blob, nombre: string}>}
 */
export async function descargar(ruta) {
  const token = sessionStorage.getItem(CLAVE_TOKEN);

  const respuesta = await pedir(`${API_URL}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);

    // La descarga tambien: el codigo QR se pide con el token, asi que una
    // sesion muerta la rechaza igual que a las demas peticiones.
    if (esSesionMuerta(respuesta, cuerpo)) throw terminarLaSesion();

    const error = new Error(cuerpo?.message || `Error HTTP ${respuesta.status}`);

    error.status = respuesta.status;
    throw error;
  }

  const disposicion = respuesta.headers.get("content-disposition") ?? "";
  const nombre = disposicion.match(/filename="?([^"]+)"?/)?.[1] ?? "codigo-qr";

  return { blob: await respuesta.blob(), nombre };
}

export { CLAVE_TOKEN, CLAVE_USUARIO };
