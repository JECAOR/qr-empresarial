// ============================================
// CONTENIDOPUBLICO — el contenido por secciones (RF-05)
//
// REGRESION. La API devuelve el contenido agrupado y las dos pantallas
// publicas lo tiraban: recorrian la lista plana y pintaban los bloques uno
// detras de otro. El dueño reparte su contenido en tres pestañas y quien
// visitaba la pagina no las veia separadas.
// ============================================

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ContenidoPublico from "./ContenidoPublico";

const PLATO = {
  id: "elemento-1",
  seccion: "menu",
  titulo: "Pan de masa madre",
  detalle: "Horneado cada mañana",
  categoria: "Texto",
  tipo: "texto"
};

const PROMO = {
  id: "enlace-2",
  seccion: "promos",
  titulo: "Combo desayuno",
  detalle: "https://laespiga.co/combo",
  categoria: "Sitio web",
  tipo: "enlace"
};

describe("lo que enseña", () => {
  it("un titulo por seccion, con el nombre del panel", () => {
    render(<ContenidoPublico porSeccion={{ menu: [PLATO], promos: [PROMO] }} />);

    expect(screen.getByRole("heading", { name: "Menú principal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Promociones" })).toBeInTheDocument();
  });

  it("cada bloque debajo de su seccion", () => {
    render(<ContenidoPublico porSeccion={{ menu: [PLATO], promos: [PROMO] }} />);

    const secciones = screen.getAllByRole("heading", { level: 2 });

    // El bloque del menú está dentro de la sección del menú, no suelto en la
    // página: es lo que distingue "separado por secciones" de "una lista con
    // títulos intercalados".
    expect(secciones[0].closest("section")).toHaveTextContent("Pan de masa madre");
    expect(secciones[0].closest("section")).not.toHaveTextContent("Combo desayuno");
    expect(secciones[1].closest("section")).toHaveTextContent("Combo desayuno");
  });

  it("en el orden del panel, aunque la respuesta venga al reves", () => {
    render(<ContenidoPublico porSeccion={{ promos: [PROMO], menu: [PLATO] }} />);

    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

    expect(titulos).toEqual(["Menú principal", "Promociones"]);
  });

  it("los enlaces se pueden pulsar y los textos no", () => {
    render(<ContenidoPublico porSeccion={{ menu: [PLATO], promos: [PROMO] }} />);

    expect(screen.getByRole("link", { name: PROMO.detalle })).toHaveAttribute("href", PROMO.detalle);
    expect(screen.queryByRole("link", { name: PLATO.detalle })).not.toBeInTheDocument();
  });

  // Lo lee la pantalla que cuenta los clics, por delegacion.
  it("cada enlace lleva su identificador para poder contar el clic", () => {
    render(<ContenidoPublico porSeccion={{ promos: [PROMO] }} />);

    expect(screen.getByRole("link", { name: PROMO.detalle }))
      .toHaveAttribute("data-bloque", "enlace-2");
  });
});

describe("cuando no hay nada", () => {
  // El aviso lo pone la pantalla, que sabe como se dice en cada caso: en la
  // portada es "este perfil" y en el menu es "este negocio".
  it("no dibuja nada, ni un titulo de seccion vacio", () => {
    const { container } = render(<ContenidoPublico porSeccion={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("tampoco si la respuesta no trae el agrupado", () => {
    const { container } = render(<ContenidoPublico porSeccion={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("una seccion vacia no saca su titulo", () => {
    render(<ContenidoPublico porSeccion={{ menu: [PLATO], reservas: [] }} />);

    expect(screen.queryByRole("heading", { name: "Reservaciones" })).not.toBeInTheDocument();
  });
});
