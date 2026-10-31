// ============================================
// APICLIENT — la unica puerta de salida hacia la API
//
// Es la pieza que mas vale probar: todo lo demas pasa por aqui, y si se
// equivoca con el token o con un error del servidor, se equivocan las trece
// pantallas a la vez.
// ============================================

import { beforeEach, describe, expect, it, vi } from "vitest";

import { peticion, descargar, origenDelBackend, CLAVE_TOKEN } from "./apiClient";
import { respuesta, simularFetch } from "../pruebas/ayudas";

const API = "http://api.de.pruebas.invalido/api";

describe("peticion()", () => {
  it("compone la direccion con la base de VITE_API_URL", async () => {
    const espia = simularFetch([respuesta({ data: [] })]);

    await peticion("/usuarios");

    expect(espia).toHaveBeenCalledWith(`${API}/usuarios`, expect.anything());
  });

  it("manda Content-Type en todas las peticiones", async () => {
    const espia = simularFetch([respuesta({})]);

    await peticion("/qr", { method: "POST" });

    const [, opciones] = espia.mock.calls[0];

    expect(opciones.headers["Content-Type"]).toBe("application/json");
    expect(opciones.method).toBe("POST");
  });

  it("no manda Authorization cuando no hay sesion", async () => {
    const espia = simularFetch([respuesta({ data: {} })]);

    await peticion("/publico/mi-negocio");

    expect(espia.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  it("manda el token de sessionStorage cuando lo hay", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "abc.def.ghi");

    const espia = simularFetch([respuesta({ data: {} })]);

    await peticion("/usuarios/me");

    expect(espia.mock.calls[0][1].headers.Authorization).toBe("Bearer abc.def.ghi");
  });

  it("deja que quien llama pise una cabecera", async () => {
    const espia = simularFetch([respuesta({})]);

    await peticion("/algo", { headers: { "Content-Type": "text/plain" } });

    expect(espia.mock.calls[0][1].headers["Content-Type"]).toBe("text/plain");
  });

  it("devuelve el cuerpo ya convertido", async () => {
    simularFetch([respuesta({ data: { idUsuario: 7 } })]);

    await expect(peticion("/usuarios/7")).resolves.toEqual({ data: { idUsuario: 7 } });
  });

  it("devuelve null en un 204, sin intentar leer el cuerpo", async () => {
    const sinCuerpo = respuesta(undefined, { status: 204 });

    vi.spyOn(sinCuerpo, "json");
    simularFetch([sinCuerpo]);

    await expect(peticion("/usuarios/7", { method: "DELETE" })).resolves.toBeNull();
    expect(sinCuerpo.json).not.toHaveBeenCalled();
  });

  describe("cuando el servidor responde con error", () => {
    it("lanza con el mensaje que mando el servidor", async () => {
      simularFetch([respuesta({ message: "Credenciales incorrectas" }, { status: 401 })]);

      await expect(peticion("/auth/login", { method: "POST" }))
        .rejects.toThrow("Credenciales incorrectas");
    });

    it("pone el codigo HTTP en el error, que es lo que mira cada pantalla", async () => {
      simularFetch([respuesta({ message: "No encontrado" }, { status: 404 })]);

      // 404 en /qr no es un fallo: es un perfil que aun no genero su codigo,
      // y la pantalla lo distingue por este numero.
      await expect(peticion("/qr")).rejects.toMatchObject({ status: 404 });
    });

    it("inventa un mensaje si el cuerpo no es JSON", async () => {
      simularFetch([respuesta(undefined, { status: 502 })]);

      await expect(peticion("/usuarios")).rejects.toThrow("Error HTTP 502");
    });

    // El ejemplo de las guias decide si la peticion salio bien mirando un
    // campo `success` del cuerpo. Esta API no lo tiene: manda el codigo HTTP.
    // Si alguien volviera a fiarse de `success`, esto pasaria por correcto.
    it("no se fia de un campo success que esta API no manda", async () => {
      simularFetch([respuesta({ success: true, message: "Prohibido" }, { status: 403 })]);

      await expect(peticion("/admin/resumen")).rejects.toThrow("Prohibido");
    });

    it("tampoco toma por error un 200 con success a false", async () => {
      simularFetch([respuesta({ success: false, data: { idUsuario: 7 } })]);

      await expect(peticion("/usuarios/me")).resolves.toHaveProperty("data.idUsuario", 7);
    });
  });
});

describe("origenDelBackend()", () => {
  // La API devuelve la direccion del QR relativa -"/p/mi-negocio"- y quien lo
  // escanea necesita el enlace entero.
  it("quita el /api del final", () => {
    expect(origenDelBackend()).toBe("http://api.de.pruebas.invalido");
  });
});

describe("descargar()", () => {
  beforeEach(() => {
    sessionStorage.setItem(CLAVE_TOKEN, "token-de-prueba");
  });

  it("manda el token, que es justo por lo que no se puede usar un <a href>", async () => {
    const espia = simularFetch([
      respuesta("imagen", { headers: { "content-disposition": 'attachment; filename="qr.png"' } })
    ]);

    await descargar("/qr/imagen?formato=png");

    expect(espia.mock.calls[0][1].headers.Authorization).toBe("Bearer token-de-prueba");
  });

  it("saca el nombre del archivo de Content-Disposition", async () => {
    simularFetch([
      respuesta("imagen", {
        headers: { "content-disposition": 'attachment; filename="qr-la-espiga.png"' }
      })
    ]);

    const { nombre, blob } = await descargar("/qr/imagen");

    expect(nombre).toBe("qr-la-espiga.png");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("lee el nombre aunque venga sin comillas", async () => {
    simularFetch([
      respuesta("imagen", { headers: { "content-disposition": "attachment; filename=qr.svg" } })
    ]);

    await expect(descargar("/qr/imagen")).resolves.toHaveProperty("nombre", "qr.svg");
  });

  // Sin Access-Control-Expose-Headers el navegador no deja leer la cabecera
  // desde otro origen. Pasa de verdad, y el archivo no puede quedarse sin
  // nombre.
  it("usa un nombre de respaldo si el navegador no deja leer la cabecera", async () => {
    simularFetch([respuesta("imagen")]);

    await expect(descargar("/qr/imagen")).resolves.toHaveProperty("nombre", "codigo-qr");
  });

  it("lanza con el mensaje del servidor cuando falla", async () => {
    simularFetch([respuesta({ message: "El código no existe" }, { status: 404 })]);

    await expect(descargar("/qr/imagen")).rejects.toMatchObject({
      message: "El código no existe",
      status: 404
    });
  });
});
