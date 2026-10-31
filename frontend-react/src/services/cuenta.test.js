// ============================================
// CUENTASERVICE y CUENTAPROPIASERVICE — registro, recuperacion y la cuenta
// de quien tiene la sesion (RF-01, RF-03 y RF-12)
// ============================================

import { describe, expect, it } from "vitest";

import {
  registrar, pedirEnlaceDeRecuperacion, comprobarEnlace, restablecerContrasena
} from "./cuentaService";
import {
  guardarMisDatos, cambiarMiContrasena, consultarMisPreferencias,
  guardarMisPreferencias, eliminarMiCuenta
} from "./cuentaPropiaService";
import { CLAVE_TOKEN, CLAVE_USUARIO } from "./apiClient";
import { conSesion, respuesta, simularFetch } from "../pruebas/ayudas";

/** El cuerpo que se mandó en la llamada número `n`. */
const cuerpoDe = (espia, n = 0) => JSON.parse(espia.mock.calls[n][1].body);

describe("registrar()", () => {
  const BASE = { nombre: "Ana", correo: "ana@ejemplo.co", contrasena: "Clave123*" };

  it("manda nombre, correo y contrasena a /auth/registro", async () => {
    const espia = simularFetch([respuesta({ data: { idUsuario: 9 } }, { status: 201 })]);

    await registrar(BASE);

    expect(espia.mock.calls[0][0]).toMatch(/\/auth\/registro$/);
    expect(espia.mock.calls[0][1].method).toBe("POST");
    expect(cuerpoDe(espia)).toEqual(BASE);
  });

  it("incluye el negocio cuando se escribe", async () => {
    const espia = simularFetch([respuesta({ data: {} }, { status: 201 })]);

    await registrar({ ...BASE, negocio: { nombreNegocio: "La Espiga", categoria: "Panadería" } });

    expect(cuerpoDe(espia).negocio).toEqual({
      nombreNegocio: "La Espiga",
      categoria: "Panadería"
    });
  });

  // Un objeto negocio vacio hace fallar la validacion del servidor, y el
  // negocio es opcional a proposito.
  it("omite el negocio si viene vacio o solo con espacios", async () => {
    const espia = simularFetch([
      respuesta({ data: {} }, { status: 201 }),
      respuesta({ data: {} }, { status: 201 }),
      respuesta({ data: {} }, { status: 201 })
    ]);

    await registrar(BASE);
    await registrar({ ...BASE, negocio: {} });
    await registrar({ ...BASE, negocio: { nombreNegocio: "   " } });

    expect(cuerpoDe(espia, 0)).not.toHaveProperty("negocio");
    expect(cuerpoDe(espia, 1)).not.toHaveProperty("negocio");
    expect(cuerpoDe(espia, 2)).not.toHaveProperty("negocio");
  });

  // El registro responde sin token a proposito: hay que iniciar sesion.
  it("no deja sesion abierta", async () => {
    simularFetch([respuesta({ data: { idUsuario: 9, rol: "empresa" } }, { status: 201 })]);

    await registrar(BASE);

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });
});

describe("recuperar la contrasena", () => {
  it("pide el enlace con el correo", async () => {
    const espia = simularFetch([respuesta({ message: "Si el correo existe…" })]);

    await pedirEnlaceDeRecuperacion("ana@ejemplo.co");

    expect(espia.mock.calls[0][0]).toMatch(/\/auth\/recuperar-contrasena$/);
    expect(cuerpoDe(espia)).toEqual({ correo: "ana@ejemplo.co" });
  });

  it("escapa el token al comprobar el enlace", async () => {
    const espia = simularFetch([respuesta({ data: { valido: true } })]);

    await comprobarEnlace("token/con+signos");

    expect(espia.mock.calls[0][0]).toMatch(/\/auth\/restablecer\/token%2Fcon%2Bsignos$/);
  });

  it("manda token y contrasena nueva juntos", async () => {
    const espia = simularFetch([respuesta({ message: "Listo" })]);

    await restablecerContrasena("abc123", "ClaveNueva1*");

    expect(espia.mock.calls[0][0]).toMatch(/\/auth\/restablecer-contrasena$/);
    expect(cuerpoDe(espia)).toEqual({ token: "abc123", contrasena: "ClaveNueva1*" });
  });
});

