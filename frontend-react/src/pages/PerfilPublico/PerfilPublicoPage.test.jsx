// ============================================
// PERFILPUBLICOPAGE — lo que ve quien escanea el codigo
//
// Es la unica pantalla sin sesion. Se prueba sobre todo que no pise una
// respuesta con otra: se puede consultar un negocio y, antes de que conteste,
// consultar otro.
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PerfilPublicoPage from "./PerfilPublicoPage";
import { agruparPorSeccion, respuesta, simularFetch } from "../../pruebas/ayudas";

// Las dos formas en que llega el contenido, igual que en publico.service.js:
// la lista plana y la misma lista agrupada. La pantalla usa la agrupada.
const PERFIL = (nombre = "Panadería La Espiga", contenido = []) => respuesta({
  data: {
    perfil: { nombreNegocio: nombre, categoria: "Panadería", telefono: "+57 301 222 3344" },
    contenido,
    porSeccion: agruparPorSeccion(contenido)
  }
});

const BLOQUES = [
  { id: "enlace-1", seccion: "menu", titulo: "Escríbenos", detalle: "https://wa.me/57300", categoria: "WhatsApp", tipo: "enlace" },
  { id: "elemento-2", seccion: "menu", titulo: "Horneamos cada mañana", detalle: "Pan de masa madre", categoria: "Texto", tipo: "texto" },
  { id: "enlace-3", seccion: "promos", titulo: "Combo desayuno", detalle: "https://laespiga.co/combo", categoria: "Sitio web", tipo: "enlace" }
];

const montar = (ruta = "/") =>
  render(<MemoryRouter initialEntries={[ruta]}><PerfilPublicoPage /></MemoryRouter>);

describe("al abrir", () => {
  // Sale de .env para no dejar escrito en el codigo un dato que cambia de una
  // instalacion a otra.
  it("consulta el negocio de .env", async () => {
    const espia = simularFetch([PERFIL()]);

    montar();

    await waitFor(() => expect(espia).toHaveBeenCalled());
    expect(espia.mock.calls[0][0]).toMatch(/\/publico\/panaderia-la-espiga$/);
  });

  // Es lo que usa "Ver la página pública" desde la pantalla del perfil.
  it("la direccion manda sobre el valor por defecto", async () => {
    const espia = simularFetch([PERFIL("Café Raíces")]);

    montar("/?slug=cafe-raices");

    await waitFor(() => expect(espia).toHaveBeenCalled());
    expect(espia.mock.calls[0][0]).toMatch(/\/publico\/cafe-raices$/);
    expect(screen.getByDisplayValue("cafe-raices")).toBeInTheDocument();
  });

  it("avisa mientras carga", () => {
    simularFetch(() => new Promise(() => {}));

    montar();

    expect(screen.getByText("Cargando perfil…")).toBeInTheDocument();
  });

  it("enseña la ficha del negocio", async () => {
    simularFetch([PERFIL()]);

    montar();

    expect(await screen.findByRole("heading", { name: "Panadería La Espiga" }))
      .toBeInTheDocument();
    expect(screen.getByText("+57 301 222 3344")).toBeInTheDocument();
  });

  it("enseña los bloques publicados", async () => {
    simularFetch([PERFIL("Panadería La Espiga", BLOQUES)]);

    montar();

    expect(await screen.findByRole("link", { name: "https://wa.me/57300" })).toBeInTheDocument();
    expect(screen.getByText("Pan de masa madre")).toBeInTheDocument();
  });

  // Un perfil recien creado no tiene bloques: no es un error.
  it("dice que no hay contenido en lugar de dejar la pantalla a medias", async () => {
    simularFetch([PERFIL()]);

    montar();

    expect(await screen.findByText(/todavía no tiene contenido publicado/))
      .toBeInTheDocument();
  });
});

