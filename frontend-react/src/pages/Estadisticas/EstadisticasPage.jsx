import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { consultarMisEstadisticas, RANGOS } from "../../services/estadisticaService";
import GraficaActividad from "../../components/estadisticas/GraficaActividad/GraficaActividad";
import "./EstadisticasPage.css";

const MEDIDAS = [
  { clave: "escaneos", nombre: "Escaneos del QR", ayuda: "Cuántas veces se escaneó" },
  { clave: "visitas", nombre: "Visitas al perfil", ayuda: "Quién llegó sin escanear" },
  { clave: "clics", nombre: "Clics en enlaces", ayuda: "Cuántos pulsaron algo" }
];

/** Los miles como se leen en Colombia. */
const numero = (valor) => new Intl.NumberFormat("es-CO").format(valor);

export default function EstadisticasPage() {
  const [dias, setDias] = useState(7);
  const [datos, setDatos] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;

    setCargando(true);

    consultarMisEstadisticas(dias)
      .then((resultado) => {
        if (vigente) {
          setDatos(resultado.data);
          setError("");
        }
      })
      .catch((fallo) => {
        if (vigente) {
          // 404: la cuenta todavia no tiene perfil, asi que no hay nada que
          // contar. No es una averia.
          setError(fallo.status === 404 ? "" : fallo.message);
          setDatos(null);
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [dias]);

  if (cargando && !datos) {
    return (
      <main className="estadisticas">
        <p className="aviso">Cargando la actividad…</p>
      </main>
    );
  }

  const hayActividad = datos
    && (datos.totales.escaneos + datos.totales.visitas + datos.totales.clics) > 0;

  return (
    <main className="estadisticas">
      <section className="panel">
        <header className="panel__cabecera">
          <div>
            <h1 className="panel__titulo">Actividad</h1>
            <p className="panel__sub">
              Lo que ha pasado con tu código y tu página.
            </p>
          </div>

          <div className="rangos" role="group" aria-label="Periodo">
            {RANGOS.map((r) => (
              <button
                key={r}
                type="button"
                className={r === dias ? "rango rango--elegido" : "rango"}
                onClick={() => setDias(r)}
                aria-pressed={r === dias}
              >
                {r} días
              </button>
            ))}
          </div>
        </header>

        {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}

        {!datos ? (
          <p className="vacio">
            Todavía no hay nada que contar. Crea tu perfil y tu código en{" "}
            <Link to="/perfil">Mi negocio</Link>.
          </p>
        ) : (
          <>
            <div className="medidas">
              {MEDIDAS.map((m) => (
                <article key={m.clave} className="medida">
                  <p className="medida__nombre">{m.nombre}</p>
                  <p className="medida__valor">{numero(datos.totales[m.clave])}</p>
                  <p className="medida__ayuda">{m.ayuda}</p>
                </article>
              ))}

              <article className="medida">
                <p className="medida__nombre">Tasa de conversión</p>
                <p className="medida__valor">{datos.totales.conversion}%</p>
                <p className="medida__ayuda">De los que llegaron, cuántos pulsaron</p>
              </article>
            </div>

            {hayActividad ? (
              <GraficaActividad serie={datos.serie} />
            ) : (
              <p className="vacio">
                Sin actividad en este periodo. Las cifras aparecerán cuando
                alguien escanee tu código o abra tu página.
              </p>
            )}
          </>
        )}
      </section>

      {datos && (
        <section className="panel">
          <h2 className="panel__titulo panel__titulo--chico">Enlaces más pulsados</h2>
          <p className="panel__sub">Últimos {datos.dias} días.</p>

          {datos.enlacesMasPulsados.length === 0 ? (
            <p className="vacio">
              Nadie ha pulsado un enlace todavía. Aquí aparecerán los que más
              se usen.
            </p>
          ) : (
            <ol className="enlaces">
              {datos.enlacesMasPulsados.map((enlace, posicion) => {
                const mayor = datos.enlacesMasPulsados[0].clics;

                return (
                  <li key={enlace.idEnlace} className="enlace">
                    <span className="enlace__puesto">{posicion + 1}</span>

                    <span className="enlace__texto">
                      <strong>{enlace.titulo}</strong>
                      <small>{enlace.categoria}</small>
                    </span>

                    <span className="enlace__barra" aria-hidden="true">
                      <span style={{ width: `${(enlace.clics / mayor) * 100}%` }} />
                    </span>

                    <span className="enlace__clics">
                      {numero(enlace.clics)} {enlace.clics === 1 ? "clic" : "clics"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}