describe("guardarMisDatos()", () => {
  it("manda solo nombre y correo cuando el correo no cambia", async () => {
    const espia = simularFetch([respuesta({ data: {} })]);

    await guardarMisDatos({ nombre: "Ana", correo: "ana@ejemplo.co" });

    expect(cuerpoDe(espia)).toEqual({ nombre: "Ana", correo: "ana@ejemplo.co" });
  });

  // Quien se hiciera con una sesion abierta podria cambiar el correo y luego
  // apropiarse de la cuenta por el enlace de recuperacion. Por eso el
  // servidor la exige, y la pantalla tiene que mandarla.
  it("incluye la contrasena cuando se escribe", async () => {
    const espia = simularFetch([respuesta({ data: {} })]);

    await guardarMisDatos({ nombre: "Ana", correo: "otro@ejemplo.co", contrasena: "Clave123*" });

    expect(cuerpoDe(espia)).toEqual({
      nombre: "Ana",
      correo: "otro@ejemplo.co",
      contrasena: "Clave123*"
    });
  });
});

describe("cambiarMiContrasena()", () => {
  // El servidor cierra las demas sesiones y devuelve un token nuevo. Sin
  // guardarlo, la siguiente peticion da 401 y la pantalla echa fuera a quien
  // acaba de cambiar su clave.
  it("guarda el token nuevo que devuelve el servidor", async () => {
    conSesion(undefined, "token-viejo");

    simularFetch([respuesta({ data: { token: "token-nuevo" } })]);

    await cambiarMiContrasena({ contrasenaActual: "a", contrasenaNueva: "b" });

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe("token-nuevo");
  });

  it("avisa si el servidor no devolvio sesion nueva", async () => {
    conSesion(undefined, "token-viejo");

    simularFetch([respuesta({ message: "Contraseña cambiada" })]);

    await expect(cambiarMiContrasena({ contrasenaActual: "a", contrasenaNueva: "b" }))
      .rejects.toThrow("El servidor no devolvió la sesión nueva");
  });

  it("no toca el token si la contrasena actual era incorrecta", async () => {
    conSesion(undefined, "token-viejo");

    simularFetch([respuesta({ message: "Contraseña incorrecta" }, { status: 401 })]);

    await expect(cambiarMiContrasena({ contrasenaActual: "mal", contrasenaNueva: "b" }))
      .rejects.toThrow("Contraseña incorrecta");

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe("token-viejo");
  });
});

describe("preferencias de avisos", () => {
  it("las consulta en /usuarios/me/preferencias", async () => {
    const espia = simularFetch([respuesta({ data: { resumen: true, novedades: false } })]);

    await consultarMisPreferencias();

    expect(espia.mock.calls[0][0]).toMatch(/\/usuarios\/me\/preferencias$/);
  });

  it("las guarda con PUT", async () => {
    const espia = simularFetch([respuesta({ data: {} })]);

    await guardarMisPreferencias({ resumen: false, novedades: true });

    expect(espia.mock.calls[0][1].method).toBe("PUT");
    expect(cuerpoDe(espia)).toEqual({ resumen: false, novedades: true });
  });
});

describe("eliminarMiCuenta()", () => {
  it("manda la contrasena en el DELETE", async () => {
    conSesion();

    const espia = simularFetch([respuesta({ message: "Cuenta eliminada" })]);

    await eliminarMiCuenta("Clave123*");

    expect(espia.mock.calls[0][1].method).toBe("DELETE");
    expect(cuerpoDe(espia)).toEqual({ contrasena: "Clave123*" });
  });

  it("borra la sesion local al darse de baja", async () => {
    conSesion();

    simularFetch([respuesta({ message: "Cuenta eliminada" })]);

    await eliminarMiCuenta("Clave123*");

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
    expect(sessionStorage.getItem(CLAVE_USUARIO)).toBeNull();
  });

  // Si la contrasena era incorrecta la cuenta sigue viva: dejarla sin sesion
  // seria echar fuera a alguien que no se ha dado de baja.
  it("deja la sesion si el servidor rechaza la baja", async () => {
    conSesion();

    simularFetch([respuesta({ message: "Contraseña incorrecta" }, { status: 401 })]);

    await expect(eliminarMiCuenta("mal")).rejects.toThrow("Contraseña incorrecta");
    expect(sessionStorage.getItem(CLAVE_TOKEN)).not.toBeNull();
  });
});
