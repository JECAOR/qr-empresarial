// ============================================
// AUTHCONTEXT — la sesion
//
// Lo que se prueba aqui no es que guarde un objeto, sino las tres decisiones
// que toma: no fiarse de lo que hay en el navegador, no decidir nada mientras
// no lo sepa, y tirar la sesion local si el servidor la rechaza.
// ============================================

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProveedorAuth, useAuth } from "./AuthContext";
import { CLAVE_TOKEN } from "../services/apiClient";
import { respuesta, simularFetch, USUARIO_ADMIN, USUARIO_EMPRESA } from "../pruebas/ayudas";

/** Una pantalla minima que enseña lo que el contexto le da. */
function Espia({ alEntrar }) {
  const { usuario, cargando, entrar, salir, refrescar } = useAuth();

  if (cargando) return <p>cargando</p>;

  // Ojo con `alEntrar?.(await entrar(...))`: la llamada opcional no evalua sus
  // argumentos cuando alEntrar es undefined, de modo que entrar() no se
  // llamaba y la prueba fallaba por culpa de la prueba.
  async function pulsarEntrar() {
    const nuevo = await entrar("a@b.co", "x");

    if (alEntrar) alEntrar(nuevo);
  }

  return (
    <div>
      <p data-testid="quien">{usuario ? usuario.nombre : "sin sesión"}</p>
      <p data-testid="rol">{usuario?.rol ?? "—"}</p>

      <button onClick={pulsarEntrar}>entrar</button>
      <button onClick={salir}>salir</button>
      <button onClick={refrescar}>refrescar</button>
    </div>
  );
}

const montar = (props) => render(<ProveedorAuth><Espia {...props} /></ProveedorAuth>);

describe("al arrancar", () => {
  it("no pregunta nada si no hay token", async () => {
    const espia = simularFetch([]);

    montar();

    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("sin sesión"));
    expect(espia).not.toHaveBeenCalled();
  });

  // Mientras no se sepa si hay sesion no se puede decidir si echar a nadie al
  // login. Sin esto, al recargar una pantalla privada se ve un parpadeo.
  it("dice que esta cargando hasta que el servidor conteste", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");

    let contestar;

    simularFetch(() => new Promise((resolver) => { contestar = resolver; }));

    montar();

    expect(screen.getByText("cargando")).toBeInTheDocument();

    await act(async () => {
      contestar(respuesta({ data: USUARIO_EMPRESA }));
    });

    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("La Espiga"));
  });

  // Lo guardado en sessionStorage puede estar viejo o manipulado: lo que vale
  // es lo que diga el servidor.
  it("le pregunta al servidor en lugar de creerse lo guardado", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    sessionStorage.setItem("qre_usuario", JSON.stringify({ ...USUARIO_EMPRESA, rol: "administrador" }));

    const espia = simularFetch([respuesta({ data: USUARIO_EMPRESA })]);

    montar();

    await waitFor(() => expect(screen.getByTestId("rol")).toHaveTextContent("empresa"));
    expect(espia.mock.calls[0][0]).toMatch(/\/usuarios\/me$/);
  });

  it("tira la sesion si el token ya no vale", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "caducado");

    simularFetch([
      respuesta({ message: "Token inválido" }, { status: 401 }),
      respuesta(null, { status: 204 }) // el logout que dispara el fallo
    ]);

    montar();

    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("sin sesión"));
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });
});

describe("normalizar el perfil", () => {
  // El login responde {data: {usuario}} y GET /usuarios/me responde {data} a
  // secas. Dar por hecho que son iguales es el error que avisa la guia.
  it("entiende tanto data.usuario como data a secas", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([respuesta({ data: { ...USUARIO_ADMIN, estado: "activo" } })]);

    montar();

    await waitFor(() => expect(screen.getByTestId("rol")).toHaveTextContent("administrador"));
  });

  // Sin rol no se puede proteger nada, y una pantalla sin rol parece correcta
  // hasta que alguien entra donde no debe.
  it("se niega a aceptar un perfil sin rol", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");

    simularFetch([
      respuesta({ data: { idUsuario: 7, nombre: "Sin rol" } }),
      respuesta(null, { status: 204 })
    ]);

    montar();

    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("sin sesión"));
  });

  it("tampoco acepta un rol que no sea una cadena", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");

    // Asi lo manda el ejemplo de las guias: {id, name}
    simularFetch([
      respuesta({ data: { idUsuario: 7, nombre: "X", rol: { id: 2, name: "empresa" } } }),
      respuesta(null, { status: 204 })
    ]);

    montar();

    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("sin sesión"));
  });
});

describe("entrar(), salir() y refrescar()", () => {
  it("entrar deja la sesion puesta y devuelve el usuario", async () => {
    const usuarios = [];

    simularFetch([respuesta({ data: { token: "jwt", usuario: USUARIO_ADMIN } })]);

    montar({ alEntrar: (u) => usuarios.push(u) });

    await waitFor(() => screen.getByText("entrar"));
    await userEvent.click(screen.getByText("entrar"));

    await waitFor(() => expect(screen.getByTestId("rol")).toHaveTextContent("administrador"));

    // Lo devuelve ademas de guardarlo porque quien llama necesita el rol ya
    // mismo para decidir a que pantalla ir, antes de que React redibuje.
    expect(usuarios[0]).toEqual(USUARIO_ADMIN);
  });

  it("salir borra la sesion", async () => {
    simularFetch([
      respuesta({ data: { token: "jwt", usuario: USUARIO_EMPRESA } }),
      respuesta(null, { status: 204 })
    ]);

    montar();

    await waitFor(() => screen.getByText("entrar"));
    await userEvent.click(screen.getByText("entrar"));
    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("La Espiga"));

    await userEvent.click(screen.getByText("salir"));

    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("sin sesión"));
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  // Regresion. Al cambiar el nombre en Configuracion, la barra seguia con el
  // viejo hasta recargar la pagina. refrescar() vuelve a preguntar.
  it("refrescar trae el nombre nuevo sin recargar la pagina", async () => {
    simularFetch([
      respuesta({ data: { token: "jwt", usuario: USUARIO_EMPRESA } }),
      respuesta({ data: { ...USUARIO_EMPRESA, nombre: "Panadería La Espiga S.A.S" } })
    ]);

    montar();

    await waitFor(() => screen.getByText("entrar"));
    await userEvent.click(screen.getByText("entrar"));
    await waitFor(() => expect(screen.getByTestId("quien")).toHaveTextContent("Panadería La Espiga"));

    await userEvent.click(screen.getByText("refrescar"));

    await waitFor(() =>
      expect(screen.getByTestId("quien")).toHaveTextContent("Panadería La Espiga S.A.S"));
  });
});

describe("useAuth()", () => {
  it("avisa claro si se usa fuera del proveedor", () => {
    // React escribe el error en la consola ademas de lanzarlo
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Espia />)).toThrow("useAuth se usó fuera de ProveedorAuth");

    silencio.mockRestore();
  });
});
