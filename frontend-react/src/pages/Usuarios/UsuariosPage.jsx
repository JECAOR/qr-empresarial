import { useCallback, useEffect, useState } from "react";

import {
  listarUsuarios,
  consultarUsuario,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario
} from "../../services/usuarioService";
import { useAuth } from "../../context/AuthContext";
import TablaUsuarios from "../../components/usuarios/TablaUsuarios/TablaUsuarios";
import FormularioUsuario from "../../components/usuarios/FormularioUsuario/FormularioUsuario";
import "./UsuariosPage.css";

export default function UsuariosPage() {
  const { usuario: yo } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [formVisible, setFormVisible] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    const resultado = await listarUsuarios();

    if (!Array.isArray(resultado?.data)) {
      throw new Error("GET /usuarios no devolvió una lista");
    }

    setUsuarios(resultado.data);
  }, []);

  useEffect(() => {
    let vigente = true;

    cargar()
      .catch((fallo) => {
        if (vigente) setError(fallo.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [cargar]);

  /**
   * Ejecuta una operacion, refresca la lista y avisa del resultado.
   *
   * La lista se vuelve a pedir en lugar de tocarla a mano: el servidor puede
   * haber hecho mas de lo que se le pidio -una eliminacion logica tambien
   * cierra las sesiones de esa cuenta- y lo que vale es su version.
   */
  async function ejecutar(accion, mensajeExito) {
    setGuardando(true);
    setError("");
    setAviso("");

    try {
      await accion();
      await cargar();
      setAviso(mensajeExito);

      return true;
    } catch (fallo) {
      setError(fallo.message);

      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function ver(u) {
    setError("");
    setAviso("");

    try {
      const resultado = await consultarUsuario(u.idUsuario);

      setDetalle(resultado.data);
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function editar(u) {
    setError("");
    setAviso("");

    try {
      // Se pide el usuario otra vez en lugar de usar la fila de la tabla:
      // asi el formulario arranca con lo que hay ahora en la base, no con lo
      // que se cargo hace cinco minutos.
      const resultado = await consultarUsuario(u.idUsuario);

      setSeleccionado(resultado.data);
      setFormVisible(true);
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  function nuevo() {
    setSeleccionado(null);
    setDetalle(null);
    setError("");
    setAviso("");
    setFormVisible(true);
  }

  async function guardar(datos) {
    const editando = Boolean(seleccionado);

    const correcto = await ejecutar(
      () => (editando
        ? actualizarUsuario(seleccionado.idUsuario, datos)
        : crearUsuario(datos)),
      editando ? "Cuenta actualizada" : "Cuenta creada"
    );

    // Solo se cierra si salio bien: si el servidor rechazo algo -un correo
    // repetido, una contrasena debil-, el formulario se queda abierto con lo
    // que se habia escrito y el mensaje encima.
    if (correcto) {
      setFormVisible(false);
      setSeleccionado(null);
    }
  }

  async function estado(u) {
    const siguiente = u.estado === "activo" ? "restringido" : "activo";

    const pregunta = siguiente === "restringido"
      ? `${u.nombre} dejará de poder iniciar sesión, y las sesiones que tenga abiertas dejarán de servir. ¿Continuar?`
      : `${u.nombre} podrá volver a iniciar sesión. ¿Continuar?`;

    if (!window.confirm(pregunta)) return;

    await ejecutar(
      () => cambiarEstadoUsuario(u.idUsuario, siguiente),
      siguiente === "restringido" ? "Cuenta restringida" : "Cuenta activada"
    );
  }

  async function eliminar(u) {
    const pregunta = `Se eliminará la cuenta de ${u.nombre}. Es una eliminación lógica: `
      + "sus datos se conservan, pero deja de aparecer y no podrá entrar. ¿Continuar?";

    if (!window.confirm(pregunta)) return;

    const correcto = await ejecutar(() => eliminarUsuario(u.idUsuario), "Cuenta eliminada");

    if (correcto && detalle?.idUsuario === u.idUsuario) setDetalle(null);
  }

  return (
    <main className="usuarios">
      <section className="usuarios__panel">
        <header className="usuarios__cabecera">
          <div>
            <h1 className="usuarios__titulo">Gestión de usuarios</h1>
            <p className="usuarios__sub">
              {cargando ? "Cargando…" : `${usuarios.length} cuentas registradas`}
            </p>
          </div>

          <button type="button" className="usuarios__nuevo" onClick={nuevo}>
            Nueva cuenta
          </button>
        </header>

        {error && <p className="usuarios__mensaje usuarios__mensaje--error" role="alert">{error}</p>}
        {aviso && <p className="usuarios__mensaje usuarios__mensaje--ok" role="status">{aviso}</p>}

        {formVisible && (
          <FormularioUsuario
            key={seleccionado?.idUsuario ?? "nueva"}
            inicial={seleccionado}
            guardando={guardando}
            onGuardar={guardar}
            onCancelar={() => {
              setFormVisible(false);
              setSeleccionado(null);
            }}
          />
        )}

        {detalle && (
          <section className="detalle">
            <h2 className="detalle__titulo">{detalle.nombre}</h2>

            <dl className="detalle__datos">
              <div><dt>ID</dt><dd>{detalle.idUsuario}</dd></div>
              <div><dt>Correo</dt><dd>{detalle.correo}</dd></div>
              <div><dt>Rol</dt><dd>{detalle.rol}</dd></div>
              <div><dt>Estado</dt><dd>{detalle.estado}</dd></div>
              <div>
                <dt>Registro</dt>
                <dd>{new Date(detalle.fechaRegistro).toLocaleDateString("es-CO")}</dd>
              </div>
            </dl>

            <button type="button" onClick={() => setDetalle(null)}>Cerrar</button>
          </section>
        )}

        {cargando ? (
          <p className="usuarios__vacio">Cargando usuarios…</p>
        ) : usuarios.length === 0 ? (
          <p className="usuarios__vacio">No hay cuentas registradas.</p>
        ) : (
          <TablaUsuarios
            usuarios={usuarios}
            yo={yo}
            onVer={ver}
            onEditar={editar}
            onEstado={estado}
            onEliminar={eliminar}
          />
        )}
      </section>
    </main>
  );
}
