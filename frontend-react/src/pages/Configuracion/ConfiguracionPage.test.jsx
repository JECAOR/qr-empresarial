// ============================================
// CONFIGURACIONPAGE — los datos de la cuenta, la contrasena, los avisos y
// la baja (RF-12)
// ============================================

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConfiguracionPage from "./ConfiguracionPage";
import { ProveedorAuth } from "../../context/AuthContext";
import RutaProtegida from "../../components/RutaProtegida/RutaProtegida";
import { CLAVE_TOKEN } from "../../services/apiClient";
import { respuesta, simularFetch, USUARIO_EMPRESA } from "../../pruebas/ayudas";

const navegar = vi.fn();

vi.mock("react-router-dom", async (original) => ({
  ...await original(),
  useNavigate: () => navegar
}));

const PREFERENCIAS = (extra = {}) =>
  respuesta({ data: { resumen: true, novedades: false, guardadas: false, ...extra } });

/**
 * Monta la pantalla detrás del guardia, como la monta la aplicación.
 *
 * Importa: el formulario se inicializa una sola vez con lo que trajo
 * AuthContext, y sin el guardia se dibujaría antes de que haya sesión, con
 * los campos vacíos. Esa es la razón de que la ruta vaya protegida y no un
 * detalle de estas pruebas.
 *
 * El primer fetch es el /usuarios/me de AuthContext y el segundo las
 * preferencias; los que se pasen van después, en el orden en que se gasten.
 */
async function montar(siguientes = [], usuario = USUARIO_EMPRESA) {
  sessionStorage.setItem(CLAVE_TOKEN, "jwt");

  const espia = simularFetch([
    respuesta({ data: usuario }),
    PREFERENCIAS(),
    ...siguientes
  ]);

  render(
    <MemoryRouter initialEntries={["/configuracion"]}>
      <ProveedorAuth>
        <Routes>
          <Route element={<RutaProtegida />}>
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>
        </Routes>
      </ProveedorAuth>
    </MemoryRouter>
  );

  await screen.findByRole("heading", { name: "Tu cuenta" });

  return espia;
}

/** El cuerpo que se mandó en la llamada número `n`. */
const cuerpoDe = (espia, n) => JSON.parse(espia.mock.calls[n][1].body);

beforeEach(() => navegar.mockClear());

describe("al abrir", () => {
  it("avisa mientras pide las preferencias", () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([respuesta({ data: USUARIO_EMPRESA }), new Promise(() => {})]);

    render(
      <MemoryRouter initialEntries={["/configuracion"]}>
        <ProveedorAuth>
          <Routes>
            <Route element={<RutaProtegida />}>
              <Route path="/configuracion" element={<ConfiguracionPage />} />
            </Route>
          </Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    // Mientras AuthContext no conteste, el guardia enseña lo suyo
    expect(screen.getByText(/Verificando sesión/)).toBeInTheDocument();
  });

  // El nombre y el correo ya los trajo AuthContext: pedirlos otra vez seria
  // una llamada de mas.
  it("rellena nombre y correo con lo que ya sabe de la sesion", async () => {
    await montar();

    expect(screen.getByLabelText("Nombre")).toHaveValue("Panadería La Espiga");
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("contacto@laespiga.co");
  });

  it("dice con todas las letras que los avisos todavia no se envian", async () => {
    await montar();

    expect(screen.getByText(/todavía no se envía ningún/i)).toBeInTheDocument();
  });
});

