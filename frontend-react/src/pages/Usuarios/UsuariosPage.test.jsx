// ============================================
// USUARIOSPAGE — el CRUD de cuentas (RF-01 del lado del administrador)
// ============================================

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import UsuariosPage from "./UsuariosPage";
import RutaProtegida from "../../components/RutaProtegida/RutaProtegida";
import { ProveedorAuth } from "../../context/AuthContext";
import { CLAVE_TOKEN } from "../../services/apiClient";
import { respuesta, simularFetch, USUARIO_ADMIN } from "../../pruebas/ayudas";

const USUARIOS = [
  { idUsuario: 1, nombre: "QR Empresarial", correo: "admin@caferaices.co", rol: "administrador", estado: "activo", fechaRegistro: "2026-09-01T00:00:00.000Z" },
  { idUsuario: 7, nombre: "Panadería La Espiga", correo: "contacto@laespiga.co", rol: "empresa", estado: "activo", fechaRegistro: "2026-09-14T00:00:00.000Z" }
];

/** Monta la pantalla detrás del guardia, como la monta la aplicación. */
async function montar(siguientes = [], usuarios = USUARIOS) {
  sessionStorage.setItem(CLAVE_TOKEN, "jwt");

  const espia = simularFetch([
    respuesta({ data: USUARIO_ADMIN }),
    respuesta({ data: usuarios }),
    ...siguientes
  ]);

  render(
    <MemoryRouter initialEntries={["/usuarios"]}>
      <ProveedorAuth>
        <Routes>
          <Route element={<RutaProtegida rolesPermitidos={["administrador"]} />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>
        </Routes>
      </ProveedorAuth>
    </MemoryRouter>
  );

  // Hay que esperar a que la lista este dibujada, no al titulo: el titulo ya
  // esta mientras carga. Y esperar a que se vaya el aviso de carga tampoco
  // vale, porque mientras el guardia comprueba la sesion esta pantalla aun
  // no existe y el aviso tampoco: la espera se cumpliria enseguida.
  await waitFor(() => expect(screen.getByRole("heading", { name: "Gestión de usuarios" })
    .parentElement.querySelector(".usuarios__sub").textContent).not.toBe("Cargando…"));

  return espia;
}

function llamada(espia, n) {
  const [url, opciones = {}] = espia.mock.calls[n];

  return {
    ruta: url.replace("http://api.de.pruebas.invalido/api", ""),
    metodo: opciones.method ?? "GET",
    cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined
  };
}

// Dentro de la tabla: el correo tambien aparece en el detalle, y fuera de
// ella la busqueda encontraria dos.
const filaDe = (correo) =>
  within(screen.getByRole("table")).getByText(correo).closest("tr");

describe("al abrir", () => {
  it("enseña cuantas cuentas hay", async () => {
    await montar();

    expect(await screen.findByText("2 cuentas registradas")).toBeInTheDocument();
  });

  it("dibuja la tabla", async () => {
    await montar();

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByText("contacto@laespiga.co")).toBeInTheDocument();
  });

  it("dice que no hay cuentas en lugar de dejar una tabla vacia", async () => {
    await montar([], []);

    expect(await screen.findByText("No hay cuentas registradas.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // Si la API volviera a devolver otra cosa -paso con las filas crudas de
  // MySQL-, es mejor decirlo que dejar la pantalla en blanco.
  //
  // REGRESION. El aviso decia "GET /usuarios no devolvio una lista", que es
  // un mensaje para quien programa. Quien ve esta pantalla administra un
  // sistema, no lo depura: el detalle tecnico va a la consola.
  it("avisa si la API no devuelve una lista, sin hablar de endpoints", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});

    sessionStorage.setItem(CLAVE_TOKEN, "jwt");

    simularFetch([
      respuesta({ data: USUARIO_ADMIN }),
      respuesta({ data: { usuarios: USUARIOS } })
    ]);

    render(
      <MemoryRouter initialEntries={["/usuarios"]}>
        <ProveedorAuth>
          <Routes>
            <Route element={<RutaProtegida rolesPermitidos={["administrador"]} />}>
              <Route path="/usuarios" element={<UsuariosPage />} />
            </Route>
          </Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    const aviso = await screen.findByRole("alert");

    expect(aviso).toHaveTextContent("No se pudo leer la lista de cuentas");
    expect(aviso).not.toHaveTextContent("GET");

    // El detalle sigue existiendo, donde sirve
    expect(consola).toHaveBeenCalledWith(
      "GET /usuarios no devolvió una lista:",
      expect.anything()
    );

    consola.mockRestore();
  });
});

describe("ver el detalle", () => {
  it("lo pide al servidor y lo enseña", async () => {
    const espia = await montar([respuesta({ data: USUARIOS[1] })]);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Ver"));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Panadería La Espiga" }))
      .toBeInTheDocument());

    expect(llamada(espia, 2).ruta).toBe("/usuarios/7");
  });

  it("se cierra", async () => {
    await montar([respuesta({ data: USUARIOS[1] })]);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Ver"));
    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await userEvent.click(screen.getByText("Cerrar"));

    expect(screen.queryByRole("heading", { name: "Panadería La Espiga" }))
      .not.toBeInTheDocument();
  });
});

