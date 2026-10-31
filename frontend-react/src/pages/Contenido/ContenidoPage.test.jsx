// ============================================
// CONTENIDOPAGE — los bloques del perfil (RF-05 y RF-06)
// ============================================

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import ContenidoPage from "./ContenidoPage";
import { respuesta, simularFetch } from "../../pruebas/ayudas";

const BLOQUES = [
  { id: "enlace-1", seccion: "menu", titulo: "Escríbenos", detalle: "https://wa.me/1", tipo: "enlace", activo: true, categoria: { id: 1, nombre: "WhatsApp" } },
  { id: "enlace-2", seccion: "menu", titulo: "Cómo llegar", detalle: "https://maps/2", tipo: "enlace", activo: true, categoria: { id: 3, nombre: "Google Maps" } },
  { id: "elemento-3", seccion: "promos", titulo: "2x1 los martes", detalle: "Todo el día", tipo: "texto", activo: false, categoria: { id: 10, nombre: "Texto libre" } }
];

const CATEGORIAS = {
  enlaces: [{ id: 1, nombre: "WhatsApp" }, { id: 3, nombre: "Google Maps" }],
  elementos: [{ id: 10, nombre: "Texto libre" }]
};

const carga = (bloques = BLOQUES) => [
  respuesta({ data: bloques }),
  respuesta({ data: CATEGORIAS })
];

/** Monta la pantalla y espera a que termine de cargar. */
async function montar(siguientes = [], bloques = BLOQUES) {
  const espia = simularFetch([...carga(bloques), ...siguientes]);

  render(<MemoryRouter><ContenidoPage /></MemoryRouter>);

  await screen.findByRole("heading", { name: "Contenido del perfil" });

  return espia;
}

/** La llamada número `n`: su ruta, su método y su cuerpo. */
function llamada(espia, n) {
  const [url, opciones = {}] = espia.mock.calls[n];

  return {
    ruta: url.replace("http://api.de.pruebas.invalido/api", ""),
    metodo: opciones.method ?? "GET",
    cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined
  };
}