describe("los datos de la cuenta", () => {
  // Pedir la contrasena para cambiar solo el nombre seria pedirla por nada.
  it("no pide la contrasena si el correo no cambia", async () => {
    await montar();

    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "La Espiga S.A.S");

    expect(screen.queryByLabelText("Tu contraseña")).not.toBeInTheDocument();
  });

  // El correo es con el que se entra y al que llega el enlace de
  // recuperacion: quien se hiciera con una sesion abierta podria cambiarlo y
  // despues apropiarse de la cuenta.
  it("pide la contrasena en cuanto el correo cambia, y explica por que", async () => {
    await montar();

    await userEvent.clear(screen.getByLabelText("Correo electrónico"));
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "otro@ejemplo.co");

    expect(screen.getByLabelText(/Tu contraseña/)).toBeInTheDocument();
    expect(screen.getByText(/al que llega el enlace de recuperación/)).toBeInTheDocument();
  });

  it("manda la contrasena en null cuando el correo no cambia", async () => {
    const espia = await montar([respuesta({ data: {} }), respuesta({ data: USUARIO_EMPRESA })]);

    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "La Espiga S.A.S");
    await userEvent.click(screen.getByText("Guardar datos"));

    await screen.findByRole("status");

    expect(cuerpoDe(espia, 2)).toEqual({ nombre: "La Espiga S.A.S", correo: "contacto@laespiga.co" });
  });

  it("avisa de que habra que entrar con el correo nuevo", async () => {
    await montar([respuesta({ data: {} }), respuesta({ data: USUARIO_EMPRESA })]);

    await userEvent.clear(screen.getByLabelText("Correo electrónico"));
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "otro@ejemplo.co");
    await userEvent.type(screen.getByLabelText(/Tu contraseña/), "Clave123*");
    await userEvent.click(screen.getByText("Guardar datos"));

    expect(await screen.findByRole("status"))
      .toHaveTextContent(/Entra con tu correo nuevo/);
  });

  // REGRESION. La barra de navegacion enseña el nombre, y sin volver a
  // preguntar seguiria con el viejo hasta recargar la pagina.
  it("vuelve a preguntar quien eres despues de guardar", async () => {
    const espia = await montar([respuesta({ data: {} }), respuesta({ data: USUARIO_EMPRESA })]);

    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "La Espiga S.A.S");
    await userEvent.click(screen.getByText("Guardar datos"));

    await screen.findByRole("status");

    // Tras el PUT se vuelve a pedir /usuarios/me
    expect(espia.mock.calls[3][0]).toMatch(/\/usuarios\/me$/);
    expect(espia.mock.calls[3][1].method ?? "GET").toBe("GET");
  });

  it("deja el campo de contrasena vacio despues de guardar", async () => {
    await montar([respuesta({ data: {} }), respuesta({ data: USUARIO_EMPRESA })]);

    await userEvent.clear(screen.getByLabelText("Correo electrónico"));
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "otro@ejemplo.co");
    await userEvent.type(screen.getByLabelText(/Tu contraseña/), "Clave123*");
    await userEvent.click(screen.getByText("Guardar datos"));

    await screen.findByRole("status");

    // Sigue pidiendola, porque el usuario de la sesion no cambio en la prueba
    expect(screen.getByLabelText(/Tu contraseña/)).toHaveValue("");
  });

  it("enseña el error del servidor", async () => {
    await montar([respuesta({ message: "Ese correo ya está registrado" }, { status: 409 })]);

    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.type(screen.getByLabelText("Nombre"), "X");
    await userEvent.click(screen.getByText("Guardar datos"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese correo ya está registrado");
  });
});

describe("la contrasena", () => {
  async function cambiarClave(nueva, repetida) {
    await userEvent.type(screen.getByLabelText("Contraseña actual"), "Clave123*");
    await userEvent.type(screen.getByLabelText(/Contraseña nueva/), nueva);
    await userEvent.type(screen.getByLabelText("Repítela"), repetida);
    await userEvent.click(screen.getByText("Cambiar contraseña"));
  }

  // Se comprueba aqui para no gastar una llamada y un intento en algo que el
  // servidor no puede saber.
  it("no llama al servidor si las dos nuevas no coinciden", async () => {
    const espia = await montar();

    await cambiarClave("ClaveNueva1*", "OtraCosa2*");

    expect(await screen.findByRole("alert")).toHaveTextContent(/no coinciden/);
    expect(espia).toHaveBeenCalledTimes(2); // solo los dos de la carga
  });

  it("manda la actual y la nueva con los nombres del validador", async () => {
    const espia = await montar([respuesta({ data: { token: "token-nuevo" } })]);

    await cambiarClave("ClaveNueva1*", "ClaveNueva1*");

    await screen.findByRole("status");

    expect(cuerpoDe(espia, 2)).toEqual({
      contrasenaActual: "Clave123*",
      contrasenaNueva: "ClaveNueva1*"
    });
  });

  it("explica que se cerraron las demas sesiones", async () => {
    await montar([respuesta({ data: { token: "token-nuevo" } })]);

    await cambiarClave("ClaveNueva1*", "ClaveNueva1*");

    expect(await screen.findByRole("status"))
      .toHaveTextContent(/sesiones que tuvieras abiertas en otros dispositivos se cerraron/);
  });

  it("vacia los tres campos al terminar", async () => {
    await montar([respuesta({ data: { token: "token-nuevo" } })]);

    await cambiarClave("ClaveNueva1*", "ClaveNueva1*");

    await screen.findByRole("status");

    expect(screen.getByLabelText("Contraseña actual")).toHaveValue("");
    expect(screen.getByLabelText(/Contraseña nueva/)).toHaveValue("");
    expect(screen.getByLabelText("Repítela")).toHaveValue("");
  });
});

