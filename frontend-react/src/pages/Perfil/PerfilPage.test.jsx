// ============================================
// PERFILPAGE — el perfil del negocio (RF-04, RF-10 y RF-12)
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PerfilPage from "./PerfilPage";
import { respuesta, simularFetch } from "../../pruebas/ayudas";

const PERFIL = (extra = {}) => ({
  idPerfil: 4,
  slug: "panaderia-la-espiga",
  urlPublica: "http://localhost:3000/p/panaderia-la-espiga",
  nombreNegocio: "Panadería La Espiga",
  categoria: "Panadería",
  descripcion: "Pan de masa madre",
  direccion: "Av. 68 #40-12",
  telefono: "+57 301 222 3344",
  correoContacto: "contacto@laespiga.co",
  instagram: "@panaderialaespiga",
  horario: "Lun-Sáb 7:00-20:00",
  imagen: null,
  tema: "indigo",
  ...extra
});

async function montar(respuestas) {
  const espia = simularFetch(respuestas);
  const vista = render(<MemoryRouter><PerfilPage /></MemoryRouter>);

  await screen.findByRole("heading", { name: "Perfil del negocio" });

  return { espia, ...vista };
}

const cuerpoDe = (espia, n) => JSON.parse(espia.mock.calls[n][1].body);

