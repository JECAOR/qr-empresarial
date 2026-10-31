// ============================================
// GRAFICAACTIVIDAD — la actividad dia a dia
//
// Es SVG dibujado a mano, asi que lo que se comprueba son las coordenadas y
// las etiquetas: que la escala no se divida por cero, que la fecha no se
// corra un dia, y que con noventa dias no se dibujen noventa etiquetas una
// encima de otra.
// ============================================

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GraficaActividad from "./GraficaActividad";
import { serieDe } from "../../../pruebas/ayudas";

/** Los números del eje vertical, de arriba abajo como salen en el SVG. */
const marcasDelEje = (contenedor) =>
  [...contenedor.querySelectorAll(".grafica__numero")].map((t) => t.textContent);

/** Las etiquetas de fecha del eje horizontal. */
const fechasDelEje = (contenedor) =>
  [...contenedor.querySelectorAll(".grafica__fecha")].map((t) => t.textContent);

describe("la escala", () => {
  it("usa el maximo de las dos series", () => {
    const { container } = render(
      <GraficaActividad serie={serieDe(7, { escaneos: [1, 2, 3, 4, 5, 6, 7], clics: [0, 0, 0, 0, 0, 0, 12] })} />
    );

    expect(marcasDelEje(container)).toEqual(["0", "6", "12"]);
  });

  // Sin el minimo de 1, el eje se dividiria por cero y la linea desapareceria
  // en lugar de quedarse pegada abajo.
  it("no se divide por cero cuando no hubo actividad", () => {
    const { container } = render(<GraficaActividad serie={serieDe(7)} />);

    expect(marcasDelEje(container)).toEqual(["0", "1"]);

    for (const punto of container.querySelectorAll(".grafica__punto")) {
      expect(Number(punto.getAttribute("cy"))).not.toBeNaN();
    }
  });

  it("no repite una marca cuando el maximo es 1", () => {
    const { container } = render(
      <GraficaActividad serie={serieDe(7, { escaneos: [0, 0, 0, 0, 0, 0, 1] })} />
    );

    // 0, round(0.5) = 1 y el maximo 1: la repetida se quita
    expect(marcasDelEje(container)).toEqual(["0", "1"]);
  });

  it("pone el valor mas alto arriba del todo y el cero abajo", () => {
    const { container } = render(
      <GraficaActividad serie={serieDe(7, { escaneos: [0, 0, 0, 0, 0, 0, 10] })} />
    );

    const [cero, , maximo] = [...container.querySelectorAll(".grafica__guia")];

    expect(Number(cero.getAttribute("y1")))
      .toBeGreaterThan(Number(maximo.getAttribute("y1")));
  });
});

describe("las posiciones horizontales", () => {
  it("reparte los puntos entre los dos margenes", () => {
    const { container } = render(<GraficaActividad serie={serieDe(7)} />);

    const equis = [...container.querySelectorAll(".grafica__punto")]
      .slice(0, 7)
      .map((p) => Number(p.getAttribute("cx")));

    expect(equis[0]).toBe(34); // el margen izquierdo
    expect(equis[6]).toBe(708); // 720 - 12, el derecho
    expect([...equis].sort((a, b) => a - b)).toEqual(equis);
  });

  // Con un solo dia, (indice * ancho) / (largo - 1) seria una division por
  // cero y el punto se iria a NaN, que el navegador no dibuja.
  it("centra el punto cuando solo hay un dia", () => {
    const { container } = render(<GraficaActividad serie={serieDe(1)} />);

    const punto = container.querySelector(".grafica__punto");

    expect(Number(punto.getAttribute("cx"))).toBe(34 + (720 - 34 - 12) / 2);
  });
});

describe("las etiquetas del eje", () => {
  it("a siete dias usa el nombre del dia", () => {
    const { container } = render(<GraficaActividad serie={serieDe(7)} />);

    expect(fechasDelEje(container)).toEqual(["Jue", "Vie", "Sáb", "Dom", "Lun", "Mar", "Mié"]);
  });

  // REGRESION. La fecha llega como "2026-10-17". Pasarla por new Date() hace
  // que el navegador la lea en UTC y, en Colombia, enseñe el dia anterior.
  // Se parte la cadena a mano justamente para que no pase.
  it("a treinta dias enseña el dia correcto, sin corrimiento por UTC", () => {
    const { container } = render(<GraficaActividad serie={serieDe(30)} />);

    const etiquetas = fechasDelEje(container);

    // serieDe empieza el 1 de octubre de 2026
    expect(etiquetas[0]).toBe("1 oct");
    expect(etiquetas).not.toContain("30 sep");
  });

  it("cruza el cambio de mes sin equivocarse", () => {
    const serie = serieDe(40);
    const { container } = render(<GraficaActividad serie={serie} />);

    // Con cuarenta dias se etiqueta una de cada cinco, asi que la primera de
    // noviembre que sale es la del indice 35.
    expect(serie[35].fecha).toBe("2026-11-05");
    expect(fechasDelEje(container)).toContain("5 nov");
  });

  // Noventa etiquetas una encima de otra no se leen.
  it("con noventa dias enseña ocho o nueve fechas, no noventa", () => {
    const { container } = render(<GraficaActividad serie={serieDe(90)} />);

    expect(fechasDelEje(container).length).toBeLessThanOrEqual(9);
  });
});

describe("lo que se lee", () => {
  it("se anuncia como imagen con el numero de dias", () => {
    render(<GraficaActividad serie={serieDe(30)} />);

    expect(screen.getByRole("img", { name: /últimos 30 días/i })).toBeInTheDocument();
  });

  it("cada punto dice su fecha y su valor al pasar el cursor", () => {
    const { container } = render(
      <GraficaActividad serie={serieDe(7, { escaneos: [5, 0, 0, 0, 0, 0, 0] })} />
    );

    const titulo = container.querySelector(".grafica__punto title");

    expect(titulo.textContent).toContain("2026-10-01");
    expect(titulo.textContent).toContain("5 escaneos");
  });

  it("enseña las dos series en la leyenda", () => {
    render(<GraficaActividad serie={serieDe(7)} />);

    expect(screen.getByText("Escaneos")).toBeInTheDocument();
    expect(screen.getByText("Clics")).toBeInTheDocument();
  });

  // Con noventa puntos, los circulos se tocan y ensucian la linea.
  it("esconde los circulos cuando hay mas de treinta dias", () => {
    const { container } = render(<GraficaActividad serie={serieDe(90)} />);

    expect(container.querySelector(".grafica__punto").getAttribute("r")).toBe("0");
  });
});