describe("crear una cuenta", () => {
  it("abre el formulario vacio", async () => {
    await montar();

    await userEvent.click(screen.getByText("Nueva cuenta"));

    expect(screen.getByRole("heading", { name: "Nueva cuenta" })).toBeInTheDocument();
  });

  it("la crea y vuelve a pedir la lista", async () => {
    const espia = await montar([
      respuesta({ data: { idUsuario: 9 } }, { status: 201 }),
      respuesta({ data: USUARIOS })
    ]);

    await userEvent.click(screen.getByText("Nueva cuenta"));
    await userEvent.type(screen.getByLabelText("Nombre"), "Café Raíces");
    await userEvent.type(screen.getByLabelText("Correo"), "hola@caferaices.co");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "Clave123*");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toMatchObject({ ruta: "/usuarios", metodo: "POST" });
    expect(llamada(espia, 3).ruta).toBe("/usuarios");
  });

  // Si el servidor rechaza algo, lo escrito no se puede perder.
  it("deja el formulario abierto con lo escrito si el servidor lo rechaza", async () => {
    await montar([respuesta({ message: "Ese correo ya está registrado" }, { status: 409 })]);

    await userEvent.click(screen.getByText("Nueva cuenta"));
    await userEvent.type(screen.getByLabelText("Nombre"), "Café Raíces");
    await userEvent.type(screen.getByLabelText("Correo"), "admin@caferaices.co");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "Clave123*");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese correo ya está registrado");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Café Raíces");
  });
});

describe("editar una cuenta", () => {
  // Se pide otra vez en lugar de usar la fila: asi el formulario arranca con
  // lo que hay ahora en la base, no con lo que se cargo hace cinco minutos.
  it("vuelve a pedir la cuenta antes de abrir el formulario", async () => {
    const espia = await montar([
      respuesta({ data: { ...USUARIOS[1], nombre: "Nombre de ahora mismo" } })
    ]);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Editar"));

    await waitFor(() =>
      expect(screen.getByLabelText("Nombre")).toHaveValue("Nombre de ahora mismo"));

    expect(llamada(espia, 2).ruta).toBe("/usuarios/7");
  });

  it("la guarda con PUT", async () => {
    const espia = await montar([
      respuesta({ data: USUARIOS[1] }),
      respuesta({ data: {} }),
      respuesta({ data: USUARIOS })
    ]);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Editar"));
    await waitFor(() => screen.getByLabelText("Nombre"));

    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "La Espiga S.A.S");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByRole("status");

    expect(llamada(espia, 3)).toMatchObject({ ruta: "/usuarios/7", metodo: "PUT" });
  });
});

describe("restringir y activar", () => {
  it("avisa de que las sesiones abiertas dejan de servir", async () => {
    await montar();

    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Restringir"));

    expect(confirmar.mock.calls[0][0])
      .toMatch(/sesiones que tenga abiertas dejarán de servir/);
  });

  it("manda la palabra contraria a la que tiene", async () => {
    const espia = await montar([respuesta({ data: {} }), respuesta({ data: USUARIOS })]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Restringir"));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toEqual({
      ruta: "/usuarios/7/estado",
      metodo: "PATCH",
      cuerpo: { estado: "restringido" }
    });
  });

  it("y al reves si ya estaba restringida", async () => {
    const espia = await montar(
      [respuesta({ data: {} }), respuesta({ data: USUARIOS })],
      [USUARIOS[0], { ...USUARIOS[1], estado: "restringido" }]
    );

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Activar"));

    await screen.findByRole("status");

    expect(llamada(espia, 2).cuerpo).toEqual({ estado: "activo" });
  });
});

describe("eliminar", () => {
  // Es un borrado logico: los datos se conservan. Decirlo cambia la decision.
  it("explica que es una eliminacion logica", async () => {
    await montar();

    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Eliminar"));

    expect(confirmar.mock.calls[0][0]).toMatch(/eliminación lógica/);
  });

  it("la elimina si se confirma", async () => {
    const espia = await montar([
      respuesta(null, { status: 204 }),
      respuesta({ data: [USUARIOS[0]] })
    ]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Eliminar"));

    await screen.findByRole("status");

    expect(llamada(espia, 2)).toMatchObject({ ruta: "/usuarios/7", metodo: "DELETE" });
  });

  // Un detalle de una cuenta que acaba de dejar de existir no puede quedarse
  // en pantalla.
  it("cierra el detalle si era el de la cuenta eliminada", async () => {
    await montar([
      respuesta({ data: USUARIOS[1] }),
      respuesta(null, { status: 204 }),
      respuesta({ data: [USUARIOS[0]] })
    ]);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Ver"));
    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.click(within(filaDe("contacto@laespiga.co")).getByText("Eliminar"));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Panadería La Espiga" }))
        .not.toBeInTheDocument());
  });
});
