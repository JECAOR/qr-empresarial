import { useCallback, useEffect, useRef, useState } from "react";

import {
  listarContenido,
  listarCategorias,
  crearContenido,
  actualizarContenido,
  cambiarEstadoContenido,
  eliminarContenido,
  reordenarContenido,
  SECCIONES
} from "../../services/contenidoService";
import FormularioBloque from "../../components/contenido/FormularioBloque/FormularioBloque";
import ListaBloques from "../../components/contenido/ListaBloques/ListaBloques";
import useTitulo from "../../hooks/useTitulo";
import "./ContenidoPage.css";

// Las mismas tres del frontend original, para que un perfil se vea igual en
// las dos aplicaciones.
export default function ContenidoPage() {
  useTitulo("Contenido");

  const [bloques, setBloques] = useState([]);
  const [categorias, setCategorias] = useState({ enlaces: [], elementos: [] });

  const [seccion, setSeccion] = useState("menu");
  const [editando, setEditando] = useState(null);
  const [formVisible, setFormVisible] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const mensaje = useRef(null);

  useEffect(() => {
    if (error || aviso) {
      mensaje.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error, aviso]);

  const cargar = useCallback(async () => {
    const resultado = await listarContenido();

    if (!Array.isArray(resultado?.data)) {
      // El detalle tecnico va a la consola, que es donde sirve. Lo que se
      // ensena en pantalla tiene que poder leerlo quien atiende un negocio:
      // "GET GET /contenido no devolvio una lista" no le dice que hacer.
      console.error("GET /contenido no devolvió una lista:", resultado);

      throw new Error(
        "No se pudo leer tu contenido: el servidor respondió algo inesperado. Vuelve a intentarlo en un momento."
      );
    }

    setBloques(resultado.data);
  }, []);

  useEffect(() => {
    let vigente = true;

    // Por cargar() y no por listarContenido() a secas: es donde esta la
    // comprobacion de que lo que llega es una lista. Sin ella, una respuesta
    // con otra forma dejaba un valor cualquiera en `bloques` y la pantalla
    // reventaba al dibujar, con un .filter sobre algo que no es un arreglo.
    // La pantalla de usuarios ya lo hacia asi; esta no.
    // eslint-disable-next-line react/set-state-in-effect
    Promise.all([cargar(), listarCategorias()])
      .then(([, cats]) => {
        if (!vigente) return;

        setCategorias(cats.data);
      })
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

  // Los de esta pestana, en su orden. El servidor ya los manda ordenados.
  const deLaSeccion = bloques.filter((b) => b.seccion === seccion);

  async function ejecutar(accion, mensajeExito) {
    setOcupado(true);
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
      setOcupado(false);
    }
  }

  async function guardar(datos) {
    const correcto = await ejecutar(
      () => (editando
        ? actualizarContenido(editando.id, datos)
        : crearContenido(datos)),
      editando ? "Bloque actualizado" : "Bloque agregado"
    );

    if (correcto) {
      setFormVisible(false);
      setEditando(null);
    }
  }

  function editar(bloque) {
    setEditando(bloque);
    setFormVisible(true);
    setError("");
    setAviso("");
  }

  function nuevo() {
    setEditando(null);
    setFormVisible(true);
    setError("");
    setAviso("");
  }

  async function estado(bloque) {
    await ejecutar(
      () => cambiarEstadoContenido(bloque.id, !bloque.activo),
      bloque.activo ? "Bloque desactivado" : "Bloque activado"
    );
  }

  async function eliminar(bloque) {
    const pregunta = `Se eliminará «${bloque.titulo}». Esto no se puede deshacer; `
      + "si solo quieres que deje de verse, desactívalo. ¿Continuar?";

    if (!window.confirm(pregunta)) return;

    await ejecutar(() => eliminarContenido(bloque.id), "Bloque eliminado");
  }

  /**
   * Mueve un bloque dentro de su seccion.
   *
   * Se manda la lista entera en el orden nuevo, que es lo que espera el
   * servidor. No se toca el estado local antes de que responda: si fallara,
   * la pantalla mostraria un orden que la base no tiene.
   */
  async function mover(desde, hasta) {
    if (hasta < 0 || hasta >= deLaSeccion.length) return;

    const ordenados = [...deLaSeccion];
    const [movido] = ordenados.splice(desde, 1);

    ordenados.splice(hasta, 0, movido);

    await ejecutar(
      () => reordenarContenido(ordenados.map((b) => b.id)),
      "Orden actualizado"
    );
  }

  if (cargando) {
    return (
      <main className="contenido">
        <p className="aviso">Cargando el contenido…</p>
      </main>
    );
  }

  return (
    <main className="contenido">
      <section className="panel">
        <header className="panel__cabecera">
          <div>
            <h1 className="panel__titulo">Contenido del perfil</h1>
            <p className="panel__sub">
              Los bloques que ve quien escanea tu código, en el orden en que se
              muestran.
            </p>
          </div>

          <button type="button" className="boton-principal" onClick={nuevo} disabled={ocupado}>
            Agregar bloque
          </button>
        </header>

        <nav className="pestanas">
          {SECCIONES.map((s) => {
            const cuantos = bloques.filter((b) => b.seccion === s.id).length;

            return (
              <button
                key={s.id}
                type="button"
                className={s.id === seccion ? "pestana pestana--activa" : "pestana"}
                onClick={() => setSeccion(s.id)}
                aria-current={s.id === seccion ? "page" : undefined}
              >
                {s.nombre}
                <span className="pestana__cuenta">{cuantos}</span>
              </button>
            );
          })}
        </nav>

        <div ref={mensaje}>
          {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}
          {aviso && <p className="mensaje mensaje--ok" role="status">{aviso}</p>}
        </div>

        {formVisible && (
          <FormularioBloque
            key={editando?.id ?? `nuevo-${seccion}`}
            inicial={editando}
            seccion={editando?.seccion ?? seccion}
            categorias={categorias}
            guardando={ocupado}
            onGuardar={guardar}
            onCancelar={() => {
              setFormVisible(false);
              setEditando(null);
            }}
          />
        )}

        {deLaSeccion.length === 0 ? (
          <p className="vacio">
            Esta sección todavía no tiene bloques. Agrega el primero para que
            tenga algo que mostrar.
          </p>
        ) : (
          <ListaBloques
            bloques={deLaSeccion}
            ocupado={ocupado}
            onEditar={editar}
            onEstado={estado}
            onEliminar={eliminar}
            onMover={mover}
          />
        )}
      </section>
    </main>
  );
}
