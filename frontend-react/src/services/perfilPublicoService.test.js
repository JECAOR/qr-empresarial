// ============================================
// PERFILPUBLICOSERVICE — la vista que ve quien escanea el codigo (RF-09)
//
// Es el unico servicio que no pasa por apiClient, porque la ruta publica no
// lleva token. Por eso comprueba el contrato a mano, y eso es justo lo que
// hay que probar: el ejemplo de la guia devuelve {success, data: []} y esta
// API devuelve {data: {perfil, contenido}}.
// ============================================

import { describe, expect, it, vi } from "vitest";

import { obtenerPerfilPublico, informarEvento } from "./perfilPublicoService";
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

describe("informarEvento()", () => {
  const EVENTO = { tipo: "escaneo" };

  it("usa sendBeacon, que sobrevive a la navegacion", async () => {
    const beacon = vi.fn().mockReturnValue(true);

    vi.stubGlobal("navigator", { ...navigator, sendBeacon: beacon });

    const espia = simularFetch([]);

    informarEvento("la-espiga", EVENTO);

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toMatch(/\/publico\/la-espiga\/eventos$/);
    expect(await beacon.mock.calls[0][1].text()).toBe(JSON.stringify(EVENTO));

    // Con sendBeacon no hace falta el fetch
    expect(espia).not.toHaveBeenCalled();
  });

  it("escapa la direccion del negocio", () => {
    const beacon = vi.fn().mockReturnValue(true);

    vi.stubGlobal("navigator", { ...navigator, sendBeacon: beacon });

    informarEvento("un negocio/raro", EVENTO);

    expect(beacon.mock.calls[0][0]).toMatch(/\/publico\/un%20negocio%2Fraro\/eventos$/);
  });

  // Hay navegadores sin sendBeacon. keepalive es lo que permite que la
  // peticion sobreviva a la navegacion al pulsar un enlace.
  it("cae en fetch con keepalive si no hay sendBeacon", () => {
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: undefined });

    const espia = simularFetch([respuesta(null, { status: 204 })]);

    informarEvento("la-espiga", EVENTO);

    const [url, opciones] = espia.mock.calls[0];

    expect(url).toMatch(/\/publico\/la-espiga\/eventos$/);
    expect(opciones.method).toBe("POST");
    expect(opciones.keepalive).toBe(true);
    expect(JSON.parse(opciones.body)).toEqual(EVENTO);
  });

  // Algunos lo rechazan segun el tipo del Blob, y devuelven false o lanzan.
  it.each([
    ["devuelve false", () => false],
    ["lanza", () => { throw new TypeError("tipo no permitido"); }]
  ])("cae en fetch si sendBeacon %s", (_, beacon) => {
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: vi.fn(beacon) });

    const espia = simularFetch([respuesta(null, { status: 204 })]);

    informarEvento("la-espiga", EVENTO);

    expect(espia).toHaveBeenCalledTimes(1);
  });

  // Un evento perdido no es motivo para molestar a nadie: lo que importa es
  // que la persona vea el perfil, no que se apunte la visita.
  it("no revienta si la peticion falla", () => {
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: undefined });

    simularFetch([new TypeError("Failed to fetch")]);

    expect(() => informarEvento("la-espiga", EVENTO)).not.toThrow();
  });
});
