import { TEMAS } from "../../../styles/tema";
import "./SelectorTema.css";

// La lista vive en styles/tema.js, que es quien aplica el color: tenerla dos
// veces dejaria que la muestra de un boton ensenara un color distinto del
// que se acaba pintando.

/**
 * El color de marca del negocio.
 *
 * Se guarda al instante con su propia ruta, sin esperar al boton de guardar
 * del formulario: elegir un color es una decision de un clic, y obligar a
 * confirmarla aparte seria raro.
 *
 * El color se ve aplicado en el momento, sin recargar: quien lo elige mira
 * la barra cambiar de color mientras pulsa. Lo hace PerfilPage llamando a
 * aplicarTema() en cuanto el servidor confirma.
 */
export default function SelectorTema({ valor, onElegir, guardando }) {
  return (
    <div className="temas">
      {TEMAS.map((tema) => (
        <button
          key={tema.valor}
          type="button"
          className={tema.valor === valor ? "tema tema--elegido" : "tema"}
          onClick={() => onElegir(tema.valor)}
          disabled={guardando}
          aria-pressed={tema.valor === valor}
        >
          <span className="tema__color" style={{ background: tema.color }} />
          {tema.nombre}
        </button>
      ))}
    </div>
  );
}
