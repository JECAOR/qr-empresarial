// ============================================
// ADMINISTRACIONPAGE — el panel del administrador (RF-13, RF-14 y RF-15)
// ============================================

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AdministracionPage from "./AdministracionPage";
import { respuesta, simularFetch } from "../../pruebas/ayudas";

const RESUMEN = respuesta({
  data: {
    total: 12, activos: 10, restringidos: 2,
    administradores: 1, nuevos30Dias: 4, nuncaEntraron: 3
  }
});

const CUENTAS = (datos, paginacion = { pagina: 1, paginas: 1, total: 2, porPagina: 10 }) => ({
  ok: true,
  status: 200,
  json: async () => ({ data: datos, paginacion }),
  blob: async () => new Blob([""]),
  headers: { get: () => null }
});

const LISTA = [
  {
    id: 7, nombre: "Panadería La Espiga", correo: "contacto@laespiga.co",
    rol: "empresa", estado: "activo",
    fechaRegistro: "2026-09-14T00:00:00.000Z", ultimoAcceso: "2026-10-23T15:00:00.000Z",
    perfil: { nombreNegocio: "Panadería La Espiga", qr: true },
    actividad: { escaneos: 42, visitas: 58, clics: 17 }
  },
  {
    id: 9, nombre: "Café Raíces", correo: "hola@caferaices.co",
    rol: "empresa", estado: "restringido",
    fechaRegistro: "2026-10-01T00:00:00.000Z", ultimoAcceso: null,
    perfil: null,
    actividad: { escaneos: 0, visitas: 0, clics: 0 }
  }
];

const DETALLE = {
  ...LISTA[0],
  idUsuario: 7,
  ultimosEventos: [{ tipo: "escaneo", fecha: "2026-10-23T15:00:00.000Z", enlace: null }]
};

/** El resumen y la lista salen a la vez: dos respuestas para la carga. */
async function montar(siguientes = [], lista = LISTA, paginacion) {
  const espia = simularFetch([RESUMEN, CUENTAS(lista, paginacion), ...siguientes]);
  const vista = render(<MemoryRouter><AdministracionPage /></MemoryRouter>);

  await screen.findByRole("heading", { name: "Administración" });
  await waitFor(() => expect(screen.queryByText("Cargando cuentas…")).not.toBeInTheDocument());

  return { espia, ...vista };
}

const rutaDe = (espia, n) =>
  espia.mock.calls[n][0].replace("http://api.de.pruebas.invalido/api", "");

const parametrosDe = (espia, n) =>
  new URLSearchParams(rutaDe(espia, n).split("?")[1] ?? "");

describe("el resumen", () => {
  it("enseña las seis cifras", async () => {
    await montar();

    for (const nombre of ["Cuentas", "Activas", "Restringidas", "Administradores",
      "Nuevas en 30 días", "Nunca entraron"]) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }

    expect(screen.getByText("12")).toBeInTheDocument();
  });

  // No depende de los filtros: pedirlo otra vez en cada busqueda seria una
  // llamada para nada.
  it("no se vuelve a pedir al cambiar un filtro", async () => {
    const { espia } = await montar([CUENTAS(LISTA)]);

    await userEvent.selectOptions(screen.getByLabelText("Rol"), "empresa");

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));

    expect(espia.mock.calls.filter((c) => c[0].includes("/admin/resumen"))).toHaveLength(1);
  });
});

