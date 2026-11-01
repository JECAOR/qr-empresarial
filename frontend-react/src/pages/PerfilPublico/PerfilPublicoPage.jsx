import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { obtenerPerfilPublico } from "../../services/perfilPublicoService";
import FichaNegocio from "../../components/FichaNegocio/FichaNegocio";
import ContenidoPublico from "../../components/ContenidoPublico/ContenidoPublico";
import useTitulo from "../../hooks/useTitulo";
import "./PerfilPublicoPage.css";

// El perfil que se consulta al abrir. Sale de .env para no dejar escrito en
// el codigo un dato que cambia de una instalacion a otra.
const SLUG_INICIAL = import.meta.env.VITE_SLUG_DEMO ?? "";

function PerfilPublicoPage() {
  useTitulo("Perfil público");

  const [parametros] = useSearchParams();

  // La direccion manda sobre el valor por defecto: asi se puede enlazar a un
  // negocio concreto, que es lo que hace "Ver la pagina publica" desde la
  // pantalla del perfil.
  const inicial = parametros.get("slug") ?? SLUG_INICIAL;

  // Lo que se esta consultando ahora mismo
  const [slug, setSlug] = useState(inicial);

  // Lo que hay escrito en la caja de texto, que no es lo mismo: mientras se
  // escribe no hay que llamar al servidor en cada tecla
  const [escrito, setEscrito] = useState(inicial);

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

          {/* Por secciones, con los mismos nombres y el mismo orden que las
              pestanas del panel: esta pantalla es la vista previa de lo que
              vera quien escanee el codigo, y antes lo pintaba todo en una
              sola lista plana. */}
          {datos.contenido.length === 0 ? (
            <>
              <h2 className="perfil__seccion">Contenido publicado</h2>
              <p className="perfil__aviso">
                Este perfil todavía no tiene contenido publicado.
              </p>
            </>
          ) : (
            <ContenidoPublico porSeccion={datos.porSeccion} />
          )}
        </>
      )}
    </main>
  );
}

export default PerfilPublicoPage;
