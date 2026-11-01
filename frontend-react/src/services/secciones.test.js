// ============================================
// LAS SECCIONES DEL CONTENIDO (RF-05)
//
// El dueño reparte su contenido en tres secciones desde el panel, y la API lo
// devuelve agrupado por ellas. Lo que se prueba aquí es el orden en que se
// pintan y qué pasa con lo que esta lista no conoce: el validador del backend
// acepta cualquier cadena en `seccion`, así que puede llegar una que no esté.
// ============================================

import { describe, expect, it } from "vitest";

import { SECCIONES, SECCION_MENU, seccionesEnOrden } from "./contenidoService";

const bloque = (id, seccion) => ({ id, seccion, titulo: id, detalle: "x", tipo: "texto" });

describe("la lista de secciones", () => {
  it("son las tres del panel", () => {
    expect(SECCIONES.map((s) => s.id)).toEqual(["menu", "promos", "reservas"]);
  });

  it("cada una tiene nombre para enseñar", () => {
    for (const seccion of SECCIONES) {
      expect(seccion.nombre).toBeTruthy();
    }
  });

  // La pantalla del menú lee esta constante en lugar de escribir "menu".
  it("la del menu es la primera", () => {
    expect(SECCIONES[0].id).toBe(SECCION_MENU);
  });
});

describe("seccionesEnOrden", () => {
  // Quien ordena su contenido en el panel espera verlo igual en su página:
  // si la API devolviera las claves en otro orden, el visitante vería las
  // promociones antes del menú.
  it("respeta el orden del panel, no el de la respuesta", () => {
    const agrupado = {
      reservas: [bloque("r1", "reservas")],
      menu: [bloque("m1", "menu")],
      promos: [bloque("p1", "promos")]
    };

    expect(seccionesEnOrden(agrupado).map((s) => s.id)).toEqual(["menu", "promos", "reservas"]);
  });

  it("pone el nombre de cada seccion", () => {
    const secciones = seccionesEnOrden({ promos: [bloque("p1", "promos")] });

    expect(secciones[0].nombre).toBe("Promociones");
  });

  it("devuelve los bloques de cada una", () => {
    const uno = bloque("m1", "menu");
    const otro = bloque("m2", "menu");

    expect(seccionesEnOrden({ menu: [uno, otro] })[0].bloques).toEqual([uno, otro]);
  });

  // Un titulo de seccion sin nada debajo no dice nada.
  it("descarta las secciones vacias", () => {
    const agrupado = { menu: [bloque("m1", "menu")], promos: [], reservas: [] };

    expect(seccionesEnOrden(agrupado).map((s) => s.id)).toEqual(["menu"]);
  });

  // Se guarda con el nombre que venga, en lugar de desaparecer: el contenido
  // esta publicado y el visitante tiene que verlo.
  it("una seccion desconocida se pinta con su nombre tal cual, al final", () => {
    const agrupado = {
      "temporada-navidena": [bloque("n1", "temporada-navidena")],
      menu: [bloque("m1", "menu")]
    };

    const secciones = seccionesEnOrden(agrupado);

    expect(secciones.map((s) => s.id)).toEqual(["menu", "temporada-navidena"]);
    expect(secciones[1].nombre).toBe("temporada-navidena");
  });

  it("sin contenido no devuelve nada", () => {
    expect(seccionesEnOrden({})).toEqual([]);
    expect(seccionesEnOrden(undefined)).toEqual([]);
    expect(seccionesEnOrden(null)).toEqual([]);
  });
});
