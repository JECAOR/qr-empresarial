// ============================================
// LOGINPAGE — entrar
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import LoginPage from "./LoginPage";
import { ProveedorAuth } from "../../context/AuthContext";
import { CLAVE_TOKEN } from "../../services/apiClient";
import { respuesta, simularFetch, USUARIO_ADMIN, USUARIO_EMPRESA } from "../../pruebas/ayudas";

// Ya no se espia useNavigate. Se hacia porque la pantalla tenia dos salidas
// -un navegar() despues del await y un <Navigate> al dibujar- y en jsdom
// ganaba una y en el navegador la otra, asi que lo unico comprobable aqui
// era a donde MANDABA la llamada. Ahora hay una sola salida, declarativa, y
// se comprueba donde aterriza de verdad: en el mapa de rutas de montar().

/** Monta el login con un mapa de rutas que delata a dónde fue a parar. */
function montar(entrada = "/login") {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <ProveedorAuth>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>perfil público</p>} />
          <Route path="/usuarios" element={<p>gestión de usuarios</p>} />
          <Route path="/contenido" element={<p>contenido</p>} />
          <Route path="/recuperar" element={<p>recuperar</p>} />
          <Route path="/registro" element={<p>registro</p>} />
        </Routes>
      </ProveedorAuth>
    </MemoryRouter>
  );
}

/** Rellena el formulario y lo envía. */
async function entrarCon(correo = "contacto@laespiga.co", contrasena = "Clave123*") {
  await userEvent.type(screen.getByLabelText("Correo electrónico"), correo);
  await userEvent.type(screen.getByLabelText("Contraseña"), contrasena);
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

const sesionDe = (usuario) => respuesta({ data: { token: "jwt", usuario } });

describe("el formulario", () => {
  it("pide correo y contrasena, con los tipos correctos", async () => {
    simularFetch([]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
  });

  // Sin esto, el gestor de contrasenas del navegador no reconoce el
  // formulario y no ofrece la clave guardada.
  it("marca los campos para el gestor de contrasenas", async () => {
    simularFetch([]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));

    expect(screen.getByLabelText("Correo electrónico"))
      .toHaveAttribute("autoComplete", "username");
    expect(screen.getByLabelText("Contraseña"))
      .toHaveAttribute("autoComplete", "current-password");
  });

  it("ofrece recuperar la contrasena y crear una cuenta", async () => {
    simularFetch([]);

    montar();

    await waitFor(() => screen.getByText(/¿Olvidaste tu contraseña\?/));

    expect(screen.getByText("Crear una")).toBeInTheDocument();
  });
});

describe("a donde lleva al entrar", () => {
  // REGRESION. Antes llevaba a todo el mundo a /usuarios, que es solo para
  // administradores: una cuenta de empresa entraba bien y aterrizaba en
  // "Acceso denegado", que parece un error del sistema.
  it("una empresa va al perfil publico, no a una pantalla de administrador", async () => {
    simularFetch([sesionDe(USUARIO_EMPRESA)]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon();

    expect(await screen.findByText("perfil público")).toBeInTheDocument();
  });

  it("un administrador va a la gestion de usuarios", async () => {
    simularFetch([sesionDe(USUARIO_ADMIN)]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon("admin@caferaices.co");

    expect(await screen.findByText("gestión de usuarios")).toBeInTheDocument();
  });

  // REGRESION. El guardia deja escrito a donde iba; devolverlo ahi es la
  // diferencia entre abrir un enlace guardado y tener que buscar otra vez la
  // pantalla.
  //
  // Esta prueba miraba antes a donde MANDABA navegar(), porque con dos
  // salidas compitiendo el resultado dependia del entorno. Lo que pasaba en
  // el navegador -que la otra salida ganaba y se aterrizaba en la portada-
  // lo encontro pruebas-e2e/entrar.spec.js, no esta prueba.
  it("devuelve a donde iba si llego rebotado de una pantalla privada", async () => {
    simularFetch([sesionDe(USUARIO_EMPRESA)]);

    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { desde: "/contenido" } }]}>
        <ProveedorAuth>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>perfil público</p>} />
            <Route path="/contenido" element={<p>contenido</p>} />
          </Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon();

    expect(await screen.findByText("contenido")).toBeInTheDocument();
  });

  // Quien ya entro no tiene nada que hacer en el login.
  it("echa de aqui a quien ya tiene sesion", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([respuesta({ data: USUARIO_ADMIN })]);

    montar();

    await waitFor(() => expect(screen.getByText("gestión de usuarios")).toBeInTheDocument());
  });

  // Mientras no se sepa si hay sesion no se puede decidir nada: sin esto se
  // veria el formulario un instante antes de saltar al panel.
  it("no decide nada mientras comprueba la sesion", () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch(() => new Promise(() => {}));

    montar();

    expect(screen.queryByText("gestión de usuarios")).not.toBeInTheDocument();
  });
});

describe("cuando algo falla", () => {
  it("enseña el mensaje del servidor y se queda", async () => {
    simularFetch([respuesta({ message: "Credenciales incorrectas" }, { status: 401 })]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon("contacto@laespiga.co", "mal");

    const error = await screen.findByRole("alert");

    expect(error).toHaveTextContent("Credenciales incorrectas");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  // RN-03: el servidor limita los intentos. El mensaje tiene que llegar tal
  // cual o el usuario no entiende por que deja de funcionar.
  it("enseña tambien el aviso de demasiados intentos", async () => {
    simularFetch([
      respuesta({ message: "Demasiados intentos. Espere 15 minutos." }, { status: 429 })
    ]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon();

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos");
  });

  it("deja volver a intentarlo", async () => {
    simularFetch([
      respuesta({ message: "Credenciales incorrectas" }, { status: 401 }),
      sesionDe(USUARIO_EMPRESA)
    ]);

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon("contacto@laespiga.co", "mal");
    await screen.findByRole("alert");

    await userEvent.clear(screen.getByLabelText("Contraseña"));
    await userEvent.type(screen.getByLabelText("Contraseña"), "Clave123*");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("perfil público")).toBeInTheDocument();
  });

  it("apaga el boton mientras lo intenta", async () => {
    let contestar;

    simularFetch(() => new Promise((resolver) => { contestar = resolver; }));

    montar();

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon();

    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();

    contestar(sesionDe(USUARIO_EMPRESA));
  });
});

describe("el aviso que deja otra pantalla", () => {
  // Lo deja RestablecerPage al terminar, para no perder el hilo.
  it("se enseña al llegar", async () => {
    simularFetch([]);

    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/login", state: { aviso: "Contraseña cambiada. Entra de nuevo." } }]}
      >
        <ProveedorAuth>
          <Routes><Route path="/login" element={<LoginPage />} /></Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    expect(await screen.findByRole("status"))
      .toHaveTextContent("Contraseña cambiada. Entra de nuevo.");
  });

  // Dos mensajes a la vez, uno bueno y uno malo, se contradicen.
  it("se quita en cuanto hay un error", async () => {
    simularFetch([respuesta({ message: "Credenciales incorrectas" }, { status: 401 })]);

    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { aviso: "Contraseña cambiada." } }]}>
        <ProveedorAuth>
          <Routes><Route path="/login" element={<LoginPage />} /></Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByLabelText("Correo electrónico"));
    await entrarCon("a@b.co", "mal");

    await screen.findByRole("alert");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
