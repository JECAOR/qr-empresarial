// ============================================
// LISTABLOQUES — los bloques de una seccion, en su orden
//
// Se reordena de dos maneras a proposito: arrastrando, que es lo comodo con
// raton, y con flechas, porque el arrastre de HTML no funciona con el dedo y
// en un movil la lista quedaria sin forma de reordenarse.
// ============================================

import { Profiler } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ListaBloques from "./ListaBloques";

const BLOQUES = [
  { id: "enlace-1", titulo: "Escríbenos", detalle: "https://wa.me/57300", tipo: "enlace", activo: true, categoria: { nombre: "WhatsApp" } },
  { id: "enlace-2", titulo: "Cómo llegar", detalle: "https://maps.app/x", tipo: "enlace", activo: true, categoria: { nombre: "Google Maps" } },
  { id: "elemento-3", titulo: "Horneamos cada mañana", detalle: "Pan de masa madre", tipo: "texto", activo: false, categoria: null }
];

const props = (extra = {}) => ({
  bloques: BLOQUES,
  onEditar: vi.fn(),
  onEstado: vi.fn(),
  onEliminar: vi.fn(),
  onMover: vi.fn(),
  ocupado: false,
  ...extra
});

const filas = () => screen.getAllByRole("listitem");

describe("lo que enseña", () => {
  it("los bloques en su orden, numerados desde uno", () => {
    render(<ListaBloques {...props()} />);

    const numeros = filas().map((li) => li.querySelector(".bloque__numero").textContent);

    expect(numeros).toEqual(["1", "2", "3"]);
    expect(within(filas()[0]).getByText("Escríbenos")).toBeInTheDocument();
  });

  it("usa el nombre de la categoria cuando lo hay", () => {
    render(<ListaBloques {...props()} />);

    expect(within(filas()[0]).getByText("WhatsApp")).toBeInTheDocument();
  });

  // Un bloque de texto puede no traer categoria, y "undefined" en la pantalla
  // es peor que el nombre del tipo.
  it("cae en el nombre del tipo si no hay categoria", () => {
    render(<ListaBloques {...props()} />);

    expect(within(filas()[2]).getByText("Texto")).toBeInTheDocument();
  });

  it("marca los bloques apagados", () => {
    render(<ListaBloques {...props()} />);

    expect(filas()[2]).toHaveClass("bloque--apagado");
    expect(within(filas()[2]).getByText("Desactivado")).toBeInTheDocument();
    expect(within(filas()[2]).getByText("Activar")).toBeInTheDocument();
    expect(within(filas()[0]).getByText("Desactivar")).toBeInTheDocument();
  });
});

describe("reordenar con las flechas", () => {
  it("sube un bloque", async () => {
    const p = props();

    render(<ListaBloques {...p} />);

    await userEvent.click(screen.getByLabelText("Subir Cómo llegar"));

    expect(p.onMover).toHaveBeenCalledWith(1, 0);
  });

  it("baja un bloque", async () => {
    const p = props();

    render(<ListaBloques {...p} />);

    await userEvent.click(screen.getByLabelText("Bajar Escríbenos"));

    expect(p.onMover).toHaveBeenCalledWith(0, 1);
  });

  it("el primero no se puede subir ni el ultimo bajar", () => {
    render(<ListaBloques {...props()} />);

    expect(screen.getByLabelText("Subir Escríbenos")).toBeDisabled();
    expect(screen.getByLabelText("Bajar Horneamos cada mañana")).toBeDisabled();
    expect(screen.getByLabelText("Bajar Escríbenos")).toBeEnabled();
  });

  // Las flechas son botones de verdad, no divs con onClick: se alcanzan con
  // el teclado y el lector de pantalla las anuncia.
  it("las flechas se pueden usar con el teclado", async () => {
    const p = props();

    render(<ListaBloques {...p} />);

    screen.getByLabelText("Bajar Escríbenos").focus();
    await userEvent.keyboard("{Enter}");

    expect(p.onMover).toHaveBeenCalledWith(0, 1);
  });
});