describe("los avisos por correo", () => {
  it("enseña los dos interruptores con lo que dijo el servidor", async () => {
    await montar();

    const lista = screen.getByRole("list");
    const [resumen, novedades] = within(lista).getAllByRole("checkbox");

    expect(resumen).toBeChecked();
    expect(novedades).not.toBeChecked();
  });

  it("guarda en cuanto se pulsa, sin boton aparte", async () => {
    const espia = await montar([PREFERENCIAS({ novedades: true, guardadas: true })]);

    await userEvent.click(screen.getAllByRole("checkbox")[1]);

    await screen.findByRole("status");

    expect(espia.mock.calls[2][1].method).toBe("PUT");
    expect(cuerpoDe(espia, 2)).toMatchObject({ resumen: true, novedades: true });
  });

  // REGRESION. La nota decia "estos son los valores de fabrica" aunque
  // acabaras de elegir, porque se guardaba lo que la pantalla habia pintado
  // y no lo que contesto el servidor, que es quien sabe que ya elegiste.
  it("la nota de valores de fabrica desaparece al elegir", async () => {
    await montar([PREFERENCIAS({ novedades: true, guardadas: true })]);

    expect(screen.getByText(/estos son los valores de fábrica/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("checkbox")[1]);

    await waitFor(() =>
      expect(screen.queryByText(/estos son los valores de fábrica/)).not.toBeInTheDocument());
  });

  it("no enseña la nota si ya se habia elegido antes", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([
      respuesta({ data: USUARIO_EMPRESA }),
      PREFERENCIAS({ guardadas: true })
    ]);

    render(
      <MemoryRouter initialEntries={["/configuracion"]}>
        <ProveedorAuth>
          <Routes>
            <Route element={<RutaProtegida />}>
              <Route path="/configuracion" element={<ConfiguracionPage />} />
            </Route>
          </Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Tu cuenta" });

    expect(screen.queryByText(/estos son los valores de fábrica/)).not.toBeInTheDocument();
  });
});

describe("darse de baja", () => {
  it("pregunta antes, y no hace nada si se dice que no", async () => {
    const espia = await montar();

    vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.type(screen.getByLabelText(/Escribe tu contraseña/), "Clave123*");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(espia).toHaveBeenCalledTimes(2);
  });

  it("avisa de que el perfil y el codigo dejan de responder", async () => {
    await montar();

    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.type(screen.getByLabelText(/Escribe tu contraseña/), "Clave123*");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));

    expect(confirmar.mock.calls[0][0]).toMatch(/código QR dejarán de responder/);
  });

  it("elimina, cierra sesion y lleva al login con un aviso", async () => {
    const espia = await montar([
      respuesta({ message: "Cuenta eliminada" }),
      respuesta(null, { status: 204 }) // el logout
    ]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.type(screen.getByLabelText(/Escribe tu contraseña/), "Clave123*");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));

    await waitFor(() => expect(navegar).toHaveBeenCalledWith("/login", {
      replace: true,
      state: { aviso: "Tu cuenta fue eliminada." }
    }));

    expect(espia.mock.calls[2][1].method).toBe("DELETE");
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  it("se queda si la contrasena era incorrecta", async () => {
    await montar([respuesta({ message: "Contraseña incorrecta" }, { status: 401 })]);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.type(screen.getByLabelText(/Escribe tu contraseña/), "mal");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar mi cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Contraseña incorrecta");
    expect(navegar).not.toHaveBeenCalled();
  });
});
