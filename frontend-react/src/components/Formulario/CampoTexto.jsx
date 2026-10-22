import "./CampoTexto.css";

/**
 * Un campo con su etiqueta, su ayuda y su error.
 *
 * Las cuatro pantallas de cuenta -entrar, registrarse, recuperar y
 * restablecer- repetian el mismo bloque de etiqueta, input y texto de ayuda.
 */
function CampoTexto({ id, etiqueta, ayuda, ...resto }) {
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>{etiqueta}</label>
      <input id={id} name={id} className="campo__input" {...resto} />
      {ayuda && <small className="campo__ayuda">{ayuda}</small>}
    </div>
  );
}

export default CampoTexto;