describe("reordenar arrastrando", () => {
  it("mueve del origen al destino", () => {
    const p = props();

    render(<ListaBloques {...p} />);

    fireEvent.dragStart(filas()[2]);
    fireEvent.drop(filas()[0]);

    expect(p.onMover).toHaveBeenCalledWith(2, 0);
  });

  it("mueve igual con los tres eventos seguidos", () => {
    const p = props();

    render(<ListaBloques {...p} />);

    const li = filas();

    fireEvent.dragStart(li[0]);
    fireEvent.dragOver(li[2]);
    fireEvent.drop(li[2]);

    expect(p.onMover).toHaveBeenCalledWith(0, 2);
  });

  // REGRESION, por la via indirecta. El indice de origen vivia en estado de
  // React y el arrastre fallaba al ser rapido: los tres eventos caen en el
  // mismo tic y el estado todavia no se ha aplicado cuando llega el drop.
  //
  // Esa carrera NO se puede reproducir aqui: fireEvent envuelve cada evento
  // en act(), que vacia la cola de React, de modo que con estado la prueba
  // tambien pasaria. Se comprobo volviendo a poner el useState: las dieciseis
  // pruebas seguian en verde.
  //
  // Lo que si distingue las dos versiones es que una ref no redibuja. Si
  // empezar un arrastre provoca un redibujado, el indice ha vuelto al estado
  // y la carrera vuelve con el.
  it("empezar un arrastre no redibuja la lista", () => {
    let dibujos = 0;

    // El Profiler cuenta los commits del subarbol. Contarlos desde un
    // componente que envuelva a la lista no sirve: el padre no se redibuja
    // porque cambie el estado del hijo.
    render(
      <Profiler id="lista" onRender={() => { dibujos += 1; }}>
        <ListaBloques {...props()} />
      </Profiler>
    );

    const antes = dibujos;

    fireEvent.dragStart(filas()[0]);

    expect(dibujos).toBe(antes);
  });

  it("no hace nada si se suelta donde se cogio", () => {
    const p = props();

    render(<ListaBloques {...p} />);

    fireEvent.dragStart(filas()[1]);
    fireEvent.drop(filas()[1]);

    expect(p.onMover).not.toHaveBeenCalled();
  });

  it("no hace nada si llega un drop sin arrastre previo", () => {
    const p = props();

    render(<ListaBloques {...p} />);

    fireEvent.drop(filas()[1]);

    expect(p.onMover).not.toHaveBeenCalled();
  });

  // Si el origen no se limpiara, el siguiente drop suelto reordenaria la
  // lista sin que nadie haya arrastrado nada.
  it("olvida el origen cuando el arrastre termina sin soltar", () => {
    const p = props();

    render(<ListaBloques {...p} />);

    fireEvent.dragStart(filas()[0]);
    fireEvent.dragEnd(filas()[0]);
    fireEvent.drop(filas()[2]);

    expect(p.onMover).not.toHaveBeenCalled();
  });

  // Sin preventDefault en dragover el navegador no permite soltar.
  it("permite soltar encima de una fila", () => {
    render(<ListaBloques {...props()} />);

    const evento = new Event("dragover", { bubbles: true, cancelable: true });

    fireEvent(filas()[1], evento);

    expect(evento.defaultPrevented).toBe(true);
  });
});

describe("mientras se guarda un cambio", () => {
  it("se apagan los botones y el arrastre", () => {
    render(<ListaBloques {...props({ ocupado: true })} />);

    expect(screen.getByLabelText("Bajar Escríbenos")).toBeDisabled();
    expect(within(filas()[0]).getByText("Editar")).toBeDisabled();
    expect(within(filas()[0]).getByText("Eliminar")).toBeDisabled();
    expect(filas()[0]).toHaveAttribute("draggable", "false");
  });
});

describe("las acciones", () => {
  it("avisan con el bloque entero, no solo con su id", async () => {
    const p = props();

    render(<ListaBloques {...p} />);

    await userEvent.click(within(filas()[0]).getByText("Editar"));
    await userEvent.click(within(filas()[0]).getByText("Desactivar"));
    await userEvent.click(within(filas()[0]).getByText("Eliminar"));

    expect(p.onEditar).toHaveBeenCalledWith(BLOQUES[0]);
    expect(p.onEstado).toHaveBeenCalledWith(BLOQUES[0]);
    expect(p.onEliminar).toHaveBeenCalledWith(BLOQUES[0]);
  });
});