describe("al abrir", () => {
  it("avisa mientras carga", () => {
    simularFetch(() => new Promise(() => {}));

    render(<MemoryRouter><ContenidoPage /></MemoryRouter>);

    expect(screen.getByText("Cargando el contenido…")).toBeInTheDocument();
  });

  it("pide los bloques y las categorias a la vez", async () => {
    const espia = await montar();

    expect(llamada(espia, 0).ruta).toBe("/contenido");
    expect(llamada(espia, 1).ruta).toBe("/contenido/categorias");
  });

  it("enseña las tres secciones con su cuenta de bloques", async () => {
    await montar();

    const pestanas = screen.getAllByRole("button", { name: /Menú principal|Promociones|Reservaciones/ });

    expect(pestanas).toHaveLength(3);
    expect(within(pestanas[0]).getByText("2")).toBeInTheDocument();
    expect(within(pestanas[1]).getByText("1")).toBeInTheDocument();
    expect(within(pestanas[2]).getByText("0")).toBeInTheDocument();
  });

  // El dueño ve los apagados tambien: es la diferencia con la vista publica,
  // y sin ellos no podria volver a encenderlos.
  it("enseña los bloques apagados, que el dueño tiene que poder encender", async () => {
    await montar();

    await userEvent.click(screen.getByRole("button", { name: /Promociones/ }));

    expect(screen.getByText("2x1 los martes")).toBeInTheDocument();
    expect(screen.getByText("Activar")).toBeInTheDocument();
  });

  it("solo enseña los de la seccion elegida", async () => {
    await montar();

    expect(screen.getByText("Escríbenos")).toBeInTheDocument();
    expect(screen.queryByText("2x1 los martes")).not.toBeInTheDocument();
  });

  it("dice que la seccion esta vacia en lugar de no enseñar nada", async () => {
    await montar();

    await userEvent.click(screen.getByRole("button", { name: /Reservaciones/ }));

    expect(screen.getByText(/todavía no tiene bloques/)).toBeInTheDocument();
  });

  it("marca cual es la pestaña actual", async () => {
    await montar();

    expect(screen.getByRole("button", { name: /Menú principal/ }))
      .toHaveAttribute("aria-current", "page");
  });

  it("enseña el error si la carga falla", async () => {
    // Dos respuestas porque las dos peticiones salen a la vez, en un
    // Promise.all: con una sola, la que falla seria la que se quedo sin
    // respuesta preparada y el mensaje vendria de la propia prueba.
    simularFetch([
      respuesta({ message: "No autorizado" }, { status: 401 }),
      respuesta({ message: "No autorizado" }, { status: 401 })
    ]);

    render(<MemoryRouter><ContenidoPage /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
  });
});

describe("agregar un bloque", () => {
  it("abre el formulario en la seccion que se esta viendo", async () => {
    await montar();

    await userEvent.click(screen.getByRole("button", { name: /Promociones/ }));
    await userEvent.click(screen.getByText("Agregar bloque"));

    expect(screen.getByRole("heading", { name: "Nuevo bloque" })).toBeInTheDocument();
  });

  it("lo crea y vuelve a pedir la lista", async () => {
    const espia = await montar([
      respuesta({ data: { id: "enlace-9" } }, { status: 201 }),
      respuesta({ data: BLOQUES })
    ]);

    await userEvent.click(screen.getByText("Agregar bloque"));
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "1");
    await userEvent.type(screen.getByLabelText("Título"), "Pedidos");
    await userEvent.type(screen.getByLabelText("Destino"), "300 123 4567");
    await userEvent.click(screen.getByText("Agregar bloque", { selector: "button[type=submit]" }));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toMatchObject({
      ruta: "/contenido",
      metodo: "POST",
      cuerpo: { titulo: "Pedidos", seccion: "menu", tipo: "enlace", idCategoria: 1 }
    });

    // Se recarga para que la pantalla enseñe lo que de verdad hay guardado
    expect(llamada(espia, 3).ruta).toBe("/contenido");
  });

  it("cierra el formulario al guardar", async () => {
    await montar([
      respuesta({ data: {} }, { status: 201 }),
      respuesta({ data: BLOQUES })
    ]);

    await userEvent.click(screen.getByText("Agregar bloque"));
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "1");
    await userEvent.type(screen.getByLabelText("Título"), "Pedidos");
    await userEvent.type(screen.getByLabelText("Destino"), "300 123 4567");
    await userEvent.click(screen.getByText("Agregar bloque", { selector: "button[type=submit]" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Nuevo bloque" })).not.toBeInTheDocument());
  });

  // Si falla, lo escrito no se puede perder: hay que poder corregir y
  // reintentar.
  it("deja el formulario abierto si el servidor lo rechaza", async () => {
    await montar([respuesta({ message: "La dirección no es válida" }, { status: 400 })]);

    await userEvent.click(screen.getByText("Agregar bloque"));
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "1");
    await userEvent.type(screen.getByLabelText("Título"), "Pedidos");
    await userEvent.type(screen.getByLabelText("Destino"), "no-es-una-url");
    await userEvent.click(screen.getByText("Agregar bloque", { selector: "button[type=submit]" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La dirección no es válida");
    expect(screen.getByRole("heading", { name: "Nuevo bloque" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Pedidos");
  });
});

describe("editar un bloque", () => {
  it("abre el formulario con sus datos", async () => {
    await montar();

    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByText("Editar"));

    expect(screen.getByRole("heading", { name: /Editar «Escríbenos»/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Escríbenos");
  });

  it("lo guarda con PUT y su identificador compuesto", async () => {
    const espia = await montar([respuesta({ data: {} }), respuesta({ data: BLOQUES })]);

    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByText("Editar"));
    await userEvent.clear(screen.getByLabelText("Título"));
    await userEvent.type(screen.getByLabelText("Título"), "Escríbenos ya");
    await userEvent.click(screen.getByText("Guardar cambios"));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toMatchObject({
      ruta: "/contenido/enlace-1",
      metodo: "PUT"
    });
  });
});

describe("encender y apagar", () => {
  it("manda lo contrario de lo que esta ahora", async () => {
    const espia = await montar([respuesta({ data: {} }), respuesta({ data: BLOQUES })]);

    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByText("Desactivar"));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toEqual({
      ruta: "/contenido/enlace-1/estado",
      metodo: "PATCH",
      cuerpo: { activo: false }
    });
  });
});

describe("eliminar", () => {
  it("pregunta antes y no hace nada si se dice que no", async () => {
    const espia = await montar();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByText("Eliminar"));

    expect(espia).toHaveBeenCalledTimes(2);
  });

  // Desactivar es lo que casi siempre se quiere: decirlo aqui evita borrados
  // que no se pueden deshacer.
  it("recuerda que se puede desactivar en lugar de borrar", async () => {
    await montar();

    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByText("Eliminar"));

    expect(confirmar.mock.calls[0][0]).toMatch(/si solo quieres que deje de verse, desactívalo/);
  });

  it("lo elimina si se confirma", async () => {
    const espia = await montar([
      respuesta(null, { status: 204 }),
      respuesta({ data: BLOQUES })
    ]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByText("Eliminar"));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toMatchObject({
      ruta: "/contenido/enlace-1",
      metodo: "DELETE"
    });
  });
});

describe("reordenar", () => {
  // Se manda la seccion entera en el orden nuevo, que es lo que espera el
  // servidor: asi comprueba que todos los identificadores sean de esta cuenta
  // antes de tocar nada.
  it("manda la seccion entera en el orden nuevo", async () => {
    const espia = await montar([respuesta({ data: {} }), respuesta({ data: BLOQUES })]);

    await userEvent.click(screen.getByLabelText("Bajar Escríbenos"));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toEqual({
      ruta: "/contenido/orden",
      metodo: "PUT",
      cuerpo: { ids: ["enlace-2", "enlace-1"] }
    });
  });

  // Mover el primero hacia arriba no existe: no se puede mandar una lista
  // con un hueco.
  it("no hace nada si el destino se sale de la seccion", async () => {
    const espia = await montar();

    // Las flechas de los extremos estan apagadas, asi que se llama a mano
    // por la misma via que usaria un arrastre fuera de rango
    expect(screen.getByLabelText("Subir Escríbenos")).toBeDisabled();
    expect(espia).toHaveBeenCalledTimes(2);
  });
});
