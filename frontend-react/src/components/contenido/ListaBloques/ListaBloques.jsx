import { useRef } from "react";

import "./ListaBloques.css";

const NOMBRE_DEL_TIPO = { enlace: "Enlace", texto: "Texto", boton: "Botón" };

/**
 * Los bloques de una seccion, en su orden, con lo que se puede hacerles.
 *
 * Se reordena de dos maneras a proposito. Arrastrar es lo comodo con raton,
 * pero el arrastre de HTML no funciona con el dedo: en un movil la lista
 * quedaria sin forma de reordenarse. Las flechas funcionan en los dos sitios
 * y ademas se pueden usar con el teclado.
 */
export default function ListaBloques({
  bloques, onEditar, onEstado, onEliminar, onMover, ocupado
}) {
  // En una ref y no en estado: los tres eventos del arrastre -dragstart,
  // dragover, drop- pueden ocurrir en el mismo tic, y el estado de React no
  // se ha aplicado todavia cuando llega el drop. Con una ref el valor esta
  // disponible al instante y no hace falta un redibujado para leerlo.
  const origen = useRef(null);

  function soltarEn(destino) {
    const desde = origen.current;

    origen.current = null;

    if (desde === null || desde === destino) return;

    onMover(desde, destino);
  }

  return (
    <ol className="bloques">
      {bloques.map((bloque, posicion) => (
        <li
          key={bloque.id}
          className={bloque.activo ? "bloque" : "bloque bloque--apagado"}
          draggable={!ocupado}
          onDragStart={() => { origen.current = posicion; }}
          onDragOver={(evento) => evento.preventDefault()}
          onDrop={() => soltarEn(posicion)}
          onDragEnd={() => { origen.current = null; }}
        >
          <div className="bloque__orden">
            <button
              type="button"
              aria-label={`Subir ${bloque.titulo}`}
              disabled={ocupado || posicion === 0}
              onClick={() => onMover(posicion, posicion - 1)}
            >
              ↑
            </button>

            <span className="bloque__numero">{posicion + 1}</span>

            <button
              type="button"
              aria-label={`Bajar ${bloque.titulo}`}
              disabled={ocupado || posicion === bloques.length - 1}
              onClick={() => onMover(posicion, posicion + 1)}
            >
              ↓
            </button>
          </div>

          <div className="bloque__cuerpo">
            <div className="bloque__cabecera">
              <h3 className="bloque__titulo">{bloque.titulo}</h3>

              <span className="bloque__etiqueta">
                {bloque.categoria?.nombre ?? NOMBRE_DEL_TIPO[bloque.tipo]}
              </span>

              {!bloque.activo && <span className="bloque__apagado">Desactivado</span>}
            </div>

            <p className="bloque__detalle">{bloque.detalle}</p>
          </div>

          <div className="bloque__acciones">
            <button type="button" onClick={() => onEditar(bloque)} disabled={ocupado}>
              Editar
            </button>

            <button type="button" onClick={() => onEstado(bloque)} disabled={ocupado}>
              {bloque.activo ? "Desactivar" : "Activar"}
            </button>

            <button
              type="button"
              className="peligro"
              onClick={() => onEliminar(bloque)}
              disabled={ocupado}
            >
              Eliminar
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