describe("al consultar otro negocio", () => {
  it("lo busca al enviar el formulario", async () => {
    const espia = simularFetch([PERFIL(), PERFIL("Café Raíces")]);

    montar();

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await userEvent.clear(screen.getByLabelText(/Dirección pública/));
    await userEvent.type(screen.getByLabelText(/Dirección pública/), "cafe-raices");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByRole("heading", { name: "Café Raíces" })).toBeInTheDocument();
    expect(espia).toHaveBeenCalledTimes(2);
  });

  // Escribir no puede llamar al servidor en cada tecla.
  it("no llama al servidor mientras se escribe", async () => {
    const espia = simularFetch([PERFIL()]);

    montar();

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await userEvent.clear(screen.getByLabelText(/Dirección pública/));
    await userEvent.type(screen.getByLabelText(/Dirección pública/), "cafe-raices");

    expect(espia).toHaveBeenCalledTimes(1);
  });

  it("quita los espacios de sobra antes de buscar", async () => {
    const espia = simularFetch([PERFIL(), PERFIL("Café Raíces")]);

    montar();

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await userEvent.clear(screen.getByLabelText(/Dirección pública/));
    await userEvent.type(screen.getByLabelText(/Dirección pública/), "  cafe-raices  ");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));
    expect(espia.mock.calls[1][0]).toMatch(/\/publico\/cafe-raices$/);
  });

  // Si se consulta un negocio y, antes de que conteste, se consulta otro, la
  // respuesta vieja no puede pisar a la nueva. De eso se encarga la bandera
  // de vigencia en la limpieza del efecto.
  it("una respuesta que llega tarde no pisa a la nueva", async () => {
    const contestar = {};

    simularFetch((url) => new Promise((resolver) => {
      contestar[url.includes("lenta") ? "lenta" : "rapida"] = resolver;
    }));

    render(
      <MemoryRouter initialEntries={["/?slug=lenta"]}><PerfilPublicoPage /></MemoryRouter>
    );

    await waitFor(() => expect(contestar.lenta).toBeDefined());

    // Se consulta otro antes de que la primera conteste
    await userEvent.clear(screen.getByLabelText(/Dirección pública/));
    await userEvent.type(screen.getByLabelText(/Dirección pública/), "rapida");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));

    await waitFor(() => expect(contestar.rapida).toBeDefined());

    // Contesta la nueva y despues la vieja
    contestar.rapida(PERFIL("El que se pidió último"));
    await screen.findByRole("heading", { name: "El que se pidió último" });

    contestar.lenta(PERFIL("El viejo, que llegó tarde"));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "El viejo, que llegó tarde" }))
        .not.toBeInTheDocument());

    expect(screen.getByRole("heading", { name: "El que se pidió último" }))
      .toBeInTheDocument();
  });
});

describe("cuando el negocio no existe", () => {
  it("enseña el mensaje del servidor", async () => {
    simularFetch([respuesta({ message: "Este perfil no está disponible" }, { status: 404 })]);

    montar();

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Este perfil no está disponible");
  });

  // Dejar la ficha del anterior debajo de un error haria pensar que son de
  // ese negocio.
  it("quita la ficha anterior al fallar la nueva consulta", async () => {
    simularFetch([
      PERFIL(),
      respuesta({ message: "Este perfil no está disponible" }, { status: 404 })
    ]);

    montar();

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await userEvent.clear(screen.getByLabelText(/Dirección pública/));
    await userEvent.type(screen.getByLabelText(/Dirección pública/), "no-existe");
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));

    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "Panadería La Espiga" }))
      .not.toBeInTheDocument();
  });

  it("avisa si se deja la direccion en blanco, sin llamar al servidor", async () => {
    const espia = simularFetch([PERFIL()]);

    montar();

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await userEvent.clear(screen.getByLabelText(/Dirección pública/));
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Escriba la dirección/);
    expect(espia).toHaveBeenCalledTimes(1);
  });
});

// --- El contenido por secciones (RF-05) ---
//
// Esta pantalla es la vista previa de lo que verá quien escanee el código, y
// antes lo pintaba todo en una sola lista plana aunque la API lo devolviera
// agrupado.
describe("las secciones", () => {
  it("separa el contenido con el nombre de cada seccion", async () => {
    simularFetch([PERFIL("Panadería La Espiga", BLOQUES)]);

    montar();

    expect(await screen.findByRole("heading", { name: "Menú principal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Promociones" })).toBeInTheDocument();
  });

  it("cada bloque queda dentro de su seccion", async () => {
    simularFetch([PERFIL("Panadería La Espiga", BLOQUES)]);

    montar();

    await screen.findByRole("heading", { name: "Menú principal" });

    const [menu, promos] = screen.getAllByRole("heading", { level: 2 })
      .filter((h) => ["Menú principal", "Promociones"].includes(h.textContent))
      .map((h) => h.closest("section"));

    expect(menu).toHaveTextContent("Escríbenos");
    expect(promos).toHaveTextContent("Combo desayuno");
    expect(menu).not.toHaveTextContent("Combo desayuno");
  });

  // Aquí no hay botón «Ver menú completo», y es a propósito: esta pantalla ya
  // enseña todas las secciones enteras, y es la herramienta del dueño. El
  // botón vive en /p/:slug, que es donde una pantalla de teléfono se queda
  // larga. Llevarlo aquí mandaría al dueño al recorrido público, donde sus
  // propios clics sí se cuentan.
  it("no ofrece el boton del menu: esta pantalla ya lo enseña todo", async () => {
    simularFetch([PERFIL("Panadería La Espiga", BLOQUES)]);

    montar();

    await screen.findByRole("heading", { name: "Menú principal" });
    expect(screen.queryByRole("link", { name: "Ver menú completo" })).not.toBeInTheDocument();
  });

  it("sin contenido lo dice, con su encabezado", async () => {
    simularFetch([PERFIL("Panadería La Espiga", [])]);

    montar();

    expect(await screen.findByText(/todavía no tiene contenido publicado/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contenido publicado" })).toBeInTheDocument();
  });
});
