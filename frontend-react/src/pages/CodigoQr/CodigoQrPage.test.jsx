// ============================================
// CODIGOQRPAGE — el codigo del perfil (RF-07, RF-08 y RF-09)
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import CodigoQrPage from "./CodigoQrPage";
import { respuesta, simularFetch } from "../../pruebas/ayudas";

const QR = (extra = {}) => ({
  idQr: 2,
  url: "/p/panaderia-la-espiga",
  activo: true,
  fechaGeneracion: "2026-09-20T10:00:00.000Z",
  ...extra
});

/** Una respuesta de imagen, con su nombre de archivo. */
const imagen = (nombre = "qr-panaderia-la-espiga.png") =>
  respuesta("datos-de-la-imagen", {
    headers: { "content-disposition": `attachment; filename="${nombre}"` }
  });

async function montar(respuestas) {
  const espia = simularFetch(respuestas);
  const vista = render(<MemoryRouter><CodigoQrPage /></MemoryRouter>);

  await screen.findByRole("heading", { name: "Tu código QR" });

  return { espia, ...vista };
}

/** La ruta de la llamada número `n`, sin la base. */
const rutaDe = (espia, n) =>
  espia.mock.calls[n][0].replace("http://api.de.pruebas.invalido/api", "");

afterEach(() => vi.useRealTimers());

describe("cuando todavia no hay codigo", () => {
  // 404 es el estado normal de un perfil recien creado, no una averia.
  it("un 404 no se enseña como error", async () => {
    await montar([respuesta({ message: "No encontrado" }, { status: 404 })]);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/Todavía no has generado tu código/)).toBeInTheDocument();
  });

  it("ofrece generarlo y avisa de que hace falta contenido activo", async () => {
    await montar([respuesta({ message: "No encontrado" }, { status: 404 })]);

    expect(screen.getByText("Generar mi código")).toBeInTheDocument();
    expect(screen.getByText(/Hace falta al menos un bloque de contenido activo/))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contenido" }))
      .toHaveAttribute("href", "/contenido");
  });

  it("lo genera y vuelve a consultarlo", async () => {
    const { espia } = await montar([
      respuesta({ message: "No encontrado" }, { status: 404 }),
      respuesta({ data: QR() }, { status: 201 }),
      respuesta({ data: QR() })
    ]);

    await userEvent.click(screen.getByText("Generar mi código"));

    await screen.findByRole("status");

    expect(rutaDe(espia, 1)).toBe("/qr");
    expect(espia.mock.calls[1][1].method).toBe("POST");
    expect(rutaDe(espia, 2)).toBe("/qr");
  });

  // 409: no hay ningun bloque activo. Un codigo que lleva a una pagina en
  // blanco no le sirve a nadie.
  it("enseña el motivo si el servidor se niega a generarlo", async () => {
    await montar([
      respuesta({ message: "No encontrado" }, { status: 404 }),
      respuesta({ message: "El perfil no tiene contenido activo" }, { status: 409 })
    ]);

    await userEvent.click(screen.getByText("Generar mi código"));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("El perfil no tiene contenido activo");
  });

  // Un 500 si es una averia y se tiene que ver.
  it("otro error si se enseña al cargar", async () => {
    simularFetch([respuesta({ message: "Error del servidor" }, { status: 500 })]);

    render(<MemoryRouter><CodigoQrPage /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("Error del servidor");
  });
});

describe("cuando ya hay codigo", () => {
  it("compone la direccion entera, que es lo que necesita quien escanea", async () => {
    await montar([respuesta({ data: QR() }), imagen()]);

    expect(screen.getByText("http://api.de.pruebas.invalido/p/panaderia-la-espiga"))
      .toBeInTheDocument();
  });

  it("ofrece abrirla en otra pestaña", async () => {
    await montar([respuesta({ data: QR() }), imagen()]);

    const enlace = screen.getByRole("link", { name: "Abrirla" });

    expect(enlace).toHaveAttribute("href", "http://api.de.pruebas.invalido/p/panaderia-la-espiga");
    expect(enlace.getAttribute("rel")).toContain("noopener");
  });

  it("copia el enlace al portapapeles", async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: escribir } });

    await montar([respuesta({ data: QR() }), imagen()]);

    await userEvent.click(screen.getByText("Copiar enlace"));

    await screen.findByRole("status");

    expect(escribir).toHaveBeenCalledWith("http://api.de.pruebas.invalido/p/panaderia-la-espiga");
  });

  it("avisa si el navegador no deja copiar", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denegado")) }
    });

    await montar([respuesta({ data: QR() }), imagen()]);

    await userEvent.click(screen.getByText("Copiar enlace"));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("El navegador no dejó copiar el enlace");
  });
});

