// ============================================
// FORMULARIOBLOQUE y FORMULARIOUSUARIO
//
// Los dos tienen la misma trampa: lo que mandan al servidor no es lo que se
// ve en la pantalla. El de bloque omite el tipo al editar, y el de usuario
// omite la contrasena. Mandar de mas da 400 o pisa algo.
// ============================================

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import FormularioBloque from "./contenido/FormularioBloque/FormularioBloque";
import FormularioUsuario from "./usuarios/FormularioUsuario/FormularioUsuario";

const CATEGORIAS = {
  enlaces: [
    { id: 1, nombre: "WhatsApp" },
    { id: 2, nombre: "Instagram" },
    { id: 3, nombre: "Google Maps" }
  ],
  elementos: [
    { id: 10, nombre: "Texto libre" },
    { id: 11, nombre: "Botón" }
  ]
};

describe("FormularioBloque", () => {
  const props = (extra = {}) => ({
    seccion: "principal",
    categorias: CATEGORIAS,
    onGuardar: vi.fn(),
    onCancelar: vi.fn(),
    guardando: false,
    ...extra
  });

  describe("al crear", () => {
    it("arranca como enlace y ofrece las categorias de enlace", () => {
      render(<FormularioBloque {...props()} />);

      expect(screen.getByRole("heading", { name: "Nuevo bloque" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "WhatsApp" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Texto libre" })).not.toBeInTheDocument();
    });

    // Cada tipo saca la categoria de una lista distinta; mezclarlas da 400.
    it("cambia la lista de categorias al cambiar de tipo", async () => {
      render(<FormularioBloque {...props()} />);

      await userEvent.click(screen.getByRole("radio", { name: /Texto/ }));

      expect(screen.getByRole("option", { name: "Texto libre" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "WhatsApp" })).not.toBeInTheDocument();
    });

    // La categoria elegida pertenecia a la otra lista: mandarla daria 400.
    it("olvida la categoria elegida al cambiar de tipo", async () => {
      const p = props();

      render(<FormularioBloque {...p} />);

      await userEvent.selectOptions(screen.getByLabelText("Categoría"), "2");
      await userEvent.click(screen.getByRole("radio", { name: /Texto/ }));

      expect(screen.getByLabelText("Categoría")).toHaveValue("");
    });

    it("un bloque de texto se escribe en un area, no en una linea", async () => {
      render(<FormularioBloque {...props()} />);

      expect(screen.getByLabelText("Destino").tagName).toBe("INPUT");

      await userEvent.click(screen.getByRole("radio", { name: /Texto/ }));

      expect(screen.getByLabelText("Texto").tagName).toBe("TEXTAREA");
    });

    // El servidor arma el enlace de wa.me a partir del telefono, asi que
    // pedir una direccion aqui confundiria.
    it("con WhatsApp pide un telefono y no una direccion", async () => {
      render(<FormularioBloque {...props()} />);

      await userEvent.selectOptions(screen.getByLabelText("Categoría"), "1");

      expect(screen.getByLabelText("Destino")).toHaveAttribute("placeholder", "300 123 4567");
      expect(screen.getByText(/el servidor arma el enlace/i)).toBeInTheDocument();
    });

    it("manda el tipo, la seccion y los textos sin espacios de sobra", async () => {
      const p = props();

      render(<FormularioBloque {...p} />);

      await userEvent.selectOptions(screen.getByLabelText("Categoría"), "3");
      await userEvent.type(screen.getByLabelText("Título"), "  Cómo llegar  ");
      await userEvent.type(screen.getByLabelText("Destino"), " https://maps.app/x ");
      await userEvent.click(screen.getByText("Agregar bloque"));

      expect(p.onGuardar).toHaveBeenCalledWith({
        titulo: "Cómo llegar",
        detalle: "https://maps.app/x",
        idCategoria: 3,
        seccion: "principal",
        tipo: "enlace"
      });
    });

    // El select devuelve cadenas y el validador espera un numero.
    it("manda la categoria como numero", async () => {
      const p = props();

      render(<FormularioBloque {...p} />);

      await userEvent.selectOptions(screen.getByLabelText("Categoría"), "2");
      await userEvent.type(screen.getByLabelText("Título"), "Instagram");
      await userEvent.type(screen.getByLabelText("Destino"), "https://instagram.com/x");
      await userEvent.click(screen.getByText("Agregar bloque"));

      expect(p.onGuardar.mock.calls[0][0].idCategoria).toBe(2);
    });
  });

  describe("al editar", () => {
    const BLOQUE = {
      id: "enlace-4",
      tipo: "enlace",
      titulo: "Síguenos",
      detalle: "https://instagram.com/laespiga",
      categoria: { id: 2, nombre: "Instagram" }
    };

    it("llega con los datos del bloque puestos", () => {
      render(<FormularioBloque {...props({ inicial: BLOQUE })} />);

      expect(screen.getByRole("heading", { name: /Editar «Síguenos»/ })).toBeInTheDocument();
      expect(screen.getByLabelText("Título")).toHaveValue("Síguenos");
      expect(screen.getByLabelText("Categoría")).toHaveValue("2");
    });

    // Cambiar el tipo seria mover la fila de una tabla a otra, y el backend
    // no lo admite en PUT.
    it("enseña el tipo pero no deja cambiarlo, y lo dice", () => {
      render(<FormularioBloque {...props({ inicial: BLOQUE })} />);

      expect(screen.getByRole("radio", { name: /Enlace/ })).toBeDisabled();
      expect(screen.getByText("no se puede cambiar")).toBeInTheDocument();
    });

    // En PUT el backend lo ignora; mandarlo haria creer que se puede cambiar.
    it("no manda el tipo al guardar", async () => {
      const p = props({ inicial: BLOQUE });

      render(<FormularioBloque {...p} />);

      await userEvent.click(screen.getByText("Guardar cambios"));

      expect(p.onGuardar).toHaveBeenCalledWith({
        titulo: "Síguenos",
        detalle: "https://instagram.com/laespiga",
        idCategoria: 2,
        seccion: "principal"
      });
      expect(p.onGuardar.mock.calls[0][0]).not.toHaveProperty("tipo");
    });
  });

  it("se apaga mientras guarda y lo dice", () => {
    render(<FormularioBloque {...props({ guardando: true })} />);

    expect(screen.getByText("Guardando…")).toBeDisabled();
  });

  it("cancelar no guarda nada", async () => {
    const p = props();

    render(<FormularioBloque {...p} />);

    await userEvent.click(screen.getByText("Cancelar"));

    expect(p.onCancelar).toHaveBeenCalled();
    expect(p.onGuardar).not.toHaveBeenCalled();
  });
});

describe("FormularioUsuario", () => {
  const props = (extra = {}) => ({
    onGuardar: vi.fn(),
    onCancelar: vi.fn(),
    guardando: false,
    ...extra
  });

  const USUARIO = {
    idUsuario: 7,
    nombre: "Panadería La Espiga",
    correo: "contacto@laespiga.co",
    rol: "empresa"
  };

  describe("al crear", () => {
    it("arranca vacio, con el rol empresa", () => {
      render(<FormularioUsuario {...props()} />);

      expect(screen.getByRole("heading", { name: "Nueva cuenta" })).toBeInTheDocument();
      expect(screen.getByLabelText("Nombre")).toHaveValue("");
      expect(screen.getByLabelText("Rol")).toHaveValue("empresa");
    });

    // El ejemplo de la guia tiene cuatro roles; el validador de esta API
    // acepta dos y rechaza cualquier otro.
    it("ofrece los dos roles que acepta el validador, no cuatro", () => {
      render(<FormularioUsuario {...props()} />);

      const opciones = screen.getAllByRole("option").map((o) => o.value);

      expect(opciones).toEqual(["empresa", "administrador"]);
    });

    // El <small> de la ayuda va dentro del <label>, asi que el nombre
    // accesible del campo es "Contraseña Mínimo 8 caracteres…". Se busca por
    // expresion regular en lugar de cambiar el componente: tener la regla en
    // el nombre no estorba, se la lee quien use un lector de pantalla.
    it("pide la contrasena y explica que exige", () => {
      render(<FormularioUsuario {...props()} />);

      expect(screen.getByLabelText(/Contraseña/)).toHaveAttribute("type", "password");
      expect(screen.getByText(/Mínimo 8 caracteres/)).toBeInTheDocument();
    });

    it("manda los cuatro campos, sin espacios de sobra", async () => {
      const p = props();

      render(<FormularioUsuario {...p} />);

      await userEvent.type(screen.getByLabelText("Nombre"), "  Café Raíces  ");
      await userEvent.type(screen.getByLabelText("Correo"), " hola@caferaices.co ");
      await userEvent.selectOptions(screen.getByLabelText("Rol"), "administrador");
      await userEvent.type(screen.getByLabelText(/Contraseña/), "Clave123*");
      await userEvent.click(screen.getByText("Guardar"));

      expect(p.onGuardar).toHaveBeenCalledWith({
        nombre: "Café Raíces",
        correo: "hola@caferaices.co",
        rol: "administrador",
        contrasena: "Clave123*"
      });
    });
  });

  describe("al editar", () => {
    it("llega con los datos de la cuenta", () => {
      render(<FormularioUsuario {...props({ inicial: USUARIO })} />);

      expect(screen.getByRole("heading", { name: /Editar a Panadería La Espiga/ }))
        .toBeInTheDocument();
      expect(screen.getByLabelText("Correo")).toHaveValue("contacto@laespiga.co");
    });

    // PUT no la toca y para cambiarla esta su propia ruta. Pedirla aqui haria
    // creer que se cambia.
    it("no pide la contrasena", () => {
      render(<FormularioUsuario {...props({ inicial: USUARIO })} />);

      expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    });

    it("no la manda tampoco", async () => {
      const p = props({ inicial: USUARIO });

      render(<FormularioUsuario {...p} />);

      await userEvent.click(screen.getByText("Guardar"));

      expect(p.onGuardar.mock.calls[0][0]).not.toHaveProperty("contrasena");
    });
  });

  // Los campos arrancan una sola vez a proposito, sin sincronizarse con un
  // efecto: quien lo usa le pasa un key distinto por cuenta. Sin ese key, al
  // cambiar de cuenta se seguirian viendo los datos de la anterior.
  it("se rellena de nuevo al montarse con otra cuenta, por el key", () => {
    const { rerender } = render(
      <FormularioUsuario key={7} {...props({ inicial: USUARIO })} />
    );

    expect(screen.getByLabelText("Nombre")).toHaveValue("Panadería La Espiga");

    rerender(
      <FormularioUsuario key={9} {...props({ inicial: { ...USUARIO, idUsuario: 9, nombre: "Café Raíces" } })} />
    );

    expect(screen.getByLabelText("Nombre")).toHaveValue("Café Raíces");
  });

  it("se apaga mientras guarda", () => {
    render(<FormularioUsuario {...props({ guardando: true })} />);

    expect(screen.getByText("Guardando…")).toBeDisabled();
  });
});