describe("la tabla", () => {
  it("enseña las cuentas con su negocio y su actividad", async () => {
    await montar();

    const tabla = screen.getByRole("table");

    expect(within(tabla).getByText("contacto@laespiga.co")).toBeInTheDocument();
    expect(within(tabla).getByText("Café Raíces")).toBeInTheDocument();
  });

  it("dice que una cuenta nunca entro en lugar de dejarlo en blanco", async () => {
    await montar();

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("dice que ninguna cumple los filtros, y que se pueden quitar", async () => {
    await montar([], []);

    expect(screen.getByText(/Ninguna cuenta cumple estos filtros/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("enseña el error si la lista falla", async () => {
    simularFetch([
      RESUMEN,
      respuesta({ message: "No autorizado" }, { status: 403 })
    ]);

    render(<MemoryRouter><AdministracionPage /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
  });
});

describe("los filtros", () => {
  it("busca al enviar el formulario, no en cada tecla", async () => {
    const { espia } = await montar([CUENTAS(LISTA)]);

    await userEvent.type(screen.getByLabelText("Buscar"), "espiga");

    expect(espia).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));
    expect(parametrosDe(espia, 2).get("busqueda")).toBe("espiga");
  });

  it("quita los espacios de sobra de la busqueda", async () => {
    const { espia } = await montar([CUENTAS(LISTA)]);

    await userEvent.type(screen.getByLabelText("Buscar"), "  espiga  ");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));
    expect(parametrosDe(espia, 2).get("busqueda")).toBe("espiga");
  });

  it("filtra por estado y por rol", async () => {
    const { espia } = await montar([CUENTAS(LISTA), CUENTAS(LISTA)]);

    await userEvent.selectOptions(screen.getByLabelText("Estado"), "restringido");
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));
    expect(parametrosDe(espia, 2).get("estado")).toBe("restringido");

    await userEvent.selectOptions(screen.getByLabelText("Rol"), "administrador");
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(4));
    expect(parametrosDe(espia, 3).get("rol")).toBe("administrador");
  });

  // Quedarse en la pagina 4 de un listado que ahora tiene una sola dejaria la
  // tabla vacia sin explicacion.
  it("vuelve a la primera pagina al cambiar un filtro", async () => {
    const { espia } = await montar(
      [CUENTAS(LISTA, { pagina: 2, paginas: 3, total: 25, porPagina: 10 }), CUENTAS(LISTA)],
      LISTA,
      { pagina: 1, paginas: 3, total: 25, porPagina: 10 }
    );

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));
    expect(parametrosDe(espia, 2).get("pagina")).toBe("2");

    await userEvent.selectOptions(screen.getByLabelText("Rol"), "empresa");
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(4));
    expect(parametrosDe(espia, 3).get("pagina")).toBe("1");
  });

  it("el boton de quitar filtros solo sale cuando hay alguno", async () => {
    const { espia } = await montar([CUENTAS(LISTA), CUENTAS(LISTA)]);

    expect(screen.queryByText("Quitar filtros")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Rol"), "empresa");
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));

    expect(screen.getByText("Quitar filtros")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Quitar filtros"));

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(4));
    expect(parametrosDe(espia, 3).get("rol")).toBeNull();
    expect(screen.getByLabelText("Buscar")).toHaveValue("");
  });
});

describe("la paginacion", () => {
  it("no sale si todo cabe en una pagina", async () => {
    await montar();

    expect(screen.queryByRole("navigation", { name: "Páginas" })).not.toBeInTheDocument();
  });

  it("dice en que pagina se esta y cuantas cuentas hay", async () => {
    await montar([], LISTA, { pagina: 2, paginas: 3, total: 25, porPagina: 10 });

    expect(screen.getByText(/Página 2 de 3/)).toBeInTheDocument();
    expect(screen.getByText(/25 cuentas/)).toBeInTheDocument();
  });

  it("apaga Anterior en la primera y Siguiente en la ultima", async () => {
    await montar([], LISTA, { pagina: 1, paginas: 3, total: 25, porPagina: 10 });

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });
});

describe("el detalle de una cuenta", () => {
  it("lo pide y lo abre en un dialogo", async () => {
    const { espia } = await montar([respuesta({ data: DETALLE })]);

    await userEvent.click(within(screen.getByRole("table")).getAllByText("Ver")[0]);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    expect(rutaDe(espia, 2)).toBe("/admin/usuarios/7");
  });

  it("enseña el error si no se puede traer", async () => {
    await montar([respuesta({ message: "No encontrado" }, { status: 404 })]);

    await userEvent.click(within(screen.getByRole("table")).getAllByText("Ver")[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("No encontrado");
  });
});

describe("el reporte en CSV", () => {
  // Lo que se descarga es lo que se esta viendo, no la tabla entera.
  it("respeta los filtros", async () => {
    const pulsar = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const { espia } = await montar([
      CUENTAS(LISTA),
      respuesta("csv", { headers: { "content-disposition": 'attachment; filename="cuentas.csv"' } })
    ]);

    await userEvent.selectOptions(screen.getByLabelText("Rol"), "empresa");
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));

    await userEvent.click(screen.getByText("Descargar reporte"));

    await screen.findByRole("status");

    expect(parametrosDe(espia, 3).get("rol")).toBe("empresa");
    expect(pulsar).toHaveBeenCalled();
  });

  // El reporte lleva todo lo que cumple los filtros, no solo la pagina que se
  // esta viendo.
  it("no manda pagina ni porPagina", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const { espia } = await montar([
      respuesta("csv", { headers: { "content-disposition": 'attachment; filename="cuentas.csv"' } })
    ]);

    await userEvent.click(screen.getByText("Descargar reporte"));

    await screen.findByRole("status");

    expect(parametrosDe(espia, 2).get("pagina")).toBeNull();
    expect(parametrosDe(espia, 2).get("porPagina")).toBeNull();
  });

  it("enseña el nombre del archivo descargado", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await montar([
      respuesta("csv", { headers: { "content-disposition": 'attachment; filename="cuentas-2026.csv"' } })
    ]);

    await userEvent.click(screen.getByText("Descargar reporte"));

    expect(await screen.findByRole("status")).toHaveTextContent("Descargado cuentas-2026.csv");
  });

  it("enseña el error si falla", async () => {
    await montar([respuesta({ message: "No autorizado" }, { status: 403 })]);

    await userEvent.click(screen.getByText("Descargar reporte"));

    expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
  });
});
