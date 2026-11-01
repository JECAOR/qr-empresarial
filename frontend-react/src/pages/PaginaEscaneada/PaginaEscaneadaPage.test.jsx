// ============================================
// PAGINAESCANEADAPAGE — lo que ve quien escanea el codigo (/p/:slug)
//
// Lo que la separa de la portada: el slug viene en la direccion y aqui SI se
// informan los eventos. Las dos cosas se prueban, porque equivocarse en la
// segunda no rompe nada visible —solo deja las estadisticas mintiendo.
// ============================================

import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PaginaEscaneadaPage from "./PaginaEscaneadaPage";
import { respuesta, simularFetch } from "../../pruebas/ayudas";

const BLOQUES = [
  { id: "enlace-45", titulo: "Escríbenos", detalle: "https://wa.me/57300", categoria: "WhatsApp", tipo: "enlace" },
  { id: "elemento-7", titulo: "Horneamos cada mañana", detalle: "Pan de masa madre", categoria: "Texto", tipo: "texto" }
];

const PERFIL = (contenido = BLOQUES, tema) => respuesta({
  data: {
    perfil: { nombreNegocio: "Panadería La Espiga", telefono: "+57 301 222 3344", tema },
    contenido,
    porSeccion: {}
  }
});

/** Lo que se envió por sendBeacon, ya convertido. */
let enviados;

beforeEach(() => {
  enviados = [];

  // sendBeacon manda un Blob; se lee para poder comprobar el cuerpo.
  vi.stubGlobal("navigator", {
    ...navigator,
    sendBeacon: (url, blob) => {
      enviados.push({ url, blob });

      return true;
    }
  });
});

/** Los eventos informados, con su cuerpo ya leído. */
async function eventos() {
  return Promise.all(enviados.map(async (e) => ({
    url: e.url,
    ...JSON.parse(await e.blob.text())
  })));
}

