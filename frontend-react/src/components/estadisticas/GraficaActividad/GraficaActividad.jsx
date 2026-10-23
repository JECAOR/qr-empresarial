import { useId } from "react";

import "./GraficaActividad.css";

// El lienzo se dibuja en coordenadas propias y el SVG lo escala al ancho que
// tenga. Asi no hace falta medir el contenedor ni volver a dibujar al cambiar
// el tamano de la ventana.
const ANCHO = 720;
const ALTO = 240;
const MARGEN = { arriba: 16, derecha: 12, abajo: 28, izquierda: 34 };

const SERIES = [
  { clave: "escaneos", nombre: "Escaneos", color: "var(--color-primary)" },
  { clave: "clics", nombre: "Clics", color: "#0B7D73" }
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * La actividad dia a dia.
 *
 * Se dibuja a mano en SVG en lugar de traer una libreria de graficas: son dos
 * series de siete a noventa puntos, y Chart.js con su envoltorio para React
 * pesa mas que todo el resto de esta aplicacion junta.
 */
export default function GraficaActividad({ serie }) {
  const id = useId();

  const alto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha;

  // El maximo marca la escala. Si no hay actividad se usa 1, para que el eje
  // no se divida por cero y la linea quede abajo en lugar de desaparecer.
  const maximo = Math.max(
    1,
    ...serie.flatMap((punto) => SERIES.map((s) => punto[s.clave]))
  );

  const x = (indice) => (serie.length === 1
    ? MARGEN.izquierda + ancho / 2
    : MARGEN.izquierda + (indice * ancho) / (serie.length - 1));

  const y = (valor) => MARGEN.arriba + alto - (valor / maximo) * alto;

  // Las marcas del eje: cero, la mitad y el maximo. Mas serian ruido.
  const marcas = [0, Math.round(maximo / 2), maximo]
    .filter((v, i, todas) => todas.indexOf(v) === i);

  // Con muchos dias no caben todas las fechas: se enseña una de cada tantas
  const cadaCuantas = Math.ceil(serie.length / 8);

  // A siete dias, el nombre del dia basta y se lee mejor. A treinta o noventa
  // se repite -"Dom" cinco veces- y deja de decir nada: ahi va la fecha.
  const etiquetaDe = (punto) => {
    if (serie.length <= 7) return punto.etiqueta;

    // La fecha llega como "2026-10-17". Partirla a mano y no con Date evita
    // dos cosas: que el navegador la interprete en UTC y enseñe el día
    // anterior, y una llamada impura en medio del dibujado.
    const [, mes, dia] = punto.fecha.split("-");

    return `${Number(dia)} ${MESES[Number(mes) - 1]}`;
  };

  return (
    <figure className="grafica">
      <figcaption className="grafica__leyenda">
        {SERIES.map((s) => (
          <span key={s.clave}>
            <i style={{ background: s.color }} aria-hidden="true" />
            {s.nombre}
          </span>
        ))}
      </figcaption>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="grafica__lienzo"
        role="img"
        aria-label={`Actividad de los últimos ${serie.length} días`}
      >
        {marcas.map((valor) => (
          <g key={valor}>
            <line
              className="grafica__guia"
              x1={MARGEN.izquierda}
              x2={ANCHO - MARGEN.derecha}
              y1={y(valor)}
              y2={y(valor)}
            />
            <text className="grafica__numero" x={MARGEN.izquierda - 8} y={y(valor) + 4}>
              {valor}
            </text>
          </g>
        ))}

        {SERIES.map((s) => {
          const puntos = serie.map((punto, i) => `${x(i)},${y(punto[s.clave])}`);

          return (
            <g key={s.clave}>
              <polyline
                className="grafica__linea"
                points={puntos.join(" ")}
                stroke={s.color}
              />

              {serie.map((punto, i) => (
                <circle
                  key={`${id}-${s.clave}-${punto.fecha}`}
                  className="grafica__punto"
                  cx={x(i)}
                  cy={y(punto[s.clave])}
                  r={serie.length > 30 ? 0 : 3}
                  fill={s.color}
                >
                  <title>
                    {punto.etiqueta} {punto.fecha}: {punto[s.clave]} {s.nombre.toLowerCase()}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}

        {serie.map((punto, i) => (
          i % cadaCuantas === 0 ? (
            <text
              key={punto.fecha}
              className="grafica__fecha"
              x={x(i)}
              y={ALTO - 8}
            >
              {etiquetaDe(punto)}
            </text>
          ) : null
        ))}
      </svg>
    </figure>
  );
}