describe("al abrir", () => {
  it("avisa mientras carga", () => {
    simularFetch(() => new Promise(() => {}));

    render(<MemoryRouter><PerfilPage /></MemoryRouter>);

    expect(screen.getByText("Cargando el perfil…")).toBeInTheDocument();
  });

  it("rellena los nueve campos con lo que hay guardado", async () => {
    await montar([respuesta({ data: PERFIL() })]);

    expect(screen.getByLabelText(/Nombre del negocio/)).toHaveValue("Panadería La Espiga");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("+57 301 222 3344");
    expect(screen.getByLabelText("Instagram")).toHaveValue("@panaderialaespiga");
  });

  // La API guarda los campos vacios como NULL, y un input con value={null}
  // se vuelve no controlado: React avisa por consola y el campo deja de
  // responder al estado.
  it("escribe los campos nulos como cadena vacia, no como null", async () => {
    await montar([respuesta({ data: PERFIL({ imagen: null, horario: null }) })]);

    expect(screen.getByLabelText("Imagen")).toHaveValue("");
    expect(screen.getByLabelText("Horario")).toHaveValue("");
  });

  it("enseña la direccion publica", async () => {
    await montar([respuesta({ data: PERFIL() })]);

    expect(screen.getByText("http://localhost:3000/p/panaderia-la-espiga"))
      .toBeInTheDocument();
  });

  // Si el slug cambiara, los codigos ya impresos dejarian de funcionar: por
  // eso se muestra pero no se edita.
  it("la direccion publica se muestra pero no se edita, y dice por que", async () => {
    await montar([respuesta({ data: PERFIL() })]);

    expect(screen.queryByLabelText(/dirección pública/i)).not.toBeInTheDocument();
    expect(screen.getByText(/códigos QR que ya hubieras impreso dejarían de funcionar/))
      .toBeInTheDocument();
  });

  it("enlaza a la pagina publica con su slug", async () => {
    await montar([respuesta({ data: PERFIL() })]);

    expect(screen.getByRole("link", { name: "Ver la página pública" }))
      .toHaveAttribute("href", "/?slug=panaderia-la-espiga");
  });

  it("no ofrece el enlace si todavia no hay slug", async () => {
    await montar([respuesta({ data: PERFIL({ slug: null }) })]);

    expect(screen.queryByRole("link", { name: "Ver la página pública" }))
      .not.toBeInTheDocument();
  });

  it("enseña el error si la carga falla", async () => {
    simularFetch([respuesta({ message: "No autorizado" }, { status: 401 })]);

    render(<MemoryRouter><PerfilPage /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
  });
});

describe("guardar el perfil", () => {
  // Es un PUT: lo que no se envie se borra. Mandar solo lo tocado dejaria el
  // resto del perfil en blanco.
  it("manda todos los campos, tambien los vacios", async () => {
    const { espia } = await montar([
      respuesta({ data: PERFIL({ imagen: null }) }),
      respuesta({ data: PERFIL() })
    ]);

    await userEvent.clear(screen.getByLabelText("Teléfono"));
    await userEvent.click(screen.getByText("Guardar perfil"));

    await screen.findByRole("status");

    const enviado = cuerpoDe(espia, 1);

    expect(espia.mock.calls[1][1].method).toBe("PUT");
    expect(enviado).toHaveProperty("telefono", "");
    expect(enviado).toHaveProperty("imagen", "");
    expect(Object.keys(enviado).sort()).toEqual([
      "categoria", "correoContacto", "descripcion", "direccion", "horario",
      "imagen", "instagram", "nombreNegocio", "telefono"
    ]);
  });

  // No se manda: es del servidor. Si se mandara, un PUT podria cambiarlo.
  it("no manda el slug ni la direccion publica", async () => {
    const { espia } = await montar([
      respuesta({ data: PERFIL() }),
      respuesta({ data: PERFIL() })
    ]);

    await userEvent.click(screen.getByText("Guardar perfil"));

    await screen.findByRole("status");

    expect(cuerpoDe(espia, 1)).not.toHaveProperty("slug");
    expect(cuerpoDe(espia, 1)).not.toHaveProperty("urlPublica");
  });

  it("se queda con lo que devuelve el servidor, no con lo que se escribio", async () => {
    await montar([
      respuesta({ data: PERFIL() }),
      respuesta({ data: PERFIL({ nombreNegocio: "Panadería La Espiga S.A.S" }) })
    ]);

    await userEvent.clear(screen.getByLabelText(/Nombre del negocio/));
    await userEvent.type(screen.getByLabelText(/Nombre del negocio/), "cualquier cosa");
    await userEvent.click(screen.getByText("Guardar perfil"));

    await screen.findByRole("status");

    expect(screen.getByLabelText(/Nombre del negocio/))
      .toHaveValue("Panadería La Espiga S.A.S");
  });

  it("enseña el error del servidor y conserva lo escrito", async () => {
    await montar([
      respuesta({ data: PERFIL() }),
      respuesta({ message: "El nombre del negocio es obligatorio" }, { status: 400 })
    ]);

    await userEvent.clear(screen.getByLabelText("Categoría"));
    await userEvent.type(screen.getByLabelText("Categoría"), "Repostería");
    await userEvent.click(screen.getByText("Guardar perfil"));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("El nombre del negocio es obligatorio");
    expect(screen.getByLabelText("Categoría")).toHaveValue("Repostería");
  });

  // El validador del backend tiene los mismos: aqui estan para que el
  // navegador avise antes de gastar una peticion, no para sustituirlo.
  it("repite los limites del validador en el formulario", async () => {
    await montar([respuesta({ data: PERFIL() })]);

    expect(screen.getByLabelText(/Nombre del negocio/)).toHaveAttribute("maxLength", "150");
    expect(screen.getByLabelText("Teléfono")).toHaveAttribute("maxLength", "30");
    expect(screen.getByLabelText(/Nombre del negocio/)).toBeRequired();
  });
});

describe("el color de marca", () => {
  // Elegir un color es una decision de un clic: obligar a confirmarla con el
  // boton de guardar del formulario seria raro.
  it("se guarda al elegirlo, por su propia ruta", async () => {
    const { espia } = await montar([
      respuesta({ data: PERFIL() }),
      respuesta({ data: PERFIL({ tema: "terracota" }) })
    ]);

    await userEvent.click(screen.getByRole("button", { name: /Terracota/ }));

    await screen.findByRole("status");

    expect(espia.mock.calls[1][0]).toMatch(/\/perfiles\/me\/tema$/);
    expect(espia.mock.calls[1][1].method).toBe("PATCH");
    expect(cuerpoDe(espia, 1)).toEqual({ tema: "terracota" });
  });

  it("marca el que esta puesto", async () => {
    await montar([respuesta({ data: PERFIL({ tema: "teal" }) })]);

    expect(screen.getByRole("button", { name: /Esmeralda/ }))
      .toHaveAttribute("aria-pressed", "true");
  });

  // Volver a pulsar el que ya esta puesto es una peticion para nada.
  it("no llama al servidor si se pulsa el que ya estaba", async () => {
    const { espia } = await montar([respuesta({ data: PERFIL({ tema: "indigo" }) })]);

    await userEvent.click(screen.getByRole("button", { name: /Índigo/ }));

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(1));
  });

  it("enseña el error si el servidor lo rechaza", async () => {
    await montar([
      respuesta({ data: PERFIL() }),
      respuesta({ message: "Tema no válido" }, { status: 400 })
    ]);

    await userEvent.click(screen.getByRole("button", { name: /Terracota/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tema no válido");
  });
});
