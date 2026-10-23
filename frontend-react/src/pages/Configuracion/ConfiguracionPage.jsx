import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  guardarMisDatos,
  cambiarMiContrasena,
  consultarMisPreferencias,
  guardarMisPreferencias,
  eliminarMiCuenta
} from "../../services/cuentaPropiaService";
import { useAuth } from "../../context/AuthContext";
import CampoTexto from "../../components/Formulario/CampoTexto";
import "./ConfiguracionPage.css";

const AVISOS = [
  {
    clave: "resumen",
    nombre: "Resumen de actividad",
    ayuda: "Cuántas veces se escaneó tu código y qué se pulsó."
  },
  {
    clave: "novedades",
    nombre: "Novedades del sistema",
    ayuda: "Cuando se agregue algo nuevo a la aplicación."
  }
];

export default function ConfiguracionPage() {
  const { usuario, salir, refrescar } = useAuth();
  const navegar = useNavigate();

  // Se inicializa una vez con lo que ya trajo AuthContext. No se sincroniza
  // con un efecto: esta ruta va detrás de RutaProtegida, así que cuando se
  // dibuja ya hay sesión, y un efecto que copia props a estado provoca un
  // dibujado de más y deja ambiguo lo que el usuario esté escribiendo.
  const [datos, setDatos] = useState(() => ({
    nombre: usuario?.nombre ?? "",
    correo: usuario?.correo ?? "",
    contrasena: ""
  }));
  const [claves, setClaves] = useState({ actual: "", nueva: "", repetida: "" });
  const [avisos, setAvisos] = useState({ resumen: true, novedades: false, guardadas: false });
  const [paraBorrar, setParaBorrar] = useState("");

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

  // El nombre y el correo ya los trajo AuthContext; solo hay que pedir las
  // preferencias, que tienen su propia ruta.
  useEffect(() => {
    let vigente = true;

    consultarMisPreferencias()
      .then((resultado) => {
        if (vigente) setAvisos(resultado.data);
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
  }, []);

  async function ejecutar(accion, mensajeExito) {
    setOcupado(true);
    setError("");
    setAviso("");

    try {
      await accion();
      setAviso(mensajeExito);

      return true;
    } catch (fallo) {
      setError(fallo.message);

      return false;
    } finally {
      setOcupado(false);
    }
  }

  // El correo cambia solo si es distinto del que ya tiene la cuenta
  const cambiaElCorreo = datos.correo.trim() !== (usuario?.correo ?? "");

  async function guardarDatos(evento) {
    evento.preventDefault();

    const correcto = await ejecutar(
      () => guardarMisDatos({
        nombre: datos.nombre.trim(),
        correo: datos.correo.trim(),
        contrasena: cambiaElCorreo ? datos.contrasena : null
      }),
      cambiaElCorreo ? "Datos guardados. Entra con tu correo nuevo la próxima vez." : "Datos guardados"
    );

    if (correcto) {
      setDatos((previo) => ({ ...previo, contrasena: "" }));

      // La barra de navegacion ensena el nombre: sin esto seguiria con el
      // viejo hasta recargar la pagina.
      await refrescar();
    }
  }

  async function cambiarClave(evento) {
    evento.preventDefault();

    if (claves.nueva !== claves.repetida) {
      setError("Las dos contraseñas nuevas no coinciden");

      return;
    }

    const correcto = await ejecutar(
      () => cambiarMiContrasena({
        contrasenaActual: claves.actual,
        contrasenaNueva: claves.nueva
      }),
      "Contraseña cambiada. Las sesiones que tuvieras abiertas en otros dispositivos se cerraron."
    );

    if (correcto) setClaves({ actual: "", nueva: "", repetida: "" });
  }

  async function cambiarAviso(clave) {
    const siguiente = { ...avisos, [clave]: !avisos[clave] };

    // Se pinta de inmediato para que el interruptor responda al dedo, pero
    // lo que queda es lo que conteste el servidor: entre otras cosas, es el
    // quien sabe que la preferencia ya dejo de ser la de fabrica.
    setAvisos(siguiente);

    await ejecutar(
      async () => {
        const resultado = await guardarMisPreferencias(siguiente);

        setAvisos(resultado.data);
      },
      "Preferencias guardadas"
    );
  }

  async function darDeBaja(evento) {
    evento.preventDefault();

    const seguro = window.confirm(
      "Tu cuenta dejará de existir y no podrás volver a entrar. "
      + "Tu perfil y tu código QR dejarán de responder. ¿Continuar?"
    );

    if (!seguro) return;

    const correcto = await ejecutar(
      () => eliminarMiCuenta(paraBorrar),
      "Cuenta eliminada"
    );

    if (correcto) {
      await salir();
      navegar("/login", { replace: true, state: { aviso: "Tu cuenta fue eliminada." } });
    }
  }

  if (cargando) {
    return (
      <main className="configuracion">
        <p className="aviso">Cargando la configuración…</p>
      </main>
    );
  }

  return (
    <main className="configuracion">
      <div ref={mensaje}>
        {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}
        {aviso && <p className="mensaje mensaje--ok" role="status">{aviso}</p>}
      </div>

      <section className="panel">
        <h1 className="panel__titulo">Tu cuenta</h1>
        <p className="panel__sub">
          Con estos datos entras a la aplicación. No son los que ve el público:
          esos están en Mi negocio.
        </p>

        <form onSubmit={guardarDatos}>
          <CampoTexto
            id="nombre"
            etiqueta="Nombre"
            required
            minLength={2}
            maxLength={100}
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
          />

          <CampoTexto
            id="correo"
            etiqueta="Correo electrónico"
            type="email"
            required
            maxLength={100}
            autoComplete="username"
            value={datos.correo}
            onChange={(e) => setDatos({ ...datos, correo: e.target.value })}
          />

          {/* Solo cuando hace falta: pedir la contrasena para cambiar el
              nombre seria pedirla por nada */}
          {cambiaElCorreo && (
            <CampoTexto
              id="contrasenaDatos"
              etiqueta="Tu contraseña"
              type="password"
              required
              autoComplete="current-password"
              ayuda="Hace falta para cambiar el correo: es con el que entras y al que llega el enlace de recuperación."
              value={datos.contrasena}
              onChange={(e) => setDatos({ ...datos, contrasena: e.target.value })}
            />
          )}

          <button className="boton-principal" type="submit" disabled={ocupado}>
            {ocupado ? "Guardando…" : "Guardar datos"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel__titulo panel__titulo--chico">Contraseña</h2>
        <p className="panel__sub">
          Al cambiarla se cierran las sesiones que tengas abiertas en otros
          dispositivos. Esta se queda abierta.
        </p>

        <form onSubmit={cambiarClave}>
          <CampoTexto
            id="contrasenaActual"
            etiqueta="Contraseña actual"
            type="password"
            required
            autoComplete="current-password"
            value={claves.actual}
            onChange={(e) => setClaves({ ...claves, actual: e.target.value })}
          />

          <div className="rejilla">
            <CampoTexto
              id="contrasenaNueva"
              etiqueta="Contraseña nueva"
              type="password"
              required
              autoComplete="new-password"
              ayuda="Mínimo 8 caracteres, con mayúscula, número y símbolo."
              value={claves.nueva}
              onChange={(e) => setClaves({ ...claves, nueva: e.target.value })}
            />

            <CampoTexto
              id="contrasenaRepetida"
              etiqueta="Repítela"
              type="password"
              required
              autoComplete="new-password"
              value={claves.repetida}
              onChange={(e) => setClaves({ ...claves, repetida: e.target.value })}
            />
          </div>

          <button className="boton-principal" type="submit" disabled={ocupado}>
            {ocupado ? "Cambiando…" : "Cambiar contraseña"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel__titulo panel__titulo--chico">Avisos por correo</h2>

        <p className="panel__sub">
          Se guarda tu preferencia, pero <strong>todavía no se envía ningún
          correo</strong>: el sistema no tiene aún la tarea que los manda.
          Preferimos decirlo a prometer avisos que no llegan.
        </p>

        <ul className="avisos">
          {AVISOS.map((a) => (
            <li key={a.clave}>
              <label className="interruptor">
                <input
                  type="checkbox"
                  checked={avisos[a.clave]}
                  disabled={ocupado}
                  onChange={() => cambiarAviso(a.clave)}
                />
                <span>
                  <strong>{a.nombre}</strong>
                  <small>{a.ayuda}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {!avisos.guardadas && (
          <p className="avisos__nota">
            Todavía no has elegido: estos son los valores de fábrica.
          </p>
        )}
      </section>

      <section className="panel panel--peligro">
        <h2 className="panel__titulo panel__titulo--chico">Eliminar mi cuenta</h2>

        <p className="panel__sub">
          Tu cuenta dejará de existir y no podrás volver a entrar. Tu perfil y
          tu código QR dejarán de responder. <strong>Esto no se deshace desde
          la aplicación.</strong>
        </p>

        <form onSubmit={darDeBaja}>
          <CampoTexto
            id="contrasenaBaja"
            etiqueta="Escribe tu contraseña para confirmar"
            type="password"
            required
            autoComplete="current-password"
            value={paraBorrar}
            onChange={(e) => setParaBorrar(e.target.value)}
          />

          <button className="boton-peligro" type="submit" disabled={ocupado}>
            Eliminar mi cuenta
          </button>
        </form>
      </section>
    </main>
  );
}
