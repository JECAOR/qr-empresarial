import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { obtenerPerfilPublico, informarEvento } from "../../services/perfilPublicoService";
import { SECCION_MENU } from "../../services/contenidoService";
import TarjetaContenido from "../../components/TarjetaContenido/TarjetaContenido";
import useTitulo from "../../hooks/useTitulo";
import { aplicarTema, temaGuardado } from "../../styles/tema";
import "../PerfilPublico/PerfilPublicoPage.css";
import "./MenuPage.css";

/**
 * EL MENU DEL NEGOCIO — /p/:slug/menu (RF-05)
 *
 * La pantalla a la que lleva «Ver menú completo» de la página pública. El
 * frontend original la tenía -menu.html- y el de React no: era una pantalla
 * entera de menos, con el servidor publicando ya el de React.
 *
 * Enseña los bloques de la sección «menu», que es la primera pestaña del
 * panel. No hay precios: el contenido del RF-05 son títulos y detalles, no
 * artículos con tarifa, y poner una columna de precios aquí obligaría a
 * inventarlos.
 *
 * El slug va en la dirección y no en la consulta, a diferencia del original
 * -/menu.html?slug=...-: así el enlace se lee, se puede guardar como
 * marcador y queda claro de qué negocio es el menú.
 */
export default function MenuPage() {
  const { slug } = useParams();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;

    // eslint-disable-next-line react/set-state-in-effect
    setCargando(true);
    setError("");

    obtenerPerfilPublico(slug)
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch((fallo) => {
        if (vigente) {
          setError(fallo.message);
          setDatos(null);
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [slug]);

  const negocio = datos?.perfil?.nombreNegocio;

  useTitulo(negocio && `Menú de ${negocio}`);

  // Los colores del negocio, igual que en la página pública (RF-12). Sin
  // recordarlos: son de ese negocio, no de este navegador.
  const temaDelNegocio = datos?.perfil?.tema;

  useEffect(() => {
    if (!temaDelNegocio) return undefined;

    aplicarTema(temaDelNegocio, { recordar: false });

    return () => aplicarTema(temaGuardado(), { recordar: false });
  }, [temaDelNegocio]);

  /**
   * Cuenta los clics en los enlaces del menú (RF-11).
   *
   * El frontend original NO los contaba: la misma lista de enlaces se medía
   * en la página pública y se perdía al entrar al menú, que es justo donde
   * un restaurante pone los suyos. Se cuentan, por delegación y con el mismo
   * mecanismo que la página pública.
   *
   * Lo que no se cuenta es una visita. Quien llega aquí viene de la página
   * del negocio, donde ya se contó una: contarla otra vez haría que un solo
   * visitante apareciera como dos.
   */
  function contarClic(evento) {
    const enlace = evento.target.closest("a[data-bloque]");

    if (!enlace) return;

    const idEnlace = Number(String(enlace.dataset.bloque).split("-")[1]);

    if (!Number.isInteger(idEnlace)) return;

    informarEvento(slug, { tipo: "clic", idEnlace });
  }

  if (cargando) {
    return (
      <main className="menu">
        <p className="perfil__aviso">Cargando el menú…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="menu">
        <p className="perfil__aviso perfil__aviso--error" role="alert">{error}</p>
      </main>
    );
  }

  const bloques = datos.porSeccion?.[SECCION_MENU] ?? [];

  return (
    <main className="menu">
      {/* Volver lleva al perfil de ESTE negocio y no al historial: aquí se
          puede llegar por un enlace directo, y entonces no hay atrás. */}
      <Link className="menu__volver" to={`/p/${slug}`}>Volver al perfil</Link>

      <h1 className="menu__titulo">{negocio}</h1>

      <p className="menu__sub">
        {datos.perfil.horario || "Información publicada por el negocio"}
      </p>

      {bloques.length === 0 ? (
        <p className="perfil__aviso">
          Este negocio todavía no ha publicado su menú.
        </p>
      ) : (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div className="menu__lista" onClick={contarClic}>
          {bloques.map((bloque) => (
            <TarjetaContenido
              key={bloque.id}
              id={bloque.id}
              titulo={bloque.titulo}
              detalle={bloque.detalle}
              categoria={bloque.categoria}
              tipo={bloque.tipo}
            />
          ))}
        </div>
      )}
    </main>
  );
}
