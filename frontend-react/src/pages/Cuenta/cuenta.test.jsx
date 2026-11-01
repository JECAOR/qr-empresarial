// ============================================
// LAS PANTALLAS DE CUENTA — registro, recuperacion y restablecimiento
// (RF-01 y RF-03)
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegistroPage from "./RegistroPage";
import RecuperarPage from "./RecuperarPage";
import RestablecerPage from "./RestablecerPage";
import { ProveedorAuth } from "../../context/AuthContext";
import { CLAVE_TOKEN } from "../../services/apiClient";
import { respuesta, simularFetch, USUARIO_EMPRESA } from "../../pruebas/ayudas";

const navegar = vi.fn();

vi.mock("react-router-dom", async (original) => ({
  ...await original(),
  useNavigate: () => navegar
}));

const cuerpoDe = (espia, n) => JSON.parse(espia.mock.calls[n][1].body);

beforeEach(() => navegar.mockClear());

// ---------------------------------------------------------------- registro

describe("RegistroPage", () => {
  // Con la portada mapeada aparte, para poder comprobar a donde ATERRIZA la
  // pantalla y no solo a donde dice que manda. La pantalla sale por un
  // <Navigate>, que es la unica salida que tiene.
  const montar = () => render(
    <MemoryRouter initialEntries={["/registro"]}>
      <ProveedorAuth>
        <Routes>
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/" element={<p>perfil público</p>} />
        </Routes>
      </ProveedorAuth>
    </MemoryRouter>
  );

  async function rellenar({ negocio = "", categoria = "" } = {}) {
    await userEvent.type(screen.getByLabelText(/Tu nombre o el de tu empresa/), "Ana Pérez");
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "ana@ejemplo.co");
    await userEvent.type(screen.getByLabelText(/Contraseña/), "Clave123*");

    if (negocio) await userEvent.type(screen.getByLabelText("Nombre del negocio"), negocio);
    if (categoria) await userEvent.type(screen.getByLabelText("Categoría"), categoria);

    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  }

  it("dice que el negocio es opcional", async () => {
    simularFetch([]);

    montar();

    await waitFor(() => screen.getByText(/Tu negocio · opcional/));
  });

  it("crea la cuenta sin negocio", async () => {
    const espia = simularFetch([
      respuesta({ data: { idUsuario: 9 } }, { status: 201 }),
      respuesta({ data: { token: "jwt", usuario: USUARIO_EMPRESA } })
    ]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await rellenar();

    await waitFor(() => expect(espia.mock.calls[0][0]).toMatch(/\/auth\/registro$/));
    expect(cuerpoDe(espia, 0)).not.toHaveProperty("negocio");
  });

  it("crea la cuenta y su perfil cuando se escribe el negocio", async () => {
    const espia = simularFetch([
      respuesta({ data: { idUsuario: 9 } }, { status: 201 }),
      respuesta({ data: { token: "jwt", usuario: USUARIO_EMPRESA } })
    ]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await rellenar({ negocio: "La Espiga", categoria: "Panadería" });

    await waitFor(() => expect(espia).toHaveBeenCalled());
    expect(cuerpoDe(espia, 0).negocio)
      .toEqual({ nombreNegocio: "La Espiga", categoria: "Panadería" });
  });

  // El registro responde sin token: pedir el correo y la clave otra vez
  // inmediatamente despues de escribirlos seria absurdo.
  it("entra solo despues de registrar, y lleva al perfil publico", async () => {
    const espia = simularFetch([
      respuesta({ data: { idUsuario: 9 } }, { status: 201 }),
      respuesta({ data: { token: "jwt", usuario: USUARIO_EMPRESA } })
    ]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await rellenar();

    expect(await screen.findByText("perfil público")).toBeInTheDocument();

    expect(espia.mock.calls[1][0]).toMatch(/\/auth\/login$/);
    expect(cuerpoDe(espia, 1)).toEqual({ correo: "ana@ejemplo.co", contrasena: "Clave123*" });
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe("jwt");
  });

  it("enseña el error del servidor y no entra", async () => {
    simularFetch([respuesta({ message: "Ese correo ya está registrado" }, { status: 409 })]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await rellenar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese correo ya está registrado");

    // Se queda en el formulario, con lo escrito, para poder corregirlo
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.queryByText("perfil público")).not.toBeInTheDocument();
  });

  it("echa de aqui a quien ya tiene sesion", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([respuesta({ data: USUARIO_EMPRESA })]);

    render(
      <MemoryRouter>
        <ProveedorAuth>
          <Routes>
            <Route path="/" element={<RegistroPage />} />
          </Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Crear una cuenta" }))
        .not.toBeInTheDocument());
  });
});

// -------------------------------------------------------------- recuperar

describe("RecuperarPage", () => {
  const montar = () => render(<MemoryRouter><RecuperarPage /></MemoryRouter>);

  async function pedir(correo = "ana@ejemplo.co") {
    await userEvent.type(screen.getByLabelText("Correo electrónico"), correo);
    await userEvent.click(screen.getByRole("button", { name: "Enviar el enlace" }));
  }

  it("manda el correo sin espacios de sobra", async () => {
    const espia = simularFetch([respuesta({ message: "Si el correo existe, te llegará." })]);

    montar();

    await pedir("  ana@ejemplo.co  ");

    await waitFor(() => expect(espia).toHaveBeenCalled());
    expect(JSON.parse(espia.mock.calls[0][1].body)).toEqual({ correo: "ana@ejemplo.co" });
  });

  // El servidor responde lo mismo exista o no el correo, para no revelar que
  // direcciones estan registradas. La pantalla repite su mensaje tal cual.
  it("enseña el mensaje del servidor, que no dice si el correo existe", async () => {
    simularFetch([respuesta({ message: "Si el correo existe, te llegará un enlace." })]);

    montar();

    await pedir();

    expect(await screen.findByRole("status"))
      .toHaveTextContent("Si el correo existe, te llegará un enlace.");
  });

  // No se vuelve a enseñar el formulario, para no invitar a repetirlo: el
  // servidor ademas limita cuantas veces seguidas se puede.
  it("esconde el formulario despues de pedirlo", async () => {
    simularFetch([respuesta({ message: "Listo" })]);

    montar();

    await pedir();

    await screen.findByRole("status");
    expect(screen.queryByRole("button", { name: "Enviar el enlace" })).not.toBeInTheDocument();
  });

  it("dice cuanto dura el enlace y que solo sirve una vez", async () => {
    simularFetch([respuesta({ message: "Listo" })]);

    montar();

    await pedir();

    expect(await screen.findByText(/vence en 30 minutos y solo sirve una vez/))
      .toBeInTheDocument();
  });

  describe("el enlace de desarrollo", () => {
    // El servidor solo lo manda fuera de produccion. La pantalla no tiene que
    // saber en que entorno esta: si no viene, no dibuja nada.
    it("no se dibuja si el servidor no lo manda", async () => {
      simularFetch([respuesta({ message: "Listo" })]);

      montar();

      await pedir();

      await screen.findByRole("status");
      expect(screen.queryByText("Enlace de desarrollo")).not.toBeInTheDocument();
    });

    // El backend arma el enlace apuntando al frontend original, que es el que
    // esta desplegado. Se saca el token para poder seguir en React.
    it("saca el token del enlace para seguir en esta aplicacion", async () => {
      simularFetch([respuesta({
        message: "Listo",
        enlaceDesarrollo: "http://localhost:3000/restablecer.html?token=abc123"
      })]);

      montar();

      await pedir();

      expect(await screen.findByText("Enlace de desarrollo")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Continuar aquí" }))
        .toHaveAttribute("href", "/restablecer?token=abc123");
    });

    it("no ofrece seguir aqui si el enlace no trae token", async () => {
      simularFetch([respuesta({
        message: "Listo",
        enlaceDesarrollo: "no es una dirección"
      })]);

      montar();

      await pedir();

      await screen.findByText("Enlace de desarrollo");
      expect(screen.queryByRole("link", { name: "Continuar aquí" })).not.toBeInTheDocument();
    });
  });
});

// ------------------------------------------------------------ restablecer

describe("RestablecerPage", () => {
  const montar = (ruta) =>
    render(<MemoryRouter initialEntries={[ruta]}><RestablecerPage /></MemoryRouter>);

  it("avisa mientras comprueba el enlace", () => {
    simularFetch(() => new Promise(() => {}));

    montar("/restablecer?token=abc123");

    expect(screen.getByText("Comprobando el enlace…")).toBeInTheDocument();
  });

  // Pedir una contrasena nueva para despues decir que el enlace caduco es la
  // peor manera de contarlo.
  it("comprueba el enlace antes de enseñar el formulario", async () => {
    const espia = simularFetch([respuesta({ data: { valido: true } })]);

    montar("/restablecer?token=abc123");

    await waitFor(() => expect(screen.getByLabelText(/Contraseña nueva/)).toBeInTheDocument());

    expect(espia.mock.calls[0][0]).toMatch(/\/auth\/restablecer\/abc123$/);
  });

  it("no enseña el formulario si el enlace ya no sirve", async () => {
    simularFetch([respuesta({ message: "Este enlace ya no sirve" }, { status: 400 })]);

    montar("/restablecer?token=caducado");

    expect(await screen.findByRole("alert")).toHaveTextContent("Este enlace ya no sirve");
    expect(screen.queryByLabelText(/Contraseña nueva/)).not.toBeInTheDocument();
  });

  it("lo dice tambien si la direccion no trae token, sin llamar al servidor", async () => {
    const espia = simularFetch([]);

    montar("/restablecer");

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("La dirección no trae ningún enlace de recuperación.");
    expect(espia).not.toHaveBeenCalled();
  });

  describe("al enviar", () => {
    async function conFormulario() {
      await waitFor(() => expect(screen.getByLabelText(/Contraseña nueva/)).toBeInTheDocument());
    }

    // La API recibe una sola contrasena: la repeticion es cosa de esta
    // pantalla, asi que se comprueba aqui.
    it("no llama al servidor si las dos no coinciden", async () => {
      const espia = simularFetch([respuesta({ data: { valido: true } })]);

      montar("/restablecer?token=abc123");
      await conFormulario();

      await userEvent.type(screen.getByLabelText(/Contraseña nueva/), "ClaveNueva1*");
      await userEvent.type(screen.getByLabelText("Repítela"), "OtraCosa2*");
      await userEvent.click(screen.getByRole("button", { name: /Guardar|Cambiar/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent("no coinciden");
      expect(espia).toHaveBeenCalledTimes(1);
    });

    it("manda el token y la contrasena, y lleva al login con un aviso", async () => {
      const espia = simularFetch([
        respuesta({ data: { valido: true } }),
        respuesta({ message: "Contraseña cambiada" })
      ]);

      montar("/restablecer?token=abc123");
      await conFormulario();

      await userEvent.type(screen.getByLabelText(/Contraseña nueva/), "ClaveNueva1*");
      await userEvent.type(screen.getByLabelText("Repítela"), "ClaveNueva1*");
      await userEvent.click(screen.getByRole("button", { name: /Guardar|Cambiar/ }));

      await waitFor(() => expect(navegar).toHaveBeenCalledWith("/login", {
        replace: true,
        state: { aviso: "Tu contraseña quedó cambiada. Ya puedes entrar." }
      }));

      expect(JSON.parse(espia.mock.calls[1][1].body))
        .toEqual({ token: "abc123", contrasena: "ClaveNueva1*" });
    });

    it("se queda si el servidor rechaza la contrasena", async () => {
      simularFetch([
        respuesta({ data: { valido: true } }),
        respuesta({ message: "La contraseña es demasiado corta" }, { status: 400 })
      ]);

      montar("/restablecer?token=abc123");
      await conFormulario();

      await userEvent.type(screen.getByLabelText(/Contraseña nueva/), "corta");
      await userEvent.type(screen.getByLabelText("Repítela"), "corta");
      await userEvent.click(screen.getByRole("button", { name: /Guardar|Cambiar/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent("demasiado corta");
      expect(navegar).not.toHaveBeenCalled();
    });
  });
});
