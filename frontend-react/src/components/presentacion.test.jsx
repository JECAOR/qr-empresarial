// ============================================
// LAS PIEZAS DE PRESENTACION
//
// CampoTexto, TarjetaContenido, FichaNegocio y SelectorTema no guardan nada
// ni llaman a la API: reciben props y dibujan. Van juntas porque lo que hay
// que comprobar en cada una cabe en pocas lineas.
// ============================================

import { fireEvent, render, screen } from "@testing-library/react";
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
    horario: "Lun-Sáb 7:00-20:00",
    instagram: "@laespiga",
    correoContacto: "contacto@laespiga.co",
    imagen: "https://laespiga.co/logo.png"
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

  // REGRESION. Esta ficha enseñaba seis de los once campos que devuelve la
  // API publica: el logo, el Instagram y el correo de contacto se quedaban
  // fuera. El dueño los rellena en su perfil y el visitante no los veia.
  describe("los tres campos que no se enseñaban", () => {
    it("el logo del negocio", () => {
      const { container } = render(<FichaNegocio perfil={COMPLETO} />);

      expect(container.querySelector(".ficha__logo"))
        .toHaveAttribute("src", "https://laespiga.co/logo.png");
    });

    // El nombre esta escrito al lado: con un alt que lo repita, un lector de
    // pantalla lo dice dos veces.
    it("sin repetir el nombre en el texto alternativo", () => {
      const { container } = render(<FichaNegocio perfil={COMPLETO} />);

      expect(container.querySelector(".ficha__logo")).toHaveAttribute("alt", "");
    });

    // Una direccion que ya no sirve dejaria el icono roto del navegador.
    it("y si la imagen no carga, desaparece", () => {
      const { container } = render(<FichaNegocio perfil={COMPLETO} />);

      fireEvent.error(container.querySelector(".ficha__logo"));

      expect(container.querySelector(".ficha__logo")).toBeNull();
      expect(screen.getByRole("heading", { name: "Panadería La Espiga" }))
        .toBeInTheDocument();
    });

    it("sin logo no se deja un hueco", () => {
      const { container } = render(<FichaNegocio perfil={{ nombreNegocio: "X" }} />);

      expect(container.querySelector(".ficha__logo")).toBeNull();
    });

    it("el Instagram, enlazado a su perfil", () => {
      render(<FichaNegocio perfil={COMPLETO} />);

      expect(screen.getByRole("link", { name: "@laespiga" }))
        .toHaveAttribute("href", "https://instagram.com/laespiga");
    });

    it("el correo de contacto, listo para escribir", () => {
      render(<FichaNegocio perfil={COMPLETO} />);

      expect(screen.getByRole("link", { name: "contacto@laespiga.co" }))
        .toHaveAttribute("href", "mailto:contacto@laespiga.co");
    });
  });

  // El frontend original convertia estos datos en botones: llamar, WhatsApp,
  // como llegar, Instagram y escribir. Aqui eran texto plano, y esto se lee
  // en un telefono recien escaneado el codigo.
  describe("lo que ahora se puede pulsar", () => {
    it("el telefono llama", () => {
      render(<FichaNegocio perfil={COMPLETO} />);

      expect(screen.getByRole("link", { name: "+57 301 222 3344" }))
        .toHaveAttribute("href", "tel:+573012223344");
    });

    it("la direccion abre el mapa", () => {
      render(<FichaNegocio perfil={COMPLETO} />);

      expect(screen.getByRole("link", { name: "Av. 68 #40-12" }))
        .toHaveAttribute("href", "https://maps.google.com/?q=Av.%2068%20%2340-12");
    });

    it("el horario no es un enlace: no lleva a ninguna parte", () => {
      render(<FichaNegocio perfil={COMPLETO} />);

      expect(screen.queryByRole("link", { name: "Lun-Sáb 7:00-20:00" })).not.toBeInTheDocument();
    });

    // Los que salen de la aplicacion abren pestaña nueva, para no perder la
    // pagina del negocio. tel: y mailto: no: los atiende el propio telefono.
    it("los que salen fuera abren en otra pestaña, protegidos", () => {
      render(<FichaNegocio perfil={COMPLETO} />);

      for (const nombre of ["Av. 68 #40-12", "WhatsApp", "@laespiga"]) {
        const enlace = screen.getByRole("link", { name: nombre });

        expect(enlace).toHaveAttribute("target", "_blank");
        expect(enlace).toHaveAttribute("rel", expect.stringContaining("noopener"));
      }
    });

    it("llamar y escribir se quedan en la misma pestaña", () => {
      render(<FichaNegocio perfil={COMPLETO} />);

      for (const nombre of ["+57 301 222 3344", "contacto@laespiga.co"]) {
        expect(screen.getByRole("link", { name: nombre })).not.toHaveAttribute("target");
      }
    });
  });

  describe("el enlace de WhatsApp", () => {
    const con = (telefono) => render(<FichaNegocio perfil={{ nombreNegocio: "X", telefono }} />);

    it("usa el numero con indicativo tal cual", () => {
      con("+57 301 222 3344");

      expect(screen.getByRole("link", { name: "WhatsApp" }))
        .toHaveAttribute("href", "https://wa.me/573012223344");
    });

    // Es como lo escribe medio mundo aqui: diez digitos empezando por 3.
    it("le pone el 57 a un movil colombiano sin indicativo", () => {
      con("301 222 3344");

      expect(screen.getByRole("link", { name: "WhatsApp" }))
        .toHaveAttribute("href", "https://wa.me/573012223344");
    });

    // Un wa.me armado a medias no lleva a un numero equivocado: lleva a una
    // conversacion con un desconocido. Mejor no ofrecerlo.
    it("no se ofrece con un fijo, del que no se puede deducir", () => {
      con("601 123 4567");

      expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "601 123 4567" }))
        .toHaveAttribute("href", "tel:6011234567");
    });

    it("ni con una extension corta", () => {
      con("123 45");

      expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
    });
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
