import { useEffect, useRef } from "react";

import "./DetalleCuenta.css";

const NOMBRE_DEL_EVENTO = {
  escaneo: "Escaneó el código",
  visita: "Abrió la página",
  clic: "Pulsó un enlace"
};

const cuando = (valor) => new Date(valor).toLocaleString("es-CO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

/**
 * Lo que la tabla no cabe: la actividad reciente de una cuenta.
 *
 * Va en un <dialog> y no en un div flotante propio: el navegador se encarga
 * del foco, de cerrarlo con Escape y de bloquear lo que hay detras.
 */
export default function DetalleCuenta({ cuenta, onCerrar }) {
  const dialogo = useRef(null);

  useEffect(() => {
    const elemento = dialogo.current;

    // Sin la guarda, StrictMode -que ejecuta el efecto dos veces- llamaria a
    // showModal() sobre un dialogo ya abierto, y eso lanza InvalidStateError.
    if (elemento && !elemento.open) elemento.showModal();

    // Y sin limpieza a proposito. Cerrarlo aqui parecia lo correcto, pero
    // close() dispara el evento close, que llama a onCerrar, que borra el
    // estado de quien nos dibuja: en StrictMode el dialogo se cerraba solo
    // una fraccion de segundo despues de abrirse. Al desmontarse, el
    // navegador lo quita de la capa superior sin ayuda.
  }, []);

  return (
    <dialog className="detalle-cuenta" ref={dialogo} onClose={onCerrar}>
      <header className="detalle-cuenta__cabecera">
        <div>
          <h2>{cuenta.nombre}</h2>
          <p>{cuenta.correo}</p>
        </div>

        <button type="button" onClick={onCerrar} aria-label="Cerrar">×</button>
      </header>

      <dl className="detalle-cuenta__datos">
        <div><dt>Rol</dt><dd>{cuenta.rol}</dd></div>
        <div><dt>Estado</dt><dd>{cuenta.estado}</dd></div>
        <div>
          <dt>Registro</dt>
          <dd>{new Date(cuenta.fechaRegistro).toLocaleDateString("es-CO")}</dd>
        </div>
        <div>
          <dt>Último acceso</dt>
          <dd>{cuenta.ultimoAcceso ? cuando(cuenta.ultimoAcceso) : "Nunca entró"}</dd>
        </div>
        <div>
          <dt>Negocio</dt>
          <dd>{cuenta.perfil ? cuenta.perfil.nombreNegocio : "Sin perfil"}</dd>
        </div>
        {cuenta.perfil && (
          <div>
            <dt>Código QR</dt>
            <dd>
              {cuenta.perfil.qr === null
                ? "Sin generar"
                : cuenta.perfil.qr ? "Publicado" : "Retirado"}
            </dd>
          </div>
        )}
        <div><dt>Escaneos</dt><dd>{cuenta.actividad.escaneos}</dd></div>
        <div><dt>Visitas</dt><dd>{cuenta.actividad.visitas}</dd></div>
        <div><dt>Clics</dt><dd>{cuenta.actividad.clics}</dd></div>
      </dl>

      <h3 className="detalle-cuenta__titulo">Actividad reciente</h3>

      {cuenta.ultimosEventos.length === 0 ? (
        <p className="detalle-cuenta__vacio">Sin actividad todavía.</p>
      ) : (
        <ul className="detalle-cuenta__eventos">
          {cuenta.ultimosEventos.map((evento, i) => (
            <li key={`${evento.fecha}-${i}`}>
              <span>
                {NOMBRE_DEL_EVENTO[evento.tipo] ?? evento.tipo}
                {evento.enlace && <small> · {evento.enlace}</small>}
              </span>
              <time dateTime={evento.fecha}>{cuando(evento.fecha)}</time>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
