import { useState } from "react";
import { Link } from "react-router-dom";

import { pedirEnlaceDeRecuperacion } from "../../services/cuentaService";
import CampoTexto from "../../components/Formulario/CampoTexto";
import "./cuenta.css";

/**
 * El token que lleva dentro el enlace de desarrollo.
 *
 * El backend arma el enlace con APP_URL y apunta a /restablecer.html, la
 * pantalla del frontend original. No es un error: ese es el frontend que esta
 * desplegado. Para seguir la prueba sin salir de React se saca el token y se
 * arma la direccion de esta aplicacion.
 */
function tokenDe(enlace) {
  try {
    return new URL(enlace).searchParams.get("token");
  } catch {
    return null;
  }
}

export default function RecuperarPage() {
  const [correo, setCorreo] = useState("");
  const [respuesta, setRespuesta] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();

    setError("");
    setEnviando(true);

    try {
      setRespuesta(await pedirEnlaceDeRecuperacion(correo.trim()));
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  // Ya se pidió: no se vuelve a enseñar el formulario, para no invitar a
  // repetirlo. El servidor además limita cuántas veces seguidas se puede.
  if (respuesta) {
    return (
      <main className="cuenta">
        <div className="cuenta__tarjeta">
          <h1 className="cuenta__titulo">Revisa tu correo</h1>

          <p className="cuenta__aviso cuenta__aviso--ok" role="status">
            {respuesta.message}
          </p>

          <p className="cuenta__sub">
            El enlace vence en 30 minutos y solo sirve una vez. Si no llega,
            revisa la carpeta de correo no deseado.
          </p>

          {/* El servidor solo manda este enlace fuera de produccion, para
              poder seguir la prueba sin un buzon de correo. Si no viene, no
              se dibuja nada: la pantalla no tiene que saber en que entorno
              esta. */}
          {respuesta.enlaceDesarrollo && (
            <>
              <p className="cuenta__seccion">Enlace de desarrollo</p>

              <span className="cuenta__enlace-dev">{respuesta.enlaceDesarrollo}</span>

              {tokenDe(respuesta.enlaceDesarrollo) && (
                <p className="cuenta__sub" style={{ marginTop: 12 }}>
                  Ese enlace lleva a la pantalla que sirve Express, que es el
                  frontend desplegado.{" "}
                  <Link to={`/restablecer?token=${tokenDe(respuesta.enlaceDesarrollo)}`}>
                    Continuar aquí
                  </Link>{" "}
                  para seguir en esta aplicación.
                </p>
              )}
            </>
          )}

          <p className="cuenta__pie">
            <Link to="/login">Volver a iniciar sesión</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="cuenta">
      <form className="cuenta__tarjeta" onSubmit={enviar}>
        <h1 className="cuenta__titulo">Recuperar la contraseña</h1>
        <p className="cuenta__sub">
          Escribe el correo con el que te registraste y te enviamos un enlace
          para ponerte una nueva.
        </p>

        {error && <p className="cuenta__aviso" role="alert">{error}</p>}

        <CampoTexto
          id="correo"
          etiqueta="Correo electrónico"
          type="email"
          required
          autoComplete="username"
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
        />

        <button className="cuenta__boton" type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar el enlace"}
        </button>

        <p className="cuenta__pie">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </form>
    </main>
  );
}
