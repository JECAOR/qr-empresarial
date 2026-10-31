// ============================================
// AUTHSERVICE — entrar, salir y preguntar quien eres (RF-02)
// ============================================

import { describe, expect, it } from "vitest";

import { iniciarSesion, cerrarSesion, consultarMiPerfil } from "./authService";
import { CLAVE_TOKEN, CLAVE_USUARIO } from "./apiClient";
import { respuesta, simularFetch, USUARIO_EMPRESA } from "../pruebas/ayudas";

const SESION_CORRECTA = {
  message: "Sesión iniciada",
  data: { token: "jwt.de.prueba", usuario: USUARIO_EMPRESA }
};

describe("iniciarSesion()", () => {
  // El ejemplo de las guias manda {email, password}. Esta API pide
  // {correo, contrasena} y con el otro cuerpo responde 400.
  it("manda correo y contrasena, no email y password", async () => {
    const espia = simularFetch([respuesta(SESION_CORRECTA)]);

    await iniciarSesion("contacto@laespiga.co", "Clave123*");

    const [url, opciones] = espia.mock.calls[0];

    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(opciones.body)).toEqual({
      correo: "contacto@laespiga.co",
      contrasena: "Clave123*"
    });
  });

  it("guarda el token y el usuario en sessionStorage", async () => {
    simularFetch([respuesta(SESION_CORRECTA)]);

    await iniciarSesion("contacto@laespiga.co", "Clave123*");

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe("jwt.de.prueba");
    expect(JSON.parse(sessionStorage.getItem(CLAVE_USUARIO))).toEqual(USUARIO_EMPRESA);
  });

  // En localStorage la sesion sobreviviria a cerrar la pestana, que no es lo
  // que se espera de un panel de administracion.
  it("no toca localStorage", async () => {
    simularFetch([respuesta(SESION_CORRECTA)]);

    await iniciarSesion("contacto@laespiga.co", "Clave123*");

    expect(localStorage.length).toBe(0);
  });

  it("devuelve el usuario, que quien llama necesita para saber a donde ir", async () => {
    simularFetch([respuesta(SESION_CORRECTA)]);

    await expect(iniciarSesion("a@b.co", "x")).resolves.toEqual(USUARIO_EMPRESA);
  });

  it("lee data.usuario, no data.user", async () => {
    simularFetch([respuesta({
      data: { token: "t", user: { idUsuario: 1, rol: "empresa" } }
    })]);

    await expect(iniciarSesion("a@b.co", "x"))
      .rejects.toThrow("La respuesta del inicio de sesión está incompleta");
  });

  it("rechaza una respuesta sin rol en lugar de dejar la sesion a medias", async () => {
    simularFetch([respuesta({
      data: { token: "t", usuario: { idUsuario: 1, nombre: "Sin rol" } }
    })]);

    await expect(iniciarSesion("a@b.co", "x")).rejects.toThrow(/incompleta/);
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  it("no guarda nada si las credenciales son incorrectas", async () => {
    simularFetch([respuesta({ message: "Credenciales incorrectas" }, { status: 401 })]);

    await expect(iniciarSesion("a@b.co", "mal")).rejects.toThrow("Credenciales incorrectas");
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
    expect(sessionStorage.getItem(CLAVE_USUARIO)).toBeNull();
  });
});

describe("cerrarSesion()", () => {
  it("avisa al servidor para que revoque el token", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt.de.prueba");

    const espia = simularFetch([respuesta(null, { status: 204 })]);

    await cerrarSesion();

    const [url, opciones] = espia.mock.calls[0];

    expect(url).toMatch(/\/auth\/logout$/);
    expect(opciones.method).toBe("POST");
  });

  it("borra la sesion local", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt.de.prueba");
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(USUARIO_EMPRESA));

    simularFetch([respuesta(null, { status: 204 })]);

    await cerrarSesion();

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
    expect(sessionStorage.getItem(CLAVE_USUARIO)).toBeNull();
  });

  // Si el token ya habia caducado, /auth/logout responde 401. Dejar la sesion
  // local puesta por eso seria dejar al usuario atrapado en una sesion muerta.
  it("borra la sesion local aunque el servidor conteste con error", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "caducado");

    simularFetch([respuesta({ message: "Token inválido" }, { status: 401 })]);

    await expect(cerrarSesion()).resolves.toBeUndefined();
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  it("borra la sesion local aunque no haya red", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt.de.prueba");

    simularFetch([new TypeError("Failed to fetch")]);

    await expect(cerrarSesion()).resolves.toBeUndefined();
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });
});

describe("consultarMiPerfil()", () => {
  it("pregunta por /usuarios/me", async () => {
    const espia = simularFetch([respuesta({ data: USUARIO_EMPRESA })]);

    await consultarMiPerfil();

    expect(espia.mock.calls[0][0]).toMatch(/\/usuarios\/me$/);
  });
});
