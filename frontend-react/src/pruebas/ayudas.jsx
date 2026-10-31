// ============================================
// AYUDAS.JSX — lo que repiten las pruebas
//
// Solo lo que se usa en tres o mas archivos. Una ayuda que esconde lo que la
// prueba esta comprobando hace falsos aprobados muy dificiles de ver.
// ============================================

import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { ProveedorAuth } from "../context/AuthContext";
import { CLAVE_TOKEN, CLAVE_USUARIO } from "../services/apiClient";

/**
 * Una respuesta como la que devuelve fetch.
 *
 * @param {object|null} cuerpo  Lo que responde el servidor.
 * @param {object} opciones  status y headers.
 */
export function respuesta(cuerpo, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (cuerpo === undefined) throw new SyntaxError("sin cuerpo");

      return cuerpo;
    },
    blob: async () => new Blob([JSON.stringify(cuerpo ?? "")]),
    headers: {
      get: (nombre) => headers[nombre.toLowerCase()] ?? null
    }
  };
}

/**
 * Sustituye fetch por uno que responde lo que se le diga.
 *
 * Recibe una lista de respuestas, que va gastando en orden, o una funcion que
 * decide segun la ruta. Devuelve el espia, para poder comprobar con que se
 * llamo.
 */
export function simularFetch(respuestas) {
  const cola = Array.isArray(respuestas) ? [...respuestas] : null;

  const espia = vi.fn(async (url, opciones) => {
    if (typeof respuestas === "function") return respuestas(url, opciones);

    if (cola.length === 0) {
      throw new Error(`fetch sin respuesta preparada para ${url}`);
    }

    const siguiente = cola.shift();

    if (siguiente instanceof Error) throw siguiente;

    return siguiente;
  });

  vi.stubGlobal("fetch", espia);

  return espia;
}

/** Deja una sesion abierta en sessionStorage, como la deja iniciarSesion. */
export function conSesion(usuario = USUARIO_EMPRESA, token = "token-de-prueba") {
  sessionStorage.setItem(CLAVE_TOKEN, token);
  sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

export const USUARIO_EMPRESA = {
  idUsuario: 7,
  nombre: "Panadería La Espiga",
  correo: "contacto@laespiga.co",
  rol: "empresa"
};

export const USUARIO_ADMIN = {
  idUsuario: 1,
  nombre: "QR Empresarial",
  correo: "admin@caferaices.co",
  rol: "administrador"
};

/**
 * Monta algo dentro del enrutador y, si se pide, del proveedor de sesion.
 *
 * @param {JSX.Element} elemento
 * @param {{ruta?: string, conAuth?: boolean}} opciones
 */
export function dibujar(elemento, { ruta = "/", conAuth = false } = {}) {
  const envoltorio = conAuth
    ? <ProveedorAuth>{elemento}</ProveedorAuth>
    : elemento;

  return render(
    <MemoryRouter initialEntries={[ruta]}>{envoltorio}</MemoryRouter>
  );
}

/** Una serie de actividad como la que devuelve GET /estadisticas. */
export function serieDe(dias, valores = {}) {
  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(Date.UTC(2026, 9, 1 + i));

    return {
      fecha: fecha.toISOString().slice(0, 10),
      etiqueta: ["Jue", "Vie", "Sáb", "Dom", "Lun", "Mar", "Mié"][i % 7],
      escaneos: valores.escaneos?.[i] ?? 0,
      visitas: valores.visitas?.[i] ?? 0,
      clics: valores.clics?.[i] ?? 0
    };
  });
}
