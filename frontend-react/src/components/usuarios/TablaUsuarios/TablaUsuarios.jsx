import "./TablaUsuarios.css";

/**
 * El listado de cuentas.
 *
 * Los campos van en camelCase -idUsuario, fechaRegistro-, que es como responde
 * la API desde la v2.5.0. Antes devolvia las filas crudas de MySQL y habia que
 * escribir aqui u.id_usuario, con el resto de la API en camelCase.
 *
 * El estado es una palabra, "activo" o "restringido", no un 1 o un 0.
 */
export default function TablaUsuarios({ usuarios, yo, onVer, onEditar, onEstado, onEliminar }) {
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <caption className="sr-only">Cuentas registradas en el sistema</caption>

        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Nombre</th>
            <th scope="col">Correo</th>
            <th scope="col">Rol</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {usuarios.map((u) => {
            // Un administrador no puede restringirse ni eliminarse a si mismo:
            // el servidor responde 400 y, si fuera el unico, nadie podria
            // volver a administrar el sistema. Se avisa aqui en lugar de
            // ofrecer un boton que solo da error.
            const esMiCuenta = u.idUsuario === yo?.idUsuario;
            const activo = u.estado === "activo";

            return (
              <tr key={u.idUsuario}>
                <td data-label="ID">{u.idUsuario}</td>
                <td data-label="Nombre">
                  {u.nombre}
                  {esMiCuenta && <span className="tabla__tu">tu cuenta</span>}
                </td>
                <td data-label="Correo">{u.correo}</td>
                <td data-label="Rol">{u.rol}</td>
                <td data-label="Estado">
                  <span className={activo ? "pastilla pastilla--activa" : "pastilla"}>
                    {activo ? "Activo" : "Restringido"}
                  </span>
                </td>
                <td data-label="Acciones">
                  <div className="tabla__acciones">
                    <button type="button" onClick={() => onVer(u)}>Ver</button>
                    <button type="button" onClick={() => onEditar(u)}>Editar</button>
                    <button
                      type="button"
                      onClick={() => onEstado(u)}
                      disabled={esMiCuenta && activo}
                      title={esMiCuenta && activo ? "No puedes restringir tu propia cuenta" : undefined}
                    >
                      {activo ? "Restringir" : "Activar"}
                    </button>
                    <button
                      type="button"
                      className="peligro"
                      onClick={() => onEliminar(u)}
                      disabled={esMiCuenta}
                      title={esMiCuenta ? "No puedes eliminar tu propia cuenta" : undefined}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
