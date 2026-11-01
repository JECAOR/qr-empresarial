import { useEffect, useRef } from "react";

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
  // En una ref y no en estado porque el origen no se dibuja: se guarda al
  // empezar el arrastre y se lee al soltar.
  //
  // El motivo que decia antes este comentario -que los tres eventos pueden
  // caer en el mismo tic y el estado no estaria aplicado al llegar el drop-
  // era falso, y se comprobo: con el componente cambiado a useState, un
  // arrastre en Chromium reordena igual, tanto despacio como con los tres
  // eventos uno detras de otro. React trata dragstart y drop como eventos
  // discretos y aplica el cambio antes de entregar el siguiente.
  //
  // La ref se queda porque ahorra un redibujado de la lista entera cada vez
  // que empieza un arrastre, sin nada nuevo que enseñar. No porque haga
  // falta para que funcione.
  const origen = useRef(null);

  // --- Devolver el foco despues de una accion ---
  //
  // Todos estos botones se apagan mientras viaja la peticion -disabled={ocupado}-
  // y un boton que se apaga teniendo el foco se lo deja al <body>: el navegador
  // no puede dejarselo a algo deshabilitado. Con raton no se nota; con el
  // teclado, cada vez que se pulsaba una flecha habia que tabular desde el
  // principio de la pagina para volver. Y las flechas son la UNICA forma de
  // reordenar con el teclado, porque el arrastre de HTML no responde a el.
  //
  // Se apunta a donde hay que volver antes de llamar, y se vuelve cuando la
  // lista ya esta dibujada de nuevo.
  const lista = useRef(null);
  const volverA = useRef(null);

  useEffect(() => {
    if (ocupado || !volverA.current) return;

    const destino = lista.current?.querySelector(`[data-foco="${volverA.current}"]`);

    volverA.current = null;

    // Puede haber quedado deshabilitado -la flecha de subir del que acaba de
    // llegar al primer puesto- o haber desaparecido, si se elimino el bloque.
    if (destino && !destino.disabled) {
      destino.focus();
      return;
    }

    // Entonces el foco va a la lista, que es el sitio del que se venia: desde
    // ahi el siguiente tabulador sigue por donde toca, y no desde el
    // principio de la pagina.
    lista.current?.focus();
  }, [ocupado, bloques]);

  const alPulsar = (marca, accion) => () => {
    volverA.current = marca;
    accion();
  };

  function soltarEn(destino) {
    const desde = origen.current;

    origen.current = null;

    if (desde === null || desde === destino) return;

    onMover(desde, destino);
  }

  return (
    // tabIndex -1: no entra en el recorrido del tabulador, pero puede recibir
    // el foco por codigo cuando el boton al que habria que volver ya no esta.
    <ol className="bloques" ref={lista} tabIndex={-1}>
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
              data-foco={`subir-${bloque.id}`}
              disabled={ocupado || posicion === 0}
              onClick={alPulsar(`subir-${bloque.id}`, () => onMover(posicion, posicion - 1))}
            >
              ↑
            </button>

            <span className="bloque__numero">{posicion + 1}</span>

            <button
              type="button"
              aria-label={`Bajar ${bloque.titulo}`}
              data-foco={`bajar-${bloque.id}`}
              disabled={ocupado || posicion === bloques.length - 1}
              onClick={alPulsar(`bajar-${bloque.id}`, () => onMover(posicion, posicion + 1))}
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

            {/* El bloque sigue ahi, solo cambia su estado: se vuelve al mismo
                boton, que es lo que permite apagarlo y encenderlo sin perder
                el sitio. */}
            <button
              type="button"
              data-foco={`estado-${bloque.id}`}
              onClick={alPulsar(`estado-${bloque.id}`, () => onEstado(bloque))}
              disabled={ocupado}
            >
              {bloque.activo ? "Desactivar" : "Activar"}
            </button>

            {/* Al eliminar, el boton desaparece con su bloque: el efecto de
                arriba no lo encuentra y deja el foco en la lista. A proposito
                no se pasa al Eliminar del bloque siguiente, que dejaria el
                dedo encima de un boton destructivo. */}
            <button
              type="button"
              className="peligro"
              data-foco={`eliminar-${bloque.id}`}
              onClick={alPulsar(`eliminar-${bloque.id}`, () => onEliminar(bloque))}
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
