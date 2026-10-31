// ============================================
// LAYOUT — la barra de navegacion
//
// Lo que se prueba es que no ofrezca puertas que van a dar 403, y que el
// nombre que enseña sea el de ahora y no uno guardado.
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

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

/** Monta con la sesión de un usuario ya resuelta. */
async function conSesionDe(usuario) {
  sessionStorage.setItem(CLAVE_TOKEN, "jwt");
  simularFetch([respuesta({ data: usuario })]);

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
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");

    simularFetch([
      respuesta({ data: USUARIO_EMPRESA }),
      respuesta(null, { status: 204 }) // el logout
    ]);

    montar();

    await waitFor(() => screen.getByText("Salir"));
    await userEvent.click(screen.getByText("Salir"));

    await waitFor(() => expect(screen.getByText("pantalla de entrar")).toBeInTheDocument());
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });
});

describe("el contenido de la pantalla", () => {
  it("se dibuja debajo de la barra", async () => {
    await conSesionDe(USUARIO_EMPRESA);

    expect(screen.getByText("mi negocio")).toBeInTheDocument();
  });
});
