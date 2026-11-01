// ============================================
// LAYOUT — la barra de navegacion
//
// Lo que se prueba es que no ofrezca puertas que van a dar 403, y que el
// nombre que enseña sea el de ahora y no uno guardado.
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Layout from "./Layout";
import { ProveedorAuth } from "../../context/AuthContext";
import { CLAVE_TOKEN } from "../../services/apiClient";
import { respuesta, simularFetch, USUARIO_ADMIN, USUARIO_EMPRESA } from "../../pruebas/ayudas";

function montar() {
  return render(
    <MemoryRouter initialEntries={["/perfil"]}>
      <ProveedorAuth>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/perfil" element={<p>mi negocio</p>} />
          </Route>
          <Route path="/login" element={<p>pantalla de entrar</p>} />
        </Routes>
      </ProveedorAuth>
    </MemoryRouter>
  );
}

/**
 * Monta con la sesión de un usuario ya resuelta.
 *
 * Se responde por ruta y no por orden: desde que la barra aplica el color de
 * marca (RF-12) hay dos peticiones al montar —quién eres y cuál es tu
 * perfil—, y una cola haría que la prueba dependiera de cuál se resuelve
 * primero.
 */
async function conSesionDe(usuario, { tema = "indigo", conPerfil = true } = {}) {
  sessionStorage.setItem(CLAVE_TOKEN, "jwt");

  simularFetch((url) => {
    if (url.endsWith("/usuarios/me")) return respuesta({ data: usuario });

    if (url.endsWith("/perfiles/me")) {
      return conPerfil
        ? respuesta({ data: { nombreNegocio: usuario.nombre, tema } })
        : respuesta({ message: "No tiene perfil todavía" }, { status: 404 });
    }

    if (url.endsWith("/auth/logout")) return respuesta(null, { status: 204 });

    throw new Error(`fetch sin respuesta preparada para ${url}`);
  });

  montar();

  await waitFor(() => expect(screen.getByText(usuario.nombre)).toBeInTheDocument());
}

describe("sin sesion", () => {
  it("solo ofrece el perfil publico y entrar", async () => {
    simularFetch([]);

    montar();

    await waitFor(() => expect(screen.getByText("Iniciar sesión")).toBeInTheDocument());

    expect(screen.getByText("Perfil público")).toBeInTheDocument();
    expect(screen.queryByText("Mi negocio")).not.toBeInTheDocument();
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();
    expect(screen.queryByText("Salir")).not.toBeInTheDocument();
  });
});

describe("con sesion de empresa", () => {
  it("ofrece las cinco pantallas del panel", async () => {
    await conSesionDe(USUARIO_EMPRESA);

    for (const enlace of ["Mi negocio", "Contenido", "Código QR", "Actividad", "Configuración"]) {
      expect(screen.getByText(enlace)).toBeInTheDocument();
    }
  });

  // usuario.routes.js solo autoriza al administrador: estos enlaces darian
  // 403 y la pantalla de acceso denegado.
  it("no ofrece las pantallas de administrador", async () => {
    await conSesionDe(USUARIO_EMPRESA);

    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  });

  it("enseña el nombre y el rol de quien entro", async () => {
    await conSesionDe(USUARIO_EMPRESA);

    expect(screen.getByText("empresa")).toBeInTheDocument();
  });
});

describe("con sesion de administrador", () => {
  it("añade Usuarios y Administracion", async () => {
    await conSesionDe(USUARIO_ADMIN);

    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Administración")).toBeInTheDocument();
  });
});

describe("salir", () => {
  it("cierra la sesion y lleva al login", async () => {
    await conSesionDe(USUARIO_EMPRESA);

    await userEvent.click(screen.getByText("Salir"));

    await waitFor(() => expect(screen.getByText("pantalla de entrar")).toBeInTheDocument());
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  // En un equipo compartido -el computador del mostrador- dejar puesto el
  // color de un negocio pintaria con el la pantalla de quien entre despues.
  it("se lleva tambien el color de marca", async () => {
    await conSesionDe(USUARIO_EMPRESA, { tema: "terracota" });

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "terracota"));

    await userEvent.click(screen.getByText("Salir"));

    await waitFor(() =>
      expect(document.documentElement).not.toHaveAttribute("data-theme"));
    expect(localStorage.getItem("qre_tema")).toBeNull();
  });
});

// --- El color de marca del negocio (RF-12) ---
//
// Se aplica aqui, en la barra, porque envuelve a todas las pantallas del
// panel: asi el perfil se pide una vez por sesion y no en cada pantalla.
//
// REGRESION. El selector de color se podia usar y el color se guardaba en la
// base, pero ninguna pantalla de React lo aplicaba: se elegia un color y no
// cambiaba nada. El texto del selector llegaba a decir "se aplica a tu
// página pública", que no era cierto.
describe("el color de marca", () => {
  it("aplica el del perfil del negocio", async () => {
    await conSesionDe(USUARIO_EMPRESA, { tema: "teal" });

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "teal"));
  });

  // El de defecto no pone atributo: sus colores son los del :root.
  it("no pone atributo si el negocio usa el color de defecto", async () => {
    await conSesionDe(USUARIO_EMPRESA, { tema: "indigo" });

    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  // Lo guarda para aplicarlo al arrancar la proxima vez, antes de que llegue
  // esta respuesta: es lo que evita ver un parpadeo de colores al recargar.
  it("lo recuerda para el proximo arranque", async () => {
    await conSesionDe(USUARIO_EMPRESA, { tema: "teal" });

    await waitFor(() => expect(localStorage.getItem("qre_tema")).toBe("teal"));
  });

  // 404: les pasa a las cuentas que creo el administrador desde
  // POST /api/usuarios. El color es lo de menos; la barra tiene que seguir.
  it("una cuenta sin perfil no rompe la barra", async () => {
    // El aviso es parte de lo que se prueba: se silencia para que no
    // ensucie la salida, igual que hace AuthContext.test.jsx.
    const silencio = vi.spyOn(console, "warn").mockImplementation(() => {});

    await conSesionDe(USUARIO_EMPRESA, { conPerfil: false });

    await waitFor(() => expect(silencio).toHaveBeenCalled());
    silencio.mockRestore();

    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  // Sin sesion no hay negocio del que tomar el color, y pedir /perfiles/me
  // daria un 401.
  it("sin sesion no se pide el perfil", async () => {
    const espia = simularFetch([]);

    montar();

    await waitFor(() => expect(screen.getByText("Iniciar sesión")).toBeInTheDocument());

    expect(espia).not.toHaveBeenCalled();
  });
});

describe("el contenido de la pantalla", () => {
  it("se dibuja debajo de la barra", async () => {
    await conSesionDe(USUARIO_EMPRESA);

    expect(screen.getByText("mi negocio")).toBeInTheDocument();
  });
});
