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
export async function peticion(ruta, opciones = {}) {
  const token = sessionStorage.getItem(CLAVE_TOKEN);

  const respuesta = await fetch(`${API_URL}${ruta}`, {
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
    const error = new Error(cuerpo?.message || `Error HTTP ${respuesta.status}`);

    error.status = respuesta.status;
    throw error;
  }

  return cuerpo;
}

export { CLAVE_TOKEN, CLAVE_USUARIO };
