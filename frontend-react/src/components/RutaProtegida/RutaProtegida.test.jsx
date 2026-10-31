// ============================================
// RUTAPROTEGIDA — quien pasa y quien no
//
// Esto NO es seguridad y las pruebas no pretenden demostrar que lo sea: quien
// llame a la API con curl se lo salta entero, y por eso Express comprueba el
// rol en cada endpoint. Lo que se prueba aqui es que no se ofrezcan puertas
// que solo pueden dar error, y que nadie se quede fuera de la suya.
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import RutaProtegida from "./RutaProtegida";
import { ProveedorAuth } from "../../context/AuthContext";
import { CLAVE_TOKEN } from "../../services/apiClient";
import { respuesta, simularFetch, USUARIO_ADMIN, USUARIO_EMPRESA } from "../../pruebas/ayudas";

/** Monta un mapa de rutas pequeño con el guardia puesto. */
function montar(ruta, rolesPermitidos) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth>
        <Routes>
          <Route path="/login" element={<p>pantalla de entrar</p>} />
          <Route path="/acceso-denegado" element={<p>acceso denegado</p>} />

          <Route element={<RutaProtegida rolesPermitidos={rolesPermitidos} />}>
            <Route path="/contenido" element={<p>contenido</p>} />
            <Route path="/administracion" element={<p>administración</p>} />
          </Route>
        </Routes>
      </ProveedorAuth>
    </MemoryRouter>
  );
}

/** Deja el token puesto y prepara la respuesta de /usuarios/me. */
function conSesionDe(usuario) {
  sessionStorage.setItem(CLAVE_TOKEN, "jwt");
  simularFetch([respuesta({ data: usuario })]);
}

describe("sin sesion", () => {
  it("manda al login", async () => {
    simularFetch([]);

    montar("/contenido");

    await waitFor(() => expect(screen.getByText("pantalla de entrar")).toBeInTheDocument());
  });

  // Sin esto, quien abra un enlace a /contenido sin sesion acaba en el panel
  // de siempre despues de entrar y tiene que volver a buscar a donde iba.
  it("recuerda a donde iba para devolverlo despues de entrar", async () => {
    simularFetch([]);

    let estado;

    render(
      <MemoryRouter initialEntries={["/contenido"]}>
        <ProveedorAuth>
          <Routes>
            <Route path="/login" element={<Destino alLlegar={(s) => { estado = s; }} />} />
            <Route element={<RutaProtegida />}>
              <Route path="/contenido" element={<p>contenido</p>} />
            </Route>
          </Routes>
        </ProveedorAuth>
      </MemoryRouter>
    );

    await waitFor(() => expect(estado).toEqual({ desde: "/contenido" }));
  });

  it("no enseña nada de la pantalla privada mientras comprueba la sesion", () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch(() => new Promise(() => {})); // nunca contesta

    montar("/contenido");

    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
    expect(screen.queryByText("pantalla de entrar")).not.toBeInTheDocument();
    expect(screen.getByText(/Verificando sesión/)).toBeInTheDocument();
  });
});

describe("con sesion", () => {
  it("deja pasar a una ruta sin roles exigidos", async () => {
    conSesionDe(USUARIO_EMPRESA);

    montar("/contenido");

    await waitFor(() => expect(screen.getByText("contenido")).toBeInTheDocument());
  });

  it("deja pasar al administrador a una ruta de administrador", async () => {
    conSesionDe(USUARIO_ADMIN);

    montar("/administracion", ["administrador"]);

    await waitFor(() => expect(screen.getByText("administración")).toBeInTheDocument());
  });

  it("manda a acceso denegado a una empresa en una ruta de administrador", async () => {
    conSesionDe(USUARIO_EMPRESA);

    montar("/administracion", ["administrador"]);

    await waitFor(() => expect(screen.getByText("acceso denegado")).toBeInTheDocument());
  });

  // Al login no: tiene sesion. Mandarlo alli le haria pensar que se le cayo.
  it("no manda al login a quien tiene sesion pero le falta el rol", async () => {
    conSesionDe(USUARIO_EMPRESA);

    montar("/administracion", ["administrador"]);

    await waitFor(() => screen.getByText("acceso denegado"));
    expect(screen.queryByText("pantalla de entrar")).not.toBeInTheDocument();
  });

  it("acepta varios roles permitidos", async () => {
    conSesionDe(USUARIO_EMPRESA);

    montar("/administracion", ["administrador", "empresa"]);

    await waitFor(() => expect(screen.getByText("administración")).toBeInTheDocument());
  });
});

/** Una pantalla que cuenta con qué estado llegó. */
function Destino({ alLlegar }) {
  const { state } = useLocation();

  alLlegar(state);

  return <p>pantalla de entrar</p>;
}
