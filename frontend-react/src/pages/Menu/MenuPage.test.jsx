// ============================================
// MENUPAGE — el menú del negocio (/p/:slug/menu, RF-05)
//
// La pantalla a la que lleva «Ver menú completo». El frontend original la
// tenía —menu.html— y el de React no: era una pantalla entera de menos.
//
// Enseña solo la sección «menu». Lo que más se prueba es justo eso: que no
// se cuele una promoción, porque entonces la pantalla sería la página pública
// otra vez y no habría razón para que existiera.
// ============================================

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MenuPage from "./MenuPage";
import { agruparPorSeccion, respuesta, simularFetch } from "../../pruebas/ayudas";

const BLOQUES = [
  { id: "elemento-11", seccion: "menu", titulo: "Pan de masa madre", detalle: "Horneado cada mañana", categoria: "Texto", tipo: "texto" },
  { id: "enlace-12", seccion: "menu", titulo: "Encargar una torta", detalle: "https://wa.me/573001234567", categoria: "WhatsApp", tipo: "enlace" },
  { id: "enlace-13", seccion: "promos", titulo: "Combo desayuno", detalle: "https://laespiga.co/combo", categoria: "Sitio web", tipo: "enlace" }
];

const PERFIL = (contenido = BLOQUES, extra = {}) => respuesta({
  data: {
    perfil: {
      nombreNegocio: "Panadería La Espiga",
      horario: "Lunes a sábado, 6:00 a.m. – 7:00 p.m.",
      ...extra
    },
    contenido,
    porSeccion: agruparPorSeccion(contenido)
  }
});

/** Lo que se envió por sendBeacon, ya convertido. */
let enviados;

beforeEach(() => {
  enviados = [];

  vi.stubGlobal("navigator", {
    ...navigator,
    sendBeacon: (url, blob) => {
      enviados.push({ url, blob });

      return true;
    }
  });
});

async function eventos() {
  return Promise.all(enviados.map(async (e) => ({
    url: e.url,
    ...JSON.parse(await e.blob.text())
  })));
}

function montar(ruta = "/p/panaderia-la-espiga/menu") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/p/:slug/menu" element={<MenuPage />} />
        <Route path="/p/:slug" element={<p>la página del negocio</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("lo que se ve", () => {
  it("el nombre del negocio como encabezado de la pantalla", async () => {
    simularFetch([PERFIL()]);

    montar();

    expect(await screen.findByRole("heading", { level: 1, name: "Panadería La Espiga" }))
      .toBeInTheDocument();
  });

  it("toma el negocio de la direccion", async () => {
    const espia = simularFetch([PERFIL()]);

    montar("/p/cafe-raices/menu");

    await waitFor(() => expect(espia).toHaveBeenCalled());
    expect(espia.mock.calls[0][0]).toMatch(/\/publico\/cafe-raices$/);
  });

  it("los bloques de la seccion del menu", async () => {
    simularFetch([PERFIL()]);

    montar();

    expect(await screen.findByText("Pan de masa madre")).toBeInTheDocument();
    expect(screen.getByText("Encargar una torta")).toBeInTheDocument();
  });

  // Si se colara, esta pantalla seria la pagina publica otra vez.
  it("NO los de las demas secciones", async () => {
    simularFetch([PERFIL()]);

    montar();

    await screen.findByText("Pan de masa madre");
    expect(screen.queryByText("Combo desayuno")).not.toBeInTheDocument();
  });

  // Tampoco los titulos de seccion: aqui solo hay una, y anunciarla seria
  // repetir el titulo de la pantalla.
  it("no enseña titulos de seccion", async () => {
    simularFetch([PERFIL()]);

    montar();

    await screen.findByText("Pan de masa madre");
    expect(screen.queryByText("Menú principal")).not.toBeInTheDocument();
  });

  it("el horario del negocio como subtitulo", async () => {
    simularFetch([PERFIL()]);

    montar();

    expect(await screen.findByText(/Lunes a sábado/)).toBeInTheDocument();
  });

  // Sin horario hace falta decir algo: el hueco entre el nombre y la lista
  // se lee como un dato que falta.
  it("y si no hay horario, de donde sale lo que se ve", async () => {
    simularFetch([PERFIL(BLOQUES, { horario: null })]);

    montar();

    expect(await screen.findByText("Información publicada por el negocio"))
      .toBeInTheDocument();
  });

  it("los enlaces se pueden pulsar y los textos no", async () => {
    simularFetch([PERFIL()]);

    montar();

    const enlace = await screen.findByRole("link", { name: "https://wa.me/573001234567" });

    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.queryByRole("link", { name: "Horneado cada mañana" })).not.toBeInTheDocument();
  });
});

describe("volver al perfil", () => {
  // Aqui se puede llegar por un enlace directo, y entonces no hay atras: el
  // enlace apunta al perfil de ESTE negocio y no al historial.
  it("lleva al perfil de este negocio", async () => {
    simularFetch([PERFIL()]);

    montar("/p/cafe-raices/menu");

    await userEvent.click(await screen.findByRole("link", { name: "Volver al perfil" }));

    expect(await screen.findByText("la página del negocio")).toBeInTheDocument();
  });
});

describe("cuando no hay menu", () => {
  it("lo dice, en lugar de dejar la pantalla en blanco", async () => {
    simularFetch([PERFIL([BLOQUES[2]])]); // solo la promoción

    montar();

    expect(await screen.findByText("Este negocio todavía no ha publicado su menú."))
      .toBeInTheDocument();
  });

  it("y sigue dejando volver al perfil", async () => {
    simularFetch([PERFIL([])]);

    montar();

    expect(await screen.findByRole("link", { name: "Volver al perfil" })).toBeInTheDocument();
  });
});

describe("cuando el perfil no existe", () => {
  it("enseña el mensaje del servidor", async () => {
    simularFetch([respuesta({ message: "Este perfil no está disponible" }, { status: 404 })]);

    montar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Este perfil no está disponible");
  });

  it("no enseña un menu vacio como si el negocio existiera", async () => {
    simularFetch([respuesta({ message: "Este perfil no está disponible" }, { status: 404 })]);

    montar();

    await screen.findByRole("alert");
    expect(screen.queryByText("Este negocio todavía no ha publicado su menú."))
      .not.toBeInTheDocument();
  });
});

describe("los clics (RF-11)", () => {
  // El frontend original NO los contaba: la misma lista de enlaces se medía
  // en la página pública y se perdía al entrar al menú, que es donde un
  // restaurante pone los suyos.
  it("cuenta el clic con el numero del enlace", async () => {
    simularFetch([PERFIL()]);

    montar();

    await userEvent.click(await screen.findByRole("link", { name: "https://wa.me/573001234567" }));

    const [evento] = await eventos();

    expect(evento.url).toMatch(/\/publico\/panaderia-la-espiga\/eventos$/);
    expect(evento).toMatchObject({ tipo: "clic", idEnlace: 12 });
  });

  it("no cuenta nada al pulsar un bloque de texto", async () => {
    simularFetch([PERFIL()]);

    montar();

    await userEvent.click(await screen.findByText("Pan de masa madre"));

    expect(enviados).toHaveLength(0);
  });

  // Lo contó ya la página del negocio, de la que se llega aquí. Contarla otra
  // vez haría que un solo visitante apareciera como dos.
  it("no cuenta una visita al abrir el menu", async () => {
    simularFetch([PERFIL()]);

    montar();

    await screen.findByText("Pan de masa madre");

    expect(enviados).toHaveLength(0);
  });
});
