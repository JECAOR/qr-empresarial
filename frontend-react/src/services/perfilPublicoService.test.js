// ============================================
// PERFILPUBLICOSERVICE — la vista que ve quien escanea el codigo (RF-09)
//
// Es el unico servicio que no pasa por apiClient, porque la ruta publica no
// lleva token. Por eso comprueba el contrato a mano, y eso es justo lo que
// hay que probar: el ejemplo de la guia devuelve {success, data: []} y esta
// API devuelve {data: {perfil, contenido}}.
// ============================================

import { describe, expect, it } from "vitest";

import { obtenerPerfilPublico } from "./perfilPublicoService";
import { respuesta, simularFetch } from "../pruebas/ayudas";

const PERFIL = {
  data: {
    perfil: { nombreNegocio: "Panadería La Espiga", tema: "indigo" },
    contenido: [{ id: "enlace-1", titulo: "Escríbenos", tipo: "enlace" }],
    porSeccion: { principal: 1 }
  }
};

describe("obtenerPerfilPublico()", () => {
  it("no llama al servidor si no le dan direccion", async () => {
    const espia = simularFetch([]);

    await expect(obtenerPerfilPublico("")).rejects.toThrow(/Escriba la dirección/);
    expect(espia).not.toHaveBeenCalled();
  });

  it("escapa la direccion antes de ponerla en la URL", async () => {
    const espia = simularFetch([respuesta(PERFIL)]);

    await obtenerPerfilPublico("un negocio/raro");

    expect(espia.mock.calls[0][0]).toMatch(/\/publico\/un%20negocio%2Fraro$/);
  });

  it("no manda token: la ruta es publica", async () => {
    sessionStorage.setItem("qre_token", "jwt");

    const espia = simularFetch([respuesta(PERFIL)]);

    await obtenerPerfilPublico("panaderia-la-espiga");

    // fetch se llama sin segundo argumento, o sin cabecera de autorizacion
    expect(espia.mock.calls[0][1]?.headers?.Authorization).toBeUndefined();
  });

  it("devuelve el perfil y su contenido", async () => {
    simularFetch([respuesta(PERFIL)]);

    const datos = await obtenerPerfilPublico("panaderia-la-espiga");

    expect(datos.perfil.nombreNegocio).toBe("Panadería La Espiga");
    expect(datos.contenido).toHaveLength(1);
  });

  it("prefiere el mensaje del servidor al numero del error", async () => {
    simularFetch([respuesta({ message: "Este perfil no está disponible" }, { status: 404 })]);

    await expect(obtenerPerfilPublico("no-existe"))
      .rejects.toThrow("Este perfil no está disponible");
  });

  it("dice el codigo HTTP si el servidor no explica nada", async () => {
    simularFetch([respuesta(undefined, { status: 503 })]);

    await expect(obtenerPerfilPublico("x")).rejects.toThrow(/HTTP 503/);
  });

  describe("cuando la respuesta no tiene la forma esperada", () => {
    it("avisa si no viene perfil", async () => {
      simularFetch([respuesta({ data: { contenido: [] } })]);

      await expect(obtenerPerfilPublico("x")).rejects.toThrow("La API no devolvió un perfil");
    });

    // Este es el error que la guia lista entre los frecuentes: con el contrato
    // del ejemplo, data es el arreglo y contenido no existe, de modo que la
    // pantalla reventaba con "contenido.map is not a function" al dibujar.
    it("avisa si contenido no es un arreglo, en lugar de dejar reventar al map", async () => {
      simularFetch([respuesta({ success: true, data: [{ id: 1 }] })]);

      await expect(obtenerPerfilPublico("x"))
        .rejects.toThrow("La API no devolvió un perfil");
    });

    it("avisa si el perfil llega pero el contenido no es un arreglo", async () => {
      simularFetch([respuesta({ data: { perfil: { nombreNegocio: "X" }, contenido: null } })]);

      await expect(obtenerPerfilPublico("x"))
        .rejects.toThrow("La API no devolvió un arreglo de contenido");
    });

    it("acepta un perfil sin bloques, que es un negocio recien creado", async () => {
      simularFetch([respuesta({ data: { perfil: { nombreNegocio: "X" }, contenido: [] } })]);

      await expect(obtenerPerfilPublico("x")).resolves.toHaveProperty("contenido", []);
    });
  });
});
