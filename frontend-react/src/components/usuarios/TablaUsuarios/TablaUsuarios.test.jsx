// ============================================
// TABLAUSUARIOS — el listado de cuentas
// ============================================

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TablaUsuarios from "./TablaUsuarios";

const USUARIOS = [
  { idUsuario: 1, nombre: "QR Empresarial", correo: "admin@caferaices.co", rol: "administrador", estado: "activo" },
  { idUsuario: 7, nombre: "Panadería La Espiga", correo: "contacto@laespiga.co", rol: "empresa", estado: "activo" },
  { idUsuario: 9, nombre: "Café Raíces", correo: "hola@caferaices.co", rol: "empresa", estado: "restringido" }
];

const props = (extra = {}) => ({
  usuarios: USUARIOS,
  yo: USUARIOS[0],
  onVer: vi.fn(),
  onEditar: vi.fn(),
  onEstado: vi.fn(),
  onEliminar: vi.fn(),
  ...extra
});

/** La fila de una cuenta, buscada por su correo. */
const filaDe = (correo) => screen.getByText(correo).closest("tr");

describe("lo que enseña", () => {
  // REGRESION, del lado del backend. GET /usuarios devolvia las filas crudas
  // de MySQL -id_usuario, fecha_registro- mientras el resto de la API
  // respondia en camelCase. Si volviera a hacerlo, aqui saldrian celdas
  // vacias en lugar de reventar, que es peor.
  it("lee los campos en camelCase, como responde la API desde la v2.5.0", () => {
    render(<TablaUsuarios {...props()} />);

    const fila = filaDe("contacto@laespiga.co");

    expect(within(fila).getByText("7")).toBeInTheDocument();
    expect(within(fila).getByText("Panadería La Espiga")).toBeInTheDocument();
    expect(within(fila).getByText("empresa")).toBeInTheDocument();
  });

  it("dibuja una fila por cuenta, mas la de cabecera", () => {
    render(<TablaUsuarios {...props()} />);

    expect(screen.getAllByRole("row")).toHaveLength(USUARIOS.length + 1);
  });

  // El ejemplo de la guia compara el estado con 1. Esta API manda la palabra,
  // asi que con el ejemplo todas las cuentas dirian "Inactivo".
  it("traduce el estado, que es una palabra y no un 1 o un 0", () => {
    render(<TablaUsuarios {...props()} />);

    expect(within(filaDe("contacto@laespiga.co")).getByText("Activo")).toBeInTheDocument();
    expect(within(filaDe("hola@caferaices.co")).getByText("Restringido")).toBeInTheDocument();
  });

  it("la tabla se anuncia con un resumen", () => {
    render(<TablaUsuarios {...props()} />);

    expect(screen.getByRole("table", { name: /Cuentas registradas/ })).toBeInTheDocument();
  });

  // En movil el CSS esconde la cabecera y usa estas etiquetas delante de cada
  // valor. Sin ellas, la tabla se vuelve una lista de datos sin nombre.
  it("cada celda lleva el nombre de su columna, para la vista de movil", () => {
    render(<TablaUsuarios {...props()} />);

    const fila = filaDe("contacto@laespiga.co");

    expect([...fila.querySelectorAll("td")].map((td) => td.dataset.label))
      .toEqual(["ID", "Nombre", "Correo", "Rol", "Estado", "Acciones"]);
  });

  it("no dibuja filas si no hay cuentas", () => {
    render(<TablaUsuarios {...props({ usuarios: [] })} />);

    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});

describe("la cuenta propia", () => {
  it("se marca para que se distinga", () => {
    render(<TablaUsuarios {...props()} />);

    expect(within(filaDe("admin@caferaices.co")).getByText("tu cuenta")).toBeInTheDocument();
    expect(within(filaDe("contacto@laespiga.co")).queryByText("tu cuenta")).not.toBeInTheDocument();
  });

  // El servidor responde 400 y, si fuera el unico administrador, nadie
  // podria volver a administrar el sistema. Ofrecer un boton que solo puede
  // fallar es una mala pantalla.
  it("no se puede restringir ni eliminar a uno mismo", () => {
    render(<TablaUsuarios {...props()} />);

    const mia = filaDe("admin@caferaices.co");

    expect(within(mia).getByText("Restringir")).toBeDisabled();
    expect(within(mia).getByText("Eliminar")).toBeDisabled();
  });

  it("explica por que estan apagados", () => {
    render(<TablaUsuarios {...props()} />);

    const mia = filaDe("admin@caferaices.co");

    expect(within(mia).getByText("Restringir"))
      .toHaveAttribute("title", "No puedes restringir tu propia cuenta");
    expect(within(mia).getByText("Eliminar"))
      .toHaveAttribute("title", "No puedes eliminar tu propia cuenta");
  });

  it("si ya esta restringida, se puede volver a activar", () => {
    const yo = { idUsuario: 9 };

    render(<TablaUsuarios {...props({ yo })} />);

    expect(within(filaDe("hola@caferaices.co")).getByText("Activar")).toBeEnabled();
  });

  it("las demas cuentas conservan sus botones", () => {
    render(<TablaUsuarios {...props()} />);

    const otra = filaDe("contacto@laespiga.co");

    expect(within(otra).getByText("Restringir")).toBeEnabled();
    expect(within(otra).getByText("Eliminar")).toBeEnabled();
  });

  // Si `yo` no llega todavia, ninguna fila es la propia: no se puede marcar
  // una al azar.
  it("no marca ninguna si no se sabe quien mira", () => {
    render(<TablaUsuarios {...props({ yo: null })} />);

    expect(screen.queryByText("tu cuenta")).not.toBeInTheDocument();
  });
});

describe("las acciones", () => {
  it("avisan con la cuenta entera", async () => {
    const p = props();

    render(<TablaUsuarios {...p} />);

    const fila = filaDe("contacto@laespiga.co");

    await userEvent.click(within(fila).getByText("Ver"));
    await userEvent.click(within(fila).getByText("Editar"));
    await userEvent.click(within(fila).getByText("Restringir"));
    await userEvent.click(within(fila).getByText("Eliminar"));

    expect(p.onVer).toHaveBeenCalledWith(USUARIOS[1]);
    expect(p.onEditar).toHaveBeenCalledWith(USUARIOS[1]);
    expect(p.onEstado).toHaveBeenCalledWith(USUARIOS[1]);
    expect(p.onEliminar).toHaveBeenCalledWith(USUARIOS[1]);
  });
});
