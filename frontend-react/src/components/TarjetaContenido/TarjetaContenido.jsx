import "./TarjetaContenido.css";

/**
 * Un bloque de contenido del perfil (RF-05 y RF-06).
 *
 * Son de dos clases y no se dibujan igual: un enlace o un boton llevan a otro
 * sitio y tienen que poder pulsarse; un texto solo se lee.
 */
function TarjetaContenido({ titulo, detalle, categoria, tipo }) {
  const esEnlace = tipo === "enlace" || tipo === "boton";

  return (
    <article className="tarjeta">
      <div className="tarjeta__cabecera">
        <h3 className="tarjeta__titulo">{titulo}</h3>
        <span className="tarjeta__categoria">{categoria}</span>
      </div>

      {esEnlace ? (
        <a
          className="tarjeta__enlace"
          href={detalle}
          target="_blank"
          rel="noreferrer noopener"
        >
          {detalle}
        </a>
      ) : (
        <p className="tarjeta__texto">{detalle}</p>
      )}
    </article>
  );
}

export default TarjetaContenido;
