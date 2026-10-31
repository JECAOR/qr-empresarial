// ============================================
// APP — el mapa de rutas, y las dos pantallas de aviso
//
// Aqui no se vuelve a probar lo que hace cada pantalla: se prueba que cada
// direccion lleve a la suya y que las protegidas lo esten de verdad. Es el
// sitio donde un `path` mal escrito pasaria desapercibido, porque cada
// pantalla por separado funciona.
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "./App";
import NoEncontradaPage from "./pages/NoEncontrada/NoEncontradaPage";
import AccesoDenegadoPage from "./pages/AccesoDenegado/AccesoDenegadoPage";
import { ProveedorAuth } from "./context/AuthContext";
import { CLAVE_TOKEN } from "./services/apiClient";
import { respuesta, simularFetch, USUARIO_ADMIN, USUARIO_EMPRESA } from "./pruebas/ayudas";

/**
 * Monta la aplicación en una dirección.
 *
 * Cada pantalla pide sus datos nada más dibujarse, y aquí no interesa lo que
 * respondan: lo que se mira es a cuál se llegó. Por eso el fetch contesta
 * siempre lo mismo, un cuerpo vacío.
 */
function montar(ruta, usuario = null) {
  if (usuario) sessionStorage.setItem(CLAVE_TOKEN, "jwt");

  simularFetch((url) => {
    if (url.includes("/usuarios/me") && usuario) return respuesta({ data: usuario });

    // La actividad lee datos.totales nada más llegar, así que necesita la
    // forma mínima; a las demás les basta una lista vacía.
    if (url.includes("/estadisticas")) {
      return respuesta({
        data: {
          dias: 7,
          totales: { escaneos: 0, visitas: 0, clics: 0, conversion: 0 },
          serie: [],
          enlacesMasPulsados: []
        }
      });
    }

    return respuesta({ data: [] });
  });

  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth><App /></ProveedorAuth>
    </MemoryRouter>
  );
}

describe("las rutas abiertas", () => {
  // Es lo que ve quien escanea un codigo QR: si pidiera sesion, no serviria
  // para nada.
  it("la portada es el perfil publico y no pide sesion", async () => {
    montar("/");

    expect(await screen.findByLabelText(/Dirección pública del negocio/))
      .toBeInTheDocument();
  });

  // La direccion que llevan codificada los codigos QR. Va fuera de Layout:
  // quien escanea no viene a navegar por la aplicacion.
  it("/p/:slug entrega la pagina del negocio, sin barra de navegacion", async () => {
    montar("/p/panaderia-la-espiga");

    await waitFor(() => expect(screen.queryByText("Perfil público")).not.toBeInTheDocument());
  });

  it.each([
    ["/login", "Iniciar sesión"],
    ["/registro", "Crear una cuenta"],
    ["/recuperar", "Recuperar la contraseña"]
  ])("%s lleva a su pantalla", async (ruta, titulo) => {
    montar(ruta);

    expect(await screen.findByRole("heading", { name: titulo })).toBeInTheDocument();
  });

  // Quien no ha entrado no tiene donde navegar: la barra solo estorbaria.
  it("las pantallas de cuenta no llevan barra de navegacion", async () => {
    montar("/login");

    await screen.findByRole("heading", { name: "Iniciar sesión" });

    expect(screen.queryByText("Perfil público")).not.toBeInTheDocument();
  });

  it("la portada si la lleva", async () => {
    montar("/");

    expect(await screen.findByText("Perfil público")).toBeInTheDocument();
  });
});

describe("las rutas protegidas", () => {
  it.each(["/perfil", "/contenido", "/codigo-qr", "/actividad", "/configuracion"])(
    "%s manda al login sin sesion",
    async (ruta) => {
      montar(ruta);

      expect(await screen.findByRole("heading", { name: "Iniciar sesión" }))
        .toBeInTheDocument();
    }
  );

  it.each([
    ["/perfil", "Perfil del negocio"],
    ["/contenido", "Contenido del perfil"],
    ["/codigo-qr", "Tu código QR"],
    ["/actividad", "Actividad"],
    ["/configuracion", "Tu cuenta"]
  ])("%s se abre con sesion de empresa", async (ruta, titulo) => {
    montar(ruta, USUARIO_EMPRESA);

    expect(await screen.findByRole("heading", { name: titulo })).toBeInTheDocument();
  });
});

describe("las rutas de administrador", () => {
  it.each(["/usuarios", "/administracion"])(
    "%s le niega el paso a una empresa",
    async (ruta) => {
      montar(ruta, USUARIO_EMPRESA);

      expect(await screen.findByRole("heading", { name: "Acceso denegado" }))
        .toBeInTheDocument();
    }
  );

  it.each([
    ["/usuarios", "Gestión de usuarios"],
    ["/administracion", "Administración"]
  ])("%s se abre para un administrador", async (ruta, titulo) => {
    montar(ruta, USUARIO_ADMIN);

    expect(await screen.findByRole("heading", { name: titulo })).toBeInTheDocument();
  });
});

describe("una direccion que no existe", () => {
  // Antes el router mandaba cualquier ruta desconocida a la portada sin decir
  // nada, y quien escribia mal una direccion creia que habia llegado.
  it("se dice, en lugar de disimular llevando a la portada", async () => {
    montar("/una-direccion-que-no-existe");

    expect(await screen.findByRole("heading", { name: "Esta página no existe" }))
      .toBeInTheDocument();
    expect(screen.queryByLabelText(/Dirección pública del negocio/))
      .not.toBeInTheDocument();
  });

  it("conserva la barra, para poder salir de ahi", async () => {
    montar("/una-direccion-que-no-existe");

    expect(await screen.findByText("Perfil público")).toBeInTheDocument();
  });
});

describe("NoEncontradaPage", () => {
  it("recuerda la forma que tiene la direccion de un negocio", () => {
    render(<MemoryRouter><NoEncontradaPage /></MemoryRouter>);

    expect(screen.getByText("/p/nombre-del-negocio")).toBeInTheDocument();
  });

  it("ofrece volver al inicio", () => {
    render(<MemoryRouter><NoEncontradaPage /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
  });
});

describe("AccesoDenegadoPage", () => {
  it("dice de que tipo es la cuenta con la que se entro", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([respuesta({ data: USUARIO_EMPRESA })]);

    render(
      <MemoryRouter>
        <ProveedorAuth><AccesoDenegadoPage /></ProveedorAuth>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("empresa")).toBeInTheDocument());
  });

  // El guardia de React no es seguridad y la pantalla no finge que lo sea.
  it("recuerda que el servidor tambien lo impide", () => {
    simularFetch([]);

    render(
      <MemoryRouter>
        <ProveedorAuth><AccesoDenegadoPage /></ProveedorAuth>
      </MemoryRouter>
    );

    expect(screen.getByText("403")).toBeInTheDocument();
  });

  it("no se rompe si todavia no se sabe quien entro", () => {
    simularFetch([]);

    render(
      <MemoryRouter>
        <ProveedorAuth><AccesoDenegadoPage /></ProveedorAuth>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Acceso denegado" })).toBeInTheDocument();
  });
});
