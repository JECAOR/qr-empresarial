import { useState } from "react";

import "./FormularioUsuario.css";

/** Los valores con los que arranca el formulario, vacio o con un usuario. */
function valoresIniciales(inicial) {
  return {
    nombre: inicial?.nombre ?? "",
    correo: inicial?.correo ?? "",
    rol: inicial?.rol ?? "empresa",
    contrasena: ""
  };
}

/**
 * Alta y edicion de una cuenta.
 *
 * Los nombres de los campos salen de usuario.validator.js: nombre, correo,
 * rol y contrasena. Los roles son dos, "empresa" y "administrador" -no los
 * cuatro del ejemplo de la guia-, y el validador rechaza cualquier otro.
 *
 * La contrasena solo se pide al crear. Al editar no se precarga ni se envia:
 * PUT no la toca, y para cambiarla esta su propia ruta.
 */
export default function FormularioUsuario({ inicial, onGuardar, onCancelar, guardando }) {
  // El estado se inicializa una sola vez, no se sincroniza con un efecto.
  // Quien lo usa le pasa un `key` distinto por usuario, asi que al cambiar de
  // cuenta React monta el formulario de nuevo y los campos arrancan solos.
  // Sincronizarlo con useEffect provoca un dibujado de mas y, lo que es peor,
  // deja lo que el usuario estaba escribiendo en un estado ambiguo.
  const [form, setForm] = useState(() => valoresIniciales(inicial));

  function cambio(evento) {
    const { name, value } = evento.target;

    setForm((previo) => ({ ...previo, [name]: value }));
  }

  function enviar(evento) {
    evento.preventDefault();

    const datos = {
      nombre: form.nombre.trim(),
      correo: form.correo.trim(),
      rol: form.rol
    };

    if (!inicial) datos.contrasena = form.contrasena;

    onGuardar(datos);
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <h2 className="formulario__titulo">
        {inicial ? `Editar a ${inicial.nombre}` : "Nueva cuenta"}
      </h2>

      <div className="formulario__campos">
        <label>
          Nombre
          <input name="nombre" required value={form.nombre} onChange={cambio} />
        </label>

        <label>
          Correo
          <input name="correo" type="email" required value={form.correo} onChange={cambio} />
        </label>

        <label>
          Rol
          <select name="rol" required value={form.rol} onChange={cambio}>
            <option value="empresa">Empresa</option>
            <option value="administrador">Administrador</option>
          </select>
        </label>

        {!inicial && (
          <label>
            Contraseña
            <input
              name="contrasena"
              type="password"
              required
              autoComplete="new-password"
              value={form.contrasena}
              onChange={cambio}
            />
            <small>Mínimo 8 caracteres, con mayúscula, número y símbolo.</small>
          </label>
        )}
      </div>

      <div className="formulario__botones">
        <button type="submit" className="primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
