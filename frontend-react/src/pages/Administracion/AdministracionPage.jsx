import { useEffect, useRef, useState } from "react";

import {
  consultarResumen,
  listarUsuarios,
  consultarUsuario,
  descargarReporte,
  ESTADOS,
  ROLES,
  ORDENES,
  LARGO_MAXIMO_BUSQUEDA
} from "../../services/adminService";
import DetalleCuenta from "../../components/admin/DetalleCuenta/DetalleCuenta";
import "./AdministracionPage.css";

const CIFRAS = [
  { clave: "total", nombre: "Cuentas" },
  { clave: "activos", nombre: "Activas" },
  { clave: "restringidos", nombre: "Restringidas" },
  { clave: "administradores", nombre: "Administradores" },
  { clave: "nuevos30Dias", nombre: "Nuevas en 30 días" },
  { clave: "nuncaEntraron", nombre: "Nunca entraron" }
];

const FILTROS_VACIOS = {
  busqueda: "",
  estado: "",
  rol: "",
  orden: "registro",
  pagina: 1,
  porPagina: 10
};

const fecha = (valor) => (valor
  ? new Date(valor).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })
  : "—");

export default function AdministracionPage() {
  const [resumen, setResumen] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [paginacion, setPaginacion] = useState(null);

  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [escrito, setEscrito] = useState("");
  const [detalle, setDetalle] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const mensaje = useRef(null);

  useEffect(() => {
    if (error || aviso) {
      mensaje.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error, aviso]);

  // El resumen no depende de los filtros: se pide una vez
  useEffect(() => {
    let vigente = true;

    consultarResumen()
      .then((resultado) => {
        if (vigente) setResumen(resultado.data);
      })
      .catch((fallo) => {
        if (vigente) setError(fallo.message);
      });

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;

    setCargando(true);

    listarUsuarios(filtros)
      .then((resultado) => {
        if (!vigente) return;

        setUsuarios(resultado.data);
        setPaginacion(resultado.paginacion);
        setError("");
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
  }, [filtros]);

  /** Cambia un filtro y vuelve a la primera pagina. */
  function cambiarFiltro(clave, valor) {
    setFiltros((previo) => ({ ...previo, [clave]: valor, pagina: 1 }));
  }

  function buscar(evento) {
    evento.preventDefault();
    cambiarFiltro("busqueda", escrito.trim());
  }

  function limpiar() {
    setEscrito("");
    setFiltros(FILTROS_VACIOS);
  }

  async function verDetalle(usuario) {
    setError("");

    try {
      setDetalle((await consultarUsuario(usuario.id)).data);
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function bajarReporte() {
    setBajando(true);
    setError("");
    setAviso("");

    try {
      // Sin pagina ni porPagina: el reporte lleva todo lo que cumple los
      // filtros, no solo la pagina que se esta viendo.
      const { blob, nombre } = await descargarReporte({
        busqueda: filtros.busqueda,
        estado: filtros.estado,
        rol: filtros.rol,
        orden: filtros.orden
      });

      const enlace = document.createElement("a");

      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombre;
      enlace.click();

      URL.revokeObjectURL(enlace.href);
      setAviso(`Descargado ${nombre}`);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setBajando(false);
    }
  }

  const hayFiltros = filtros.busqueda || filtros.estado || filtros.rol
    || filtros.orden !== "registro";

  return (
    <main className="admin">
      <section className="panel">
        <header className="panel__cabecera">
          <div>
            <h1 className="panel__titulo">Administración</h1>
            <p className="panel__sub">Las cuentas del sistema y su actividad.</p>
          </div>

          <button
            type="button"
            className="boton-principal"
            onClick={bajarReporte}
            disabled={bajando}
          >
            {bajando ? "Preparando…" : "Descargar reporte"}
          </button>
        </header>

        <div ref={mensaje}>
          {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}
          {aviso && <p className="mensaje mensaje--ok" role="status">{aviso}</p>}
        </div>

        {resumen && (
          <div className="cifras">
            {CIFRAS.map((c) => (
              <article key={c.clave} className="cifra">
                <p className="cifra__valor">{resumen[c.clave]}</p>
                <p className="cifra__nombre">{c.nombre}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <form className="filtros" onSubmit={buscar}>
          <div className="filtros__buscar">
            <label className="sr-only" htmlFor="busqueda">Buscar</label>
            <input
              id="busqueda"
              className="campo__input"
              placeholder="Nombre, correo o negocio…"
              maxLength={LARGO_MAXIMO_BUSQUEDA}
              value={escrito}
              onChange={(e) => setEscrito(e.target.value)}
            />
            <button type="submit">Buscar</button>
          </div>

          <div className="filtros__selects">
            <label className="sr-only" htmlFor="estado">Estado</label>
            <select
              id="estado"
              className="campo__input"
              value={filtros.estado}
              onChange={(e) => cambiarFiltro("estado", e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>

            <label className="sr-only" htmlFor="rol">Rol</label>
            <select
              id="rol"
              className="campo__input"
              value={filtros.rol}
              onChange={(e) => cambiarFiltro("rol", e.target.value)}
            >
              <option value="">Todos los roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <label className="sr-only" htmlFor="orden">Orden</label>
            <select
              id="orden"
              className="campo__input"
              value={filtros.orden}
              onChange={(e) => cambiarFiltro("orden", e.target.value)}
            >
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>{o.nombre}</option>
              ))}
            </select>

            {hayFiltros && (
              <button type="button" className="filtros__limpiar" onClick={limpiar}>
                Quitar filtros
              </button>
            )}
          </div>
        </form>

        {cargando ? (
          <p className="vacio">Cargando cuentas…</p>
        ) : usuarios.length === 0 ? (
          <p className="vacio">
            Ninguna cuenta cumple estos filtros. Prueba con otros, o quítalos.
          </p>
        ) : (
          <>
            <div className="tabla-scroll">
              <table className="tabla">
                <caption className="sr-only">Cuentas registradas y su actividad</caption>

                <thead>
                  <tr>
                    <th scope="col">Cuenta</th>
                    <th scope="col">Negocio</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Registro</th>
                    <th scope="col">Último acceso</th>
                    <th scope="col">Actividad</th>
                    <th scope="col"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>

                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td data-label="Cuenta">
                        <strong>{u.nombre}</strong>
                        <small>{u.correo}</small>
                        {u.rol === "administrador" && <span className="rol">admin</span>}
                      </td>

                      <td data-label="Negocio">
                        {u.perfil ? (
                          <>
                            {u.perfil.nombreNegocio}
                            <small>
                              {u.perfil.bloquesActivos} bloques ·{" "}
                              {u.perfil.qr === null
                                ? "sin código"
                                : u.perfil.qr ? "publicado" : "retirado"}
                            </small>
                          </>
                        ) : <span className="apagado">Sin perfil</span>}
                      </td>

                      <td data-label="Estado">
                        <span className={u.estado === "activo" ? "pastilla pastilla--activa" : "pastilla"}>
                          {u.estado}
                        </span>
                      </td>

                      <td data-label="Registro">{fecha(u.fechaRegistro)}</td>

                      <td data-label="Último acceso">
                        {u.ultimoAcceso ? fecha(u.ultimoAcceso) : <span className="apagado">Nunca entró</span>}
                      </td>

                      <td data-label="Actividad">
                        {u.actividad.escaneos + u.actividad.visitas + u.actividad.clics === 0
                          ? <span className="apagado">—</span>
                          : `${u.actividad.escaneos} · ${u.actividad.visitas} · ${u.actividad.clics}`}
                      </td>

                      <td data-label="Acciones">
                        <button type="button" onClick={() => verDetalle(u)}>Ver</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paginacion && paginacion.paginas > 1 && (
              <nav className="paginas" aria-label="Páginas">
                <button
                  type="button"
                  disabled={paginacion.pagina <= 1}
                  onClick={() => setFiltros((p) => ({ ...p, pagina: p.pagina - 1 }))}
                >
                  Anterior
                </button>

                <span>
                  Página {paginacion.pagina} de {paginacion.paginas} ·{" "}
                  {paginacion.total} cuentas
                </span>

                <button
                  type="button"
                  disabled={paginacion.pagina >= paginacion.paginas}
                  onClick={() => setFiltros((p) => ({ ...p, pagina: p.pagina + 1 }))}
                >
                  Siguiente
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {detalle && <DetalleCuenta cuenta={detalle} onCerrar={() => setDetalle(null)} />}
    </main>
  );
}
