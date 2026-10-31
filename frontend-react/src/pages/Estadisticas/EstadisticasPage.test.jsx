// ============================================
// ESTADISTICASPAGE — la actividad del perfil (RF-11)
// ============================================

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import EstadisticasPage from "./EstadisticasPage";
import { respuesta, serieDe, simularFetch } from "../../pruebas/ayudas";

const DATOS = ({ totales, serie, enlaces, dias = 7 } = {}) => respuesta({
  data: {
    dias,
    totales: { escaneos: 1234, visitas: 58, clics: 17, conversion: 29.3, ...totales },
    serie: serie ?? serieDe(7, { escaneos: [3, 0, 5, 2, 1, 0, 4] }),
    enlacesMasPulsados: enlaces ?? [
      { idEnlace: 1, titulo: "Escríbenos", categoria: "WhatsApp", clics: 12 },
      { idEnlace: 2, titulo: "Cómo llegar", categoria: "Google Maps", clics: 1 }
    ]
  }
});

const SIN_ACTIVIDAD = DATOS({
  totales: { escaneos: 0, visitas: 0, clics: 0, conversion: 0 },
  enlaces: []
});

async function montar(respuestas) {
  // Primero el fetch simulado y despues el render: al reves, la pantalla pide
  // los datos antes de que haya nada preparado.
  const espia = simularFetch(respuestas);
  const vista = render(<MemoryRouter><EstadisticasPage /></MemoryRouter>);

  await screen.findByRole("heading", { name: "Actividad" });

  return { espia, ...vista };
}

describe("al abrir", () => {
  it("avisa mientras carga", () => {
    simularFetch(() => new Promise(() => {}));

    render(<MemoryRouter><EstadisticasPage /></MemoryRouter>);

    expect(screen.getByText("Cargando la actividad…")).toBeInTheDocument();
  });

  it("pide siete dias", async () => {
    const { espia } = await montar([DATOS()]);

    expect(espia.mock.calls[0][0]).toMatch(/\/estadisticas\?dias=7$/);
  });

  it("enseña las cuatro medidas", async () => {
    await montar([DATOS()]);

    expect(screen.getByText("Escaneos del QR")).toBeInTheDocument();
    expect(screen.getByText("Visitas al perfil")).toBeInTheDocument();
    expect(screen.getByText("Clics en enlaces")).toBeInTheDocument();
    expect(screen.getByText("Tasa de conversión")).toBeInTheDocument();
  });

  // Los miles como se leen en Colombia: 1.234, no 1,234 ni 1234.
  it("escribe los miles a la colombiana", async () => {
    await montar([DATOS()]);

    expect(screen.getByText("1.234")).toBeInTheDocument();
  });

  it("enseña la conversion con su signo", async () => {
    await montar([DATOS()]);

    expect(screen.getByText("29.3%")).toBeInTheDocument();
  });

  it("dibuja la grafica cuando hubo actividad", async () => {
    const { container } = await montar([DATOS()]);

    expect(container.querySelector(".grafica__lienzo")).toBeTruthy();
  });
});

describe("los tres rangos", () => {
  // Cualquier otro valor lo ignora el servidor y devuelve 7: ofrecer 14 seria
  // enseñar 7 dias diciendo que son 14.
  it("ofrece solo los que acepta el servidor", async () => {
    await montar([DATOS()]);

    const grupo = screen.getByRole("group", { name: "Periodo" });

    expect(within(grupo).getAllByRole("button").map((b) => b.textContent))
      .toEqual(["7 días", "30 días", "90 días"]);
  });

  it("marca el elegido de forma que se pueda anunciar", async () => {
    await montar([DATOS()]);

    expect(screen.getByRole("button", { name: "7 días" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "30 días" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("vuelve a pedir los datos al cambiar de rango", async () => {
    const { espia } = await montar([
      DATOS(),
      DATOS({ dias: 90, serie: serieDe(90, { escaneos: [1] }) })
    ]);

    await userEvent.click(screen.getByRole("button", { name: "90 días" }));

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));
    expect(espia.mock.calls[1][0]).toMatch(/\/estadisticas\?dias=90$/);
  });
});

describe("cuando no hay nada que contar", () => {
  // 404 es una cuenta que todavia no tiene perfil. No es una averia y no se
  // puede enseñar como si lo fuera.
  it("un 404 no se enseña como error", async () => {
    await montar([respuesta({ message: "No encontrado" }, { status: 404 })]);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/Todavía no hay nada que contar/)).toBeInTheDocument();
  });

  it("y ofrece ir a crear el perfil", async () => {
    await montar([respuesta({ message: "No encontrado" }, { status: 404 })]);

    expect(screen.getByRole("link", { name: "Mi negocio" }))
      .toHaveAttribute("href", "/perfil");
  });

  // Un error de verdad si se enseña: no es lo mismo no tener perfil que no
  // poder preguntar.
  it("otro error si se enseña", async () => {
    await montar([respuesta({ message: "No autorizado" }, { status: 401 })]);

    expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
  });

  // Hay perfil, pero nadie lo ha usado en este periodo: una grafica de ceros
  // no dice nada.
  it("con perfil pero sin actividad enseña las cifras y explica el vacio", async () => {
    const { container } = await montar([SIN_ACTIVIDAD]);

    expect(screen.getByText(/Sin actividad en este periodo/)).toBeInTheDocument();
    expect(container.querySelector(".grafica__lienzo")).toBeNull();
    expect(screen.getByText("Escaneos del QR")).toBeInTheDocument();
  });
});

describe("los enlaces mas pulsados", () => {
  it("los enumera con sus clics", async () => {
    await montar([DATOS()]);

    const lista = screen.getByRole("list");

    expect(within(lista).getByText("Escríbenos")).toBeInTheDocument();
    expect(within(lista).getByText("12 clics")).toBeInTheDocument();
  });

  // "1 clics" se lee mal.
  it("dice un clic en singular", async () => {
    await montar([DATOS()]);

    expect(screen.getByText("1 clic")).toBeInTheDocument();
  });

  it("la barra del primero ocupa todo y las demas en proporcion", async () => {
    const { container } = await montar([DATOS()]);

    const [primera, segunda] = container.querySelectorAll(".enlace__barra span");

    expect(primera.style.width).toBe("100%");
    expect(segunda.style.width).toBe(`${(1 / 12) * 100}%`);
  });

  it("dice que nadie ha pulsado nada en lugar de dejar una lista vacia", async () => {
    await montar([SIN_ACTIVIDAD]);

    expect(screen.getByText(/Nadie ha pulsado un enlace todavía/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
