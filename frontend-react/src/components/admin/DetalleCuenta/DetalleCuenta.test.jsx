// ============================================
// DETALLECUENTA — lo que la tabla no cabe
// ============================================

import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DetalleCuenta from "./DetalleCuenta";

const CUENTA = {
  idUsuario: 7,
  nombre: "Panadería La Espiga",
  correo: "contacto@laespiga.co",
  rol: "empresa",
  estado: "activo",
  fechaRegistro: "2026-09-14T10:00:00.000Z",
  ultimoAcceso: "2026-10-23T15:30:00.000Z",
  perfil: { nombreNegocio: "Panadería La Espiga", qr: true },
  actividad: { escaneos: 42, visitas: 58, clics: 17 },
  ultimosEventos: [
    { tipo: "escaneo", fecha: "2026-10-23T15:00:00.000Z", enlace: null },
    { tipo: "clic", fecha: "2026-10-23T14:00:00.000Z", enlace: "https://wa.me/57300" }
  ]
};

/** El valor de una fila del <dl>, buscándolo por su etiqueta. */
function dato(etiqueta) {
  const dt = screen.getByText(etiqueta);

  return dt.parentElement.querySelector("dd").textContent;
}

describe("se abre y se cierra", () => {
  it("se abre como modal", () => {
    const { container } = render(<DetalleCuenta cuenta={CUENTA} onCerrar={() => {}} />);

    expect(container.querySelector("dialog").open).toBe(true);
  });

  // REGRESION. El efecto llevaba una limpieza que llamaba a close(), close()
  // dispara el evento close, close llama a onCerrar y onCerrar borraba el
  // estado de quien lo dibuja. Con StrictMode, que monta, desmonta y vuelve a
  // montar, el dialogo se cerraba solo una fraccion de segundo despues de
  // abrirse.
  it("sigue abierto en StrictMode, que monta el componente dos veces", () => {
    const alCerrar = vi.fn();

    const { container } = render(
      <StrictMode><DetalleCuenta cuenta={CUENTA} onCerrar={alCerrar} /></StrictMode>
    );

    expect(container.querySelector("dialog").open).toBe(true);
    expect(alCerrar).not.toHaveBeenCalled();
  });

  // Sin la guarda, el segundo montaje de StrictMode llamaria a showModal()
  // sobre un dialogo ya abierto, que lanza InvalidStateError.
  it("no vuelve a abrir uno ya abierto", () => {
    const abrir = vi.spyOn(HTMLDialogElement.prototype, "showModal");

    render(<StrictMode><DetalleCuenta cuenta={CUENTA} onCerrar={() => {}} /></StrictMode>);

    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it("avisa al cerrarse con el boton", async () => {
    const alCerrar = vi.fn();

    render(<DetalleCuenta cuenta={CUENTA} onCerrar={alCerrar} />);

    await userEvent.click(screen.getByLabelText("Cerrar"));

    expect(alCerrar).toHaveBeenCalled();
  });

  it("avisa cuando lo cierra el navegador, por ejemplo con Escape", () => {
    const alCerrar = vi.fn();

    const { container } = render(<DetalleCuenta cuenta={CUENTA} onCerrar={alCerrar} />);

    container.querySelector("dialog").close();

    expect(alCerrar).toHaveBeenCalled();
  });
});

describe("lo que enseña", () => {
  it("el nombre, el correo, el rol y el estado", () => {
    render(<DetalleCuenta cuenta={CUENTA} onCerrar={() => {}} />);

    expect(screen.getByRole("heading", { name: "Panadería La Espiga" })).toBeInTheDocument();
    expect(screen.getByText("contacto@laespiga.co")).toBeInTheDocument();
    expect(dato("Rol")).toBe("empresa");
    expect(dato("Estado")).toBe("activo");
  });

  it("las tres cifras de actividad", () => {
    render(<DetalleCuenta cuenta={CUENTA} onCerrar={() => {}} />);

    expect(dato("Escaneos")).toBe("42");
    expect(dato("Visitas")).toBe("58");
    expect(dato("Clics")).toBe("17");
  });

  it("dice que nunca entro en lugar de dejar la fecha en blanco", () => {
    render(<DetalleCuenta cuenta={{ ...CUENTA, ultimoAcceso: null }} onCerrar={() => {}} />);

    expect(dato("Último acceso")).toBe("Nunca entró");
  });

  it("dice que no tiene perfil si no lo tiene", () => {
    render(<DetalleCuenta cuenta={{ ...CUENTA, perfil: null }} onCerrar={() => {}} />);

    expect(dato("Negocio")).toBe("Sin perfil");
    expect(screen.queryByText("Código QR")).not.toBeInTheDocument();
  });

  // Son tres estados distintos y el null no es un false: un codigo sin
  // generar y uno retirado no son lo mismo.
  it.each([
    [true, "Publicado"],
    [false, "Retirado"],
    [null, "Sin generar"]
  ])("con qr=%s dice %s", (qr, esperado) => {
    render(
      <DetalleCuenta cuenta={{ ...CUENTA, perfil: { ...CUENTA.perfil, qr } }} onCerrar={() => {}} />
    );

    expect(dato("Código QR")).toBe(esperado);
  });
});

describe("la actividad reciente", () => {
  it("traduce el tipo de evento a algo legible", () => {
    render(<DetalleCuenta cuenta={CUENTA} onCerrar={() => {}} />);

    const eventos = screen.getByRole("list");

    expect(within(eventos).getByText(/Escaneó el código/)).toBeInTheDocument();
    expect(within(eventos).getByText(/Pulsó un enlace/)).toBeInTheDocument();
  });

  it("enseña el enlace pulsado cuando lo hay", () => {
    render(<DetalleCuenta cuenta={CUENTA} onCerrar={() => {}} />);

    expect(screen.getByText(/wa\.me/)).toBeInTheDocument();
  });

  // Un tipo que no conozcamos no puede dejar el renglon en blanco.
  it("enseña el tipo tal cual si no sabe traducirlo", () => {
    render(
      <DetalleCuenta
        cuenta={{ ...CUENTA, ultimosEventos: [{ tipo: "algo-nuevo", fecha: CUENTA.fechaRegistro }] }}
        onCerrar={() => {}}
      />
    );

    expect(screen.getByText(/algo-nuevo/)).toBeInTheDocument();
  });

  it("dice que no hay actividad en lugar de dejar una lista vacia", () => {
    render(<DetalleCuenta cuenta={{ ...CUENTA, ultimosEventos: [] }} onCerrar={() => {}} />);

    expect(screen.getByText("Sin actividad todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("marca la hora en un <time> legible por maquinas", () => {
    const { container } = render(<DetalleCuenta cuenta={CUENTA} onCerrar={() => {}} />);

    expect(container.querySelector("time").getAttribute("datetime"))
      .toBe("2026-10-23T15:00:00.000Z");
  });
});
