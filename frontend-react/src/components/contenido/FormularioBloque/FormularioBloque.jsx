import { useState } from "react";

import "./FormularioBloque.css";

const TIPOS = [
  { valor: "enlace", nombre: "Enlace", ayuda: "Lleva a otro sitio: WhatsApp, Instagram, tu web…" },
  { valor: "texto", nombre: "Texto", ayuda: "Un párrafo que solo se lee." },
  { valor: "boton", nombre: "Botón", ayuda: "Como un enlace, pero destacado." }
];

const LIMITES = { titulo: 100, detalle: 2000 };

/**
 * Alta y edicion de un bloque.
 *
 * Al editar, el tipo se muestra pero no se cambia: el backend no lo admite en
 * PUT porque cada tipo vive en una tabla distinta.
 */
export default function FormularioBloque({
  inicial, seccion, categorias, onGuardar, onCancelar, guardando
}) {
  const editando = Boolean(inicial);

  const [tipo, setTipo] = useState(inicial?.tipo ?? "enlace");
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [detalle, setDetalle] = useState(inicial?.detalle ?? "");
  const [idCategoria, setIdCategoria] = useState(inicial?.categoria?.id ?? "");

  // De que lista salen las categorias depende del tipo
  const disponibles = tipo === "enlace" ? categorias.enlaces : categorias.elementos;

  const esWhatsapp = disponibles
    ?.find((c) => String(c.id) === String(idCategoria))?.nombre === "WhatsApp";

  function cambiarTipo(nuevo) {
    setTipo(nuevo);

    // La categoria elegida pertenecia a la otra lista: se descarta en lugar
    // de mandar un id que daria 400
    setIdCategoria("");
  }

  function enviar(evento) {
    evento.preventDefault();

    const datos = {
      titulo: titulo.trim(),
      detalle: detalle.trim(),
      idCategoria: Number(idCategoria),
      seccion
    };

    // Solo en el alta: en PUT el backend lo ignora, y mandarlo confundiria
    if (!editando) datos.tipo = tipo;

    onGuardar(datos);
  }

  return (
    <form className="bloque-form" onSubmit={enviar}>
      <h2 className="bloque-form__titulo">
        {editando ? `Editar «${inicial.titulo}»` : "Nuevo bloque"}
      </h2>

      <fieldset className="bloque-form__tipos" disabled={editando}>
        <legend className="bloque-form__etiqueta">
          Tipo {editando && <span className="bloque-form__fijo">no se puede cambiar</span>}
        </legend>

        {TIPOS.map((t) => (
          <label key={t.valor} className={t.valor === tipo ? "tipo tipo--elegido" : "tipo"}>
            <input
              type="radio"
              name="tipo"
              value={t.valor}
              checked={t.valor === tipo}
              onChange={() => cambiarTipo(t.valor)}
            />
            <span className="tipo__nombre">{t.nombre}</span>
            <span className="tipo__ayuda">{t.ayuda}</span>
          </label>
        ))}
      </fieldset>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="idCategoria">Categoría</label>
        <select
          id="idCategoria"
          className="campo__input"
          required
          value={idCategoria}
          onChange={(evento) => setIdCategoria(evento.target.value)}
        >
          <option value="">Elige una…</option>
          {disponibles?.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="titulo">Título</label>
        <input
          id="titulo"
          className="campo__input"
          required
          minLength={2}
          maxLength={LIMITES.titulo}
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
        />
      </div>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="detalle">
          {tipo === "texto" ? "Texto" : "Destino"}
        </label>

        {tipo === "texto" ? (
          <textarea
            id="detalle"
            className="campo__input campo__area"
            required
            rows={3}
            maxLength={LIMITES.detalle}
            value={detalle}
            onChange={(evento) => setDetalle(evento.target.value)}
          />
        ) : (
          <input
            id="detalle"
            className="campo__input"
            required
            maxLength={LIMITES.detalle}
            placeholder={esWhatsapp ? "300 123 4567" : "https://…"}
            value={detalle}
            onChange={(evento) => setDetalle(evento.target.value)}
          />
        )}

        <small className="campo__ayuda">
          {esWhatsapp
            ? "Escribe el teléfono y el servidor arma el enlace de WhatsApp."
            : tipo === "texto"
              ? "Lo que se lee en la página pública."
              : "Una dirección que empiece por http o https."}
        </small>
      </div>

      <div className="bloque-form__botones">
        <button type="submit" className="primario" disabled={guardando}>
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agregar bloque"}
        </button>
        <button type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
