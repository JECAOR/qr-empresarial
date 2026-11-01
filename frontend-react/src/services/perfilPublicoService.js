// ============================================
// PERFILPUBLICOSERVICE.JS — acceso HTTP a la API (RF-09)
//
// Unica capa que habla con el backend. La pantalla no sabe que existe fetch
// ni como se llaman los campos del JSON: recibe datos ya comprobados.
// ============================================

import { pedir } from "./apiClient";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Trae el perfil publico de un negocio y su contenido visible.
 *
 * El contrato de esta API NO es el del ejemplo de la guia. Alli era
 * {success, message, data: []}; aqui es:
 *
 *   { "data": { "perfil": {...}, "contenido": [...], "porSeccion": {...} } }
 *
 * No hay campo `success` -el codigo HTTP ya dice si salio bien- y `data` es
 * un objeto, no un arreglo: el arreglo esta en `data.contenido`. Copiar el
 * servicio de la guia tal cual daria el error "contenido.map is not a
 * function", que la propia guia lista entre los frecuentes.
 *
 * @param {string} slug  La direccion publica del negocio, por ejemplo
 *                       "panaderia-la-espiga".
 * @returns {Promise<{perfil: object, contenido: object[], porSeccion: object}>}
 * @throws {Error} Con el mensaje que devuelve el servidor.
 */
export async function obtenerPerfilPublico(slug) {
  if (!slug) {
    throw new Error("Escriba la dirección de un negocio para consultarlo");
  }

  const respuesta = await pedir(`${API_URL}/publico/${encodeURIComponent(slug)}`);

  if (!respuesta.ok) {
    // El backend explica el motivo en el cuerpo. Se prefiere su mensaje al
    // numero: "Este perfil no está disponible" dice mas que un 404.
    const cuerpo = await respuesta.json().catch(() => ({}));

    throw new Error(cuerpo.message || `Error al consultar el perfil (HTTP ${respuesta.status})`);
  }

  const resultado = await respuesta.json();

  if (!resultado.data || !resultado.data.perfil) {
    throw new Error("La API no devolvió un perfil");
  }

  if (!Array.isArray(resultado.data.contenido)) {
    throw new Error("La API no devolvió un arreglo de contenido");
  }

  return resultado.data;
}

/**
 * Informa un escaneo, una visita o un clic (RF-11).
 *
 * No pasa por peticion() ni se espera la respuesta: lo que importa es que la
 * persona vea el perfil, no que se apunte la visita. Si falla, se pierde ese
 * evento y no pasa nada mas.
 *
 * Para el clic hace falta sendBeacon, que el navegador entrega aunque la
 * pagina se este yendo al enlace. Con un fetch normal, la navegacion
 * cancelaria la peticion y el clic no se contaria nunca; keepalive es el
 * respaldo para los navegadores que no traen sendBeacon.
 *
 * Solo lo llama la pagina que sirve el codigo QR. El panel del dueno no, o
 * inflaria sus propias estadisticas cada vez que abriera su perfil.
 *
 * @param {string} slug
 * @param {{tipo: "escaneo"|"visita"|"clic", idEnlace?: number}} evento
 */
export function informarEvento(slug, evento) {
  const url = `${API_URL}/publico/${encodeURIComponent(slug)}/eventos`;
  const cuerpo = JSON.stringify(evento);

  if (navigator.sendBeacon) {
    try {
      const enviado = navigator.sendBeacon(
        url,
        new Blob([cuerpo], { type: "application/json" })
      );

      if (enviado) return;
    } catch {
      // Algunos navegadores lo rechazan con ciertos tipos: se sigue con fetch
    }
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpo,
    keepalive: true
  }).catch(() => {
    // Un evento perdido no es motivo para molestar a nadie
  });
}