describe("la vista previa", () => {
  // Se pide al servidor en lugar de dibujarla aqui: asi lo que se ve es
  // exactamente el archivo que se va a descargar, sin un segundo generador
  // que pueda discrepar.
  it("la genera el servidor, por el mismo endpoint que la descarga", async () => {
    const { espia } = await montar([respuesta({ data: QR() }), imagen()]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    expect(rutaDe(espia, 1)).toMatch(/^\/qr\/imagen\?/);
    expect(new URLSearchParams(rutaDe(espia, 1).split("?")[1]).get("formato")).toBe("svg");
  });

  it("enseña la imagen cuando llega", async () => {
    await montar([respuesta({ data: QR() }), imagen()]);

    expect(await screen.findByAltText("Vista previa del código QR")).toBeInTheDocument();
  });

  // Una peticion por tecla mientras se mueve el deslizador seria una por
  // pixel.
  it("espera a que el color deje de moverse antes de pedirla", async () => {
    const { espia } = await montar([
      respuesta({ data: QR() }),
      imagen(), imagen(), imagen()
    ]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    // Tres cambios seguidos de color
    await userEvent.click(screen.getByRole("button", { name: "Índigo" }));
    await userEvent.click(screen.getByRole("button", { name: "Esmeralda" }));
    await userEvent.click(screen.getByRole("button", { name: "Terracota" }));

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(3));

    // Solo una peticion mas, y con el ultimo color
    expect(new URLSearchParams(rutaDe(espia, 2).split("?")[1]).get("color")).toBe("C2410C");
  });

  // Si falla, se queda la anterior: no es critica y una pantalla sin vista
  // previa por un fallo de red asusta mas de lo que ayuda.
  it("un fallo al dibujarla no se enseña como error", async () => {
    await montar([
      respuesta({ data: QR() }),
      respuesta({ message: "Error al generar" }, { status: 500 })
    ]);

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

describe("descargar", () => {
  it("ofrece los tres formatos", async () => {
    await montar([respuesta({ data: QR() }), imagen()]);

    expect(screen.getByText("PNG")).toBeInTheDocument();
    expect(screen.getByText("SVG")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  // Con un <a href> normal no se puede: la ruta exige el token y una
  // etiqueta de enlace no manda cabeceras.
  it("baja el archivo con el nombre que dio el servidor", async () => {
    const pulsar = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const { espia } = await montar([
      respuesta({ data: QR() }),
      imagen(),
      imagen("qr-la-espiga.pdf")
    ]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByText("PDF"));

    expect(await screen.findByRole("status")).toHaveTextContent("Descargado qr-la-espiga.pdf");
    expect(pulsar).toHaveBeenCalled();
    expect(new URLSearchParams(rutaDe(espia, 2).split("?")[1]).get("formato")).toBe("pdf");
  });

  it("enseña el error si la descarga falla", async () => {
    const { espia } = await montar([
      respuesta({ data: QR() }),
      imagen(),
      respuesta({ message: "El código no existe" }, { status: 404 })
    ]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByText("PNG"));

    expect(await screen.findByRole("alert")).toHaveTextContent("El código no existe");
  });
});

describe("publicar y retirar", () => {
  // Retirar no borra el codigo: la direccion se conserva. Decirlo cambia la
  // decision.
  it("avisa de que los codigos repartidos dejan de llevar a ninguna parte", async () => {
    const { espia } = await montar([respuesta({ data: QR() }), imagen()]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.click(screen.getByRole("button", { name: /Retirar/i }));

    expect(confirmar.mock.calls[0][0]).toMatch(/dejarán de llevar a ninguna parte/);
    expect(confirmar.mock.calls[0][0]).toMatch(/El código no se borra/);
  });

  it("no hace nada si se dice que no", async () => {
    const { espia } = await montar([respuesta({ data: QR() }), imagen()]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    vi.spyOn(window, "confirm").mockReturnValue(false);

    await userEvent.click(screen.getByRole("button", { name: /Retirar/i }));

    expect(espia).toHaveBeenCalledTimes(2);
  });

  it("manda lo contrario de lo que esta ahora", async () => {
    const { espia } = await montar([
      respuesta({ data: QR() }),
      imagen(),
      respuesta({ data: QR({ activo: false }) }),
      respuesta({ data: QR({ activo: false }) }),
      imagen()
    ]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    vi.spyOn(window, "confirm").mockReturnValue(true);

    await userEvent.click(screen.getByRole("button", { name: /Retirar/i }));

    await screen.findByRole("status");

    expect(rutaDe(espia, 2)).toBe("/qr/estado");
    expect(JSON.parse(espia.mock.calls[2][1].body)).toEqual({ activo: false });
  });
});

// --- Compartir la direccion ---
//
// REGRESION. Esta pantalla ofrecia «Copiar enlace» y nada mas. El frontend
// original ofrece cuatro formas de compartir, y es lo siguiente que se hace
// despues de generar el codigo: pegarlo en el local esta bien, pero el
// enlace se manda. Para una PyME aqui, se manda por WhatsApp.
describe("compartir la direccion", () => {
  const DIRECCION = "http://api.de.pruebas.invalido/p/panaderia-la-espiga";
  const INVITACION = `Esta es nuestra página: ${DIRECCION}`;

  it("por WhatsApp, con el enlace dentro del mensaje", async () => {
    await montar([respuesta({ data: QR() }), imagen()]);

    expect(screen.getByRole("link", { name: "WhatsApp" }))
      .toHaveAttribute("href", `https://wa.me/?text=${encodeURIComponent(INVITACION)}`);
  });

  it("por correo, con asunto y cuerpo", async () => {
    await montar([respuesta({ data: QR() }), imagen()]);

    const enlace = screen.getByRole("link", { name: "Correo" }).getAttribute("href");

    expect(enlace).toContain("mailto:?subject=");
    expect(enlace).toContain(encodeURIComponent(INVITACION));
  });

  // Un mensaje que solo trae una direccion parece de los que se mandan solos.
  it("el mensaje lleva una linea de texto, no el enlace a secas", async () => {
    await montar([respuesta({ data: QR() }), imagen()]);

    const enlace = screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href");

    expect(decodeURIComponent(enlace)).toContain("Esta es nuestra página:");
  });

  // Instagram no admite compartir una direccion por enlace: no hay a donde
  // mandar nada. Lo que sirve es copiarla para la biografia.
  it("para Instagram copia el enlace, y lo dice", async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: escribir } });

    await montar([respuesta({ data: QR() }), imagen()]);

    await userEvent.click(screen.getByRole("button", { name: "Instagram" }));

    expect(await screen.findByRole("status"))
      .toHaveTextContent("Enlace copiado para tu biografía de Instagram");
    expect(escribir).toHaveBeenCalledWith(DIRECCION);
  });

  it("avisa si el navegador no deja copiar", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) }
    });

    await montar([respuesta({ data: QR() }), imagen()]);

    await userEvent.click(screen.getByRole("button", { name: "Instagram" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("El navegador no dejó copiar el enlace");
  });

  // Compartir una pagina retirada lleva a quien la abra a un aviso de «no
  // disponible»: el enlace sigue a la vista para el dueño, pero no se ofrece
  // mandarlo.
  it("no se ofrece mientras la pagina esta retirada", async () => {
    await montar([respuesta({ data: QR({ activo: false }) }), imagen()]);

    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Correo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instagram" })).not.toBeInTheDocument();
  });

  it("pero copiar el enlace si, que es para el dueño", async () => {
    await montar([respuesta({ data: QR({ activo: false }) }), imagen()]);

    expect(screen.getByText("Copiar enlace")).toBeInTheDocument();
  });
});

// REGRESION. Las dos formas de copiar no limpiaban los mensajes anteriores,
// asi que copiar despues de un fallo dejaba el aviso bueno y el error viejo
// en pantalla a la vez, uno debajo del otro. Es el mismo defecto que ya se
// habia corregido en la pantalla de entrar.
describe("un mensaje a la vez", () => {
  it("copiar el enlace borra el error anterior", async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: escribir } });

    const { espia } = await montar([
      respuesta({ data: QR() }),
      imagen(),
      respuesta({ message: "El código no existe" }, { status: 404 })
    ]);

    // Se espera a que la vista previa termine: si no, el clic se lleva la
    // respuesta que le tocaba a ella.
    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    // Primero se provoca un error con la descarga
    await userEvent.click(screen.getByText("PNG"));
    await screen.findByRole("alert");

    await userEvent.click(screen.getByText("Copiar enlace"));

    expect(await screen.findByRole("status")).toHaveTextContent("Enlace copiado");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("y el de Instagram tambien", async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: escribir } });

    const { espia } = await montar([
      respuesta({ data: QR() }),
      imagen(),
      respuesta({ message: "El código no existe" }, { status: 404 })
    ]);

    await waitFor(() => expect(espia).toHaveBeenCalledTimes(2));

    await userEvent.click(screen.getByText("PNG"));
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Instagram" }));

    expect(await screen.findByRole("status")).toHaveTextContent("biografía de Instagram");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
