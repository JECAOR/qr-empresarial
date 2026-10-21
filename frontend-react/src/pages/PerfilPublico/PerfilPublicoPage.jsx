import { useEffect, useState } from "react";

import { obtenerPerfilPublico } from "../../services/perfilPublicoService";
import FichaNegocio from "../../components/FichaNegocio/FichaNegocio";
import TarjetaContenido from "../../components/TarjetaContenido/TarjetaContenido";
import "./PerfilPublicoPage.css";

// El perfil que se consulta al abrir. Sale de .env para no dejar escrito en
// el codigo un dato que cambia de una instalacion a otra.
const SLUG_INICIAL = import.meta.env.VITE_SLUG_DEMO ?? "";

function PerfilPublicoPage() {
  // Lo que se esta consultando ahora mismo
  const [slug, setSlug] = useState(SLUG_INICIAL);

  // Lo que hay escrito en la caja de texto, que no es lo mismo: mientras se
  // escribe no hay que llamar al servidor en cada tecla
  const [escrito, setEscrito] = useState(SLUG_INICIAL);

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Si se consulta otro negocio antes de que llegue la respuesta anterior,
    // la vieja no debe pisar a la nueva. Esta bandera la descarta.
    let vigente = true;

    async function cargarPerfil() {
      setCargando(true);
      setError("");

      try {
        const resultado = await obtenerPerfilPublico(slug);

        if (vigente) setDatos(resultado);
      } catch (fallo) {
        if (vigente) {
          setError(fallo.message);
          setDatos(null);
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargarPerfil();

    return () => {
      vigente = false;
    };
  }, [slug]);

  function consultar(evento) {
    evento.preventDefault();
    setSlug(escrito.trim());
  }

  return (
    <main className="perfil">
      <form className="perfil__buscador" onSubmit={consultar}>
        <label className="perfil__etiqueta" htmlFor="slug">
          Dirección pública del negocio
        </label>

        <div className="perfil__fila">
          <input
            id="slug"
            className="perfil__campo"
            value={escrito}
            onChange={(evento) => setEscrito(evento.target.value)}
            placeholder="panaderia-la-espiga"
          />
          <button className="perfil__boton" type="submit">
            Consultar
          </button>
        </div>
      </form>

      {cargando && <p className="perfil__aviso">Cargando perfil…</p>}

      {!cargando && error && (
        <p className="perfil__aviso perfil__aviso--error" role="alert">
          {error}
        </p>
      )}

      {!cargando && !error && datos && (
        <>
          <FichaNegocio perfil={datos.perfil} />

          <h2 className="perfil__seccion">Contenido publicado</h2>

          {datos.contenido.length === 0 ? (
            <p className="perfil__aviso">
              Este perfil todavía no tiene contenido publicado.
            </p>
          ) : (
            datos.contenido.map((bloque) => (
              <TarjetaContenido
                key={bloque.id}
                titulo={bloque.titulo}
                detalle={bloque.detalle}
                categoria={bloque.categoria}
                tipo={bloque.tipo}
              />
            ))
          )}
        </>
      )}
    </main>
  );
}

export default PerfilPublicoPage;
