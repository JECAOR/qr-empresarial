import "./Encabezado.css";

/**
 * La barra superior de la aplicacion.
 *
 * Recibe el texto por props en lugar de traerlo escrito dentro: asi el mismo
 * componente sirve para otra pantalla sin tocarlo.
 */
function Encabezado({ titulo, subtitulo }) {
  return (
    <header className="encabezado">
      <h1 className="encabezado__titulo">{titulo}</h1>
      <p className="encabezado__subtitulo">{subtitulo}</p>
    </header>
  );
}

export default Encabezado;
