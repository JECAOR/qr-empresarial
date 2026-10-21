import "./FichaNegocio.css";

/**
 * Los datos del negocio: nombre, categoria y como contactarlo.
 *
 * Cada dato se dibuja solo si el negocio lo lleno. Sin esa condicion
 * aparecerian etiquetas vacias -"Teléfono:" sin numero-, que es peor que no
 * mostrar nada.
 */
function FichaNegocio({ perfil }) {
  return (
    <section className="ficha">
      <h2 className="ficha__nombre">{perfil.nombreNegocio}</h2>

      {perfil.categoria && <p className="ficha__categoria">{perfil.categoria}</p>}
      {perfil.descripcion && <p className="ficha__descripcion">{perfil.descripcion}</p>}

      <dl className="ficha__datos">
        {perfil.direccion && (
          <div>
            <dt>Dirección</dt>
            <dd>{perfil.direccion}</dd>
          </div>
        )}
        {perfil.telefono && (
          <div>
            <dt>Teléfono</dt>
            <dd>{perfil.telefono}</dd>
          </div>
        )}
        {perfil.horario && (
          <div>
            <dt>Horario</dt>
            <dd>{perfil.horario}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export default FichaNegocio;
