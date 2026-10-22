import "./SelectorTema.css";

// Los tres que acepta el validador del backend. Cualquier otro da 400.
const TEMAS = [
  { valor: "indigo", nombre: "Índigo", color: "#4F46E5" },
  { valor: "teal", nombre: "Esmeralda", color: "#0B7D73" },
  { valor: "terracota", nombre: "Terracota", color: "#C2410C" }
];

/**
 * El color de marca del negocio.
 *
 * Se guarda al instante con su propia ruta, sin esperar al boton de guardar
 * del formulario: elegir un color es una decision de un clic, y obligar a
 * confirmarla aparte seria raro.
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
