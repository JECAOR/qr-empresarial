// ============================================
// LAS PIEZAS DE PRESENTACION
//
// CampoTexto, TarjetaContenido, FichaNegocio y SelectorTema no guardan nada
// ni llaman a la API: reciben props y dibujan. Van juntas porque lo que hay
// que comprobar en cada una cabe en pocas lineas.
// ============================================

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CampoTexto from "./Formulario/CampoTexto";
import TarjetaContenido from "./TarjetaContenido/TarjetaContenido";
import FichaNegocio from "./FichaNegocio/FichaNegocio";
import SelectorTema from "./perfil/SelectorTema/SelectorTema";

describe("CampoTexto", () => {
  it("ata la etiqueta al campo, que es lo que lo hace accesible", () => {
    render(<CampoTexto id="correo" etiqueta="Correo electrónico" />);

    const campo = screen.getByLabelText("Correo electrónico");

    expect(campo).toHaveAttribute("id", "correo");
  });

  // El name le hace falta al formulario para mandar el campo y a los
  // gestores de contrasenas para reconocerlo.
  it("usa el id tambien como name", () => {
    render(<CampoTexto id="contrasena" etiqueta="Contraseña" />);

    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("name", "contrasena");
  });

  it("enseña la ayuda cuando la hay", () => {
    render(<CampoTexto id="c" etiqueta="Contraseña" ayuda="Mínimo 8 caracteres" />);

    expect(screen.getByText("Mínimo 8 caracteres")).toBeInTheDocument();
  });

  it("no deja un hueco de ayuda vacio", () => {
    const { container } = render(<CampoTexto id="c" etiqueta="Correo" />);

    expect(container.querySelector(".campo__ayuda")).toBeNull();
  });

  it("deja pasar los atributos del input", () => {
    render(
      <CampoTexto id="correo" etiqueta="Correo" type="email" required placeholder="a@b.co" />
    );

    const campo = screen.getByLabelText("Correo");

    expect(campo).toHaveAttribute("type", "email");
    expect(campo).toBeRequired();
    expect(campo).toHaveAttribute("placeholder", "a@b.co");
  });

  it("escribe lo que se teclea", async () => {
    render(<CampoTexto id="nombre" etiqueta="Nombre" />);

    await userEvent.type(screen.getByLabelText("Nombre"), "La Espiga");

    expect(screen.getByLabelText("Nombre")).toHaveValue("La Espiga");
  });
});

describe("TarjetaContenido", () => {
  const base = { titulo: "Escríbenos", categoria: "WhatsApp" };

  // Un enlace y un boton llevan a otro sitio y tienen que poder pulsarse; un
  // texto solo se lee.
  it.each(["enlace", "boton"])("dibuja un %s como enlace pulsable", (tipo) => {
    render(<TarjetaContenido {...base} tipo={tipo} detalle="https://wa.me/57300" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "https://wa.me/57300");
  });

  it("dibuja un texto como parrafo, no como enlace", () => {
    render(<TarjetaContenido {...base} tipo="texto" detalle="Abrimos de 7 a 20" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Abrimos de 7 a 20")).toBeInTheDocument();
  });

  // Sin noopener, la pagina de destino puede manipular la nuestra por
  // window.opener.
  it("abre fuera con noreferrer y noopener", () => {
    render(<TarjetaContenido {...base} tipo="enlace" detalle="https://ejemplo.co" />);

    const enlace = screen.getByRole("link");

    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace.getAttribute("rel")).toContain("noopener");
    expect(enlace.getAttribute("rel")).toContain("noreferrer");
  });

  it("enseña el titulo y la categoria", () => {
    render(<TarjetaContenido {...base} tipo="texto" detalle="x" />);

    expect(screen.getByRole("heading", { name: "Escríbenos" })).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });
});

describe("FichaNegocio", () => {
  const COMPLETO = {
    nombreNegocio: "Panadería La Espiga",
    categoria: "Panadería",
    descripcion: "Pan de masa madre",
    direccion: "Av. 68 #40-12",
    telefono: "+57 301 222 3344",
    horario: "Lun-Sáb 7:00-20:00"
  };

  it("enseña todos los datos que tiene", () => {
    render(<FichaNegocio perfil={COMPLETO} />);

    expect(screen.getByRole("heading", { name: "Panadería La Espiga" })).toBeInTheDocument();
    expect(screen.getByText("Av. 68 #40-12")).toBeInTheDocument();
    expect(screen.getByText("+57 301 222 3344")).toBeInTheDocument();
    expect(screen.getByText("Lun-Sáb 7:00-20:00")).toBeInTheDocument();
  });

  // Una etiqueta sin valor -"Teléfono:" a secas- es peor que no enseñar nada.
  it("omite los campos vacios en lugar de dejar etiquetas sueltas", () => {
    render(<FichaNegocio perfil={{ nombreNegocio: "Solo el nombre" }} />);

    expect(screen.queryByText("Teléfono")).not.toBeInTheDocument();
    expect(screen.queryByText("Dirección")).not.toBeInTheDocument();
    expect(screen.queryByText("Horario")).not.toBeInTheDocument();
  });

  // La API guarda los campos vacios como NULL, pero una cadena vacia tambien
  // tiene que omitirse: "sin telefono" y "telefono igual a nada" no son dos
  // cosas distintas.
  it("trata una cadena vacia igual que un campo ausente", () => {
    render(<FichaNegocio perfil={{ nombreNegocio: "X", telefono: "", direccion: null }} />);

    expect(screen.queryByText("Teléfono")).not.toBeInTheDocument();
    expect(screen.queryByText("Dirección")).not.toBeInTheDocument();
  });

  it("el nombre del negocio sale siempre, que es el unico obligatorio", () => {
    render(<FichaNegocio perfil={{ nombreNegocio: "Café Raíces" }} />);

    expect(screen.getByRole("heading", { name: "Café Raíces" })).toBeInTheDocument();
  });
});

describe("SelectorTema", () => {
  it("ofrece los tres colores que acepta el validador", () => {
    render(<SelectorTema valor="indigo" onElegir={() => {}} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText("Índigo")).toBeInTheDocument();
    expect(screen.getByText("Esmeralda")).toBeInTheDocument();
    expect(screen.getByText("Terracota")).toBeInTheDocument();
  });

  // aria-pressed y no solo una clase: asi un lector de pantalla dice cual
  // esta elegido.
  it("marca el elegido de forma que se pueda anunciar", () => {
    render(<SelectorTema valor="teal" onElegir={() => {}} />);

    expect(screen.getByRole("button", { name: /Esmeralda/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Índigo/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("avisa con el valor que entiende el servidor, no con el nombre visible", async () => {
    const elegir = vi.fn();

    render(<SelectorTema valor="indigo" onElegir={elegir} />);

    await userEvent.click(screen.getByRole("button", { name: /Terracota/ }));

    expect(elegir).toHaveBeenCalledWith("terracota");
  });

  it("se apaga mientras se guarda", () => {
    render(<SelectorTema valor="indigo" onElegir={() => {}} guardando />);

    for (const boton of screen.getAllByRole("button")) expect(boton).toBeDisabled();
  });
});
