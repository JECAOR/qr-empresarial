import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

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
  const navegar = useNavigate();
  const ubicacion = useLocation();

  // Lo deja RestablecerPage al terminar, para no perder el hilo
  const avisoDeOtraPantalla = ubicacion.state?.aviso;

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Quien ya tiene sesion no tiene nada que hacer aqui
  if (!cargando && usuario) return <Navigate to={destino(usuario)} replace />;

  async function enviar(evento) {
    evento.preventDefault();

    setError("");
    setEnviando(true);

    try {
      const quien = await entrar(correo, contrasena);

      // Si llego aqui rebotado desde una pantalla privada, se le devuelve
      navegar(ubicacion.state?.desde ?? destino(quien), { replace: true });
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
