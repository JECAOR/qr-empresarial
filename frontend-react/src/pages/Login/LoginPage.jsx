import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import "./LoginPage.css";

/**
 * A donde se manda a alguien despues de entrar.
 *
 * Solo un administrador tiene pantalla propia en esta aplicacion -la gestion
 * de usuarios-. Mandar a todo el mundo ahi hacia que una cuenta de empresa
 * entrara correctamente y aterrizara en "Acceso denegado", que parece un
 * error del sistema cuando en realidad entro bien.
 */
function destino(usuario) {
  return usuario?.rol === "administrador" ? "/usuarios" : "/";
}

export default function LoginPage() {
  const { usuario, cargando, entrar } = useAuth();
  const ubicacion = useLocation();

  // Lo deja RestablecerPage al terminar, para no perder el hilo
  const avisoDeOtraPantalla = ubicacion.state?.aviso;

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // La UNICA salida de esta pantalla, tanto para quien ya tenia sesion como
  // para quien acaba de entrar. Si llego rebotado desde una pantalla
  // privada, la guardia dejo escrito de donde: se le devuelve alli.
  //
  // REGRESION. Antes habia dos salidas: este <Navigate>, que llevaba
  // siempre a destino(usuario), y un navegar(state.desde) justo despues del
  // await de entrar(). Competian, y en el navegador ganaba el <Navigate>:
  // React agrupa el setUsuario de entrar() con lo que viene detras, dibuja
  // una sola vez, y al dibujar esta pantalla con sesion ya puesta devuelve
  // el <Navigate> y la desmonta. El navegar() de la linea siguiente llegaba
  // sobre un componente desmontado, y React Router lo ignora sin decir
  // nada: quien abria un enlace a /contenido sin sesion entraba y aterrizaba
  // en la portada.
  //
  // La prueba de Vitest no lo veia -con act() de por medio ganaba la otra
  // salida, asi que miraba a donde MANDABA navegar()- y el comentario que
  // tenia aqui afirmaba, sin haberlo medido, que en el navegador aterrizaba
  // bien. Lo encontro pruebas-e2e/entrar.spec.js.
  if (!cargando && usuario) {
    return <Navigate to={ubicacion.state?.desde ?? destino(usuario)} replace />;
  }

  async function enviar(evento) {
    evento.preventDefault();

    setError("");
    setEnviando(true);

    try {
      // No se navega aqui: en cuanto la sesion queda puesta, el <Navigate>
      // de arriba decide a donde ir. Una sola salida, sin carrera.
      await entrar(correo, contrasena);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <form className="login__tarjeta" onSubmit={enviar}>
        <h1 className="login__titulo">Iniciar sesión</h1>
        <p className="login__sub">Panel de gestión de QR Empresarial</p>

        <label className="login__etiqueta" htmlFor="correo">Correo electrónico</label>
        <input
          id="correo"
          className="login__campo"
          type="email"
          required
          autoComplete="username"
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
        />

        <label className="login__etiqueta" htmlFor="contrasena">Contraseña</label>
        <input
          id="contrasena"
          className="login__campo"
          type="password"
          required
          autoComplete="current-password"
          value={contrasena}
          onChange={(evento) => setContrasena(evento.target.value)}
        />

        {avisoDeOtraPantalla && !error && (
          <p className="login__aviso" role="status">{avisoDeOtraPantalla}</p>
        )}

        {error && <p className="login__error" role="alert">{error}</p>}

        <button className="login__boton" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>

        <p className="login__pie">
          <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
        </p>

        <p className="login__pie">
          ¿No tienes cuenta? <Link to="/registro">Crear una</Link>
        </p>
      </form>
    </main>
  );
}