function montar(ruta = "/p/panaderia-la-espiga") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/p/:slug" element={<PaginaEscaneadaPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("lo que se ve", () => {
  it("toma el negocio de la direccion, no de una caja de texto", async () => {
    const espia = simularFetch([PERFIL()]);

    montar("/p/cafe-raices");

    await waitFor(() => expect(espia).toHaveBeenCalled());
    expect(espia.mock.calls[0][0]).toMatch(/\/publico\/cafe-raices$/);
  });

  it("enseña la ficha y los bloques", async () => {
    simularFetch([PERFIL()]);

    montar();

    expect(await screen.findByRole("heading", { name: "Panadería La Espiga" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://wa.me/57300" })).toBeInTheDocument();
    expect(screen.getByText("Pan de masa madre")).toBeInTheDocument();
  });

  // Quien escanea no viene a buscar un negocio: ya llego al suyo.
  it("no ofrece buscador", async () => {
    simularFetch([PERFIL()]);

    montar();

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    expect(screen.queryByLabelText(/Dirección pública/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Consultar" })).not.toBeInTheDocument();
  });

  it("avisa mientras carga", () => {
    simularFetch(() => new Promise(() => {}));

    montar();

    expect(screen.getByText("Cargando perfil…")).toBeInTheDocument();
  });

  it("dice que no hay contenido en lugar de dejar la pagina a medias", async () => {
    simularFetch([PERFIL([])]);

    montar();

    expect(await screen.findByText(/todavía no tiene contenido publicado/))
      .toBeInTheDocument();
  });

  it("enseña el mensaje del servidor si el perfil no esta disponible", async () => {
    simularFetch([respuesta({ message: "Este perfil no está disponible" }, { status: 404 })]);

    montar();

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Este perfil no está disponible");
  });
});

describe("los eventos (RF-11)", () => {
  // La imagen del QR lleva ?qr=1; el enlace que se comparte a mano, no. Son
  // las dos primeras medidas que pide el requisito.
  it("con ?qr=1 informa un escaneo", async () => {
    simularFetch([PERFIL()]);

    montar("/p/panaderia-la-espiga?qr=1");

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await waitFor(async () => expect(await eventos()).toEqual([
      expect.objectContaining({ tipo: "escaneo" })
    ]));
  });

  it("sin ?qr=1 informa una visita", async () => {
    simularFetch([PERFIL()]);

    montar();

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await waitFor(async () => expect(await eventos()).toEqual([
      expect.objectContaining({ tipo: "visita" })
    ]));
  });

  it("lo manda al endpoint del negocio que se esta viendo", async () => {
    simularFetch([PERFIL()]);

    montar("/p/cafe-raices");

    await screen.findByRole("heading", { name: "Panadería La Espiga" });

    await waitFor(async () => expect((await eventos())[0].url)
      .toMatch(/\/publico\/cafe-raices\/eventos$/));
  });

  // Contar la visita a una direccion inventada ensuciaria las estadisticas
  // de nadie.
  it("no informa nada si el perfil no existe", async () => {
    simularFetch([respuesta({ message: "No disponible" }, { status: 404 })]);

    montar();

    await screen.findByRole("alert");

    expect(await eventos()).toEqual([]);
  });

  // StrictMode monta, desmonta y vuelve a montar, asi que el efecto se
  // ejecuta dos veces. Sin la bandera de vigencia en la limpieza, la visita
  // se contaria dos veces y las cifras saldrian al doble en desarrollo.
  it("cuenta una sola vez en StrictMode", async () => {
    simularFetch([PERFIL(), PERFIL()]);

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/p/panaderia-la-espiga"]}>
          <Routes>
            <Route path="/p/:slug" element={<PaginaEscaneadaPage />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    );

    await screen.findByRole("heading", { name: "Panadería La Espiga" });
    await waitFor(async () => expect(await eventos()).toHaveLength(1));
  });

  // Dentro de la aplicacion se puede ir de un negocio a otro sin recargar, y
  // React Router reutiliza el mismo componente: solo cambia el parametro. La
  // segunda visita es una visita, y no contarla dejaria sin registrar a quien
  // llega por un enlace desde otro perfil.
  //
  // Se navega con un Link de verdad: cambiar initialEntries en un rerender no
  // navega, porque React Router solo lo lee en el primer dibujado.
  it("cuenta la visita al cambiar de negocio sin recargar", async () => {
    simularFetch([PERFIL(), PERFIL()]);

    render(
      <MemoryRouter initialEntries={["/p/panaderia-la-espiga"]}>
        <Link to="/p/cafe-raices">ir al otro</Link>
        <Routes>
          <Route path="/p/:slug" element={<PaginaEscaneadaPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Panadería La Espiga" });
    await waitFor(async () => expect(await eventos()).toHaveLength(1));

    await userEvent.click(screen.getByText("ir al otro"));

    await waitFor(async () => {
      const lista = await eventos();

      expect(lista).toHaveLength(2);
      expect(lista[1].url).toMatch(/\/publico\/cafe-raices\/eventos$/);
    });
  });

  describe("los clics", () => {
    it("cuenta el clic con el numero del enlace", async () => {
      simularFetch([PERFIL()]);

      montar();

      const enlace = await screen.findByRole("link", { name: "https://wa.me/57300" });

      await userEvent.click(enlace);

      await waitFor(async () => expect(await eventos()).toContainEqual(
        expect.objectContaining({ tipo: "clic", idEnlace: 45 })
      ));
    });

    // Un bloque de texto no lleva enlace: no hay nada que contar.
    it("no cuenta nada al pulsar un bloque de texto", async () => {
      simularFetch([PERFIL()]);

      montar();

      await screen.findByRole("heading", { name: "Panadería La Espiga" });

      const antes = (await eventos()).length;

      await userEvent.click(screen.getByText("Pan de masa madre"));

      expect(await eventos()).toHaveLength(antes);
    });

    // El identificador es compuesto -"elemento-7"- y solo los enlaces tienen
    // numero de enlace. Si algun dia un elemento llegara marcado, no se puede
    // mandar un id que el servidor rechazaria.
    it("ignora un identificador del que no sale un numero", async () => {
      simularFetch([PERFIL([{ ...BLOQUES[0], id: "enlace-raro" }])]);

      montar();

      const enlace = await screen.findByRole("link", { name: "https://wa.me/57300" });

      const antes = (await eventos()).length;

      await userEvent.click(enlace);

      expect(await eventos()).toHaveLength(antes);
    });
  });
});

// --- El color de marca del negocio (RF-12) ---
//
// Es el sentido del requisito: quien escanea el codigo ve los colores que
// eligio el negocio, no los de la aplicacion. Ninguna pantalla de React los
// aplicaba: el selector guardaba el color y no pintaba nada.
describe("los colores del negocio", () => {
  it("aplica el tema del negocio que se escaneo", async () => {
    simularFetch([PERFIL(BLOQUES, "terracota")]);

    montar();

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "terracota"));
  });

  // Es el perfil de OTRO negocio. Guardar su color lo dejaria puesto en el
  // panel propio la proxima vez que se abriera la aplicacion aqui.
  it("no se queda guardado", async () => {
    simularFetch([PERFIL(BLOQUES, "teal")]);

    montar();

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "teal"));
    expect(localStorage.getItem("qre_tema")).toBeNull();
  });

  // Al volver al panel se repone el del negocio propio sin esperar a que
  // llegue otra vez el perfil, que dejaria un instante con el color ajeno.
  it("al salir de la pantalla se repone el que hubiera", async () => {
    localStorage.setItem("qre_tema", "terracota");
    simularFetch([PERFIL(BLOQUES, "teal")]);

    const { unmount } = montar();

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "teal"));

    unmount();

    expect(document.documentElement).toHaveAttribute("data-theme", "terracota");
  });

  it("un negocio sin tema se ve con el de defecto", async () => {
    simularFetch([PERFIL()]);

    montar();

    await waitFor(() => screen.getByText("Panadería La Espiga"));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});
