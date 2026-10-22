import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { comprobarEnlace, restablecerContrasena } from "../../services/cuentaService";
import CampoTexto from "../../components/Formulario/CampoTexto";
import "./cuenta.css";

export default function RestablecerPage() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();

  const token = parametros.get("token") ?? "";

  const [comprobando, setComprobando] = useState(true);
  const [sirve, setSirve] = useState(false);
  const [motivo, setMotivo] = useState("");

  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Se comprueba el enlace ANTES de ensenar el formulario. Pedir una
  // contrasena nueva para despues decir que el enlace caduco es la peor
  // manera de contarlo.
  useEffect(() => {
    let vigente = true;

    async function comprobar() {
      if (!token) {
        if (vigente) {
          setMotivo("La dirección no trae ningún enlace de recuperación.");
          setComprobando(false);
        }

        return;
      }

      try {
        await comprobarEnlace(token);
        if (vigente) setSirve(true);
      } catch (fallo) {
        if (vigente) setMotivo(fallo.message);
      } finally {
        if (vigente) setComprobando(false);
      }
    }

    comprobar();

    return () => {
      vigente = false;
    };
  }, [token]);

  async function enviar(evento) {
    evento.preventDefault();

    // Se comprueba aqui y no en el servidor: la API recibe una sola
    // contrasena, la repeticion es cosa de esta pantalla.
    if (contrasena !== repetida) {
      setError("Las dos contraseñas no coinciden");

      return;
    }

    setError("");
    setEnviando(true);

    try {
      await restablecerContrasena(token, contrasena);

      navegar("/login", {
        replace: true,
        state: { aviso: "Tu contraseña quedó cambiada. Ya puedes entrar." }
      });
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  if (comprobando) {
    return (
      <main className="cuenta">
        <div className="cuenta__tarjeta">
          <p className="cuenta__sub">Comprobando el enlace…</p>
        </div>
      </main>
    );
  }

  if (!sirve) {
    return (
      <main className="cuenta">
        <div className="cuenta__tarjeta">
          <h1 className="cuenta__titulo">Este enlace ya no sirve</h1>

          <p className="cuenta__aviso" role="alert">{motivo}</p>

          <p className="cuenta__sub">
            Los enlaces vencen a los 30 minutos y solo se pueden usar una vez.
            Pide uno nuevo y úsalo enseguida.
          </p>

          <p className="cuenta__pie">
            <Link to="/recuperar">Pedir otro enlace</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="cuenta">
      <form className="cuenta__tarjeta" onSubmit={enviar}>
        <h1 className="cuenta__titulo">Nueva contraseña</h1>
        <p className="cuenta__sub">
          El enlace es válido. Al guardar, se cerrarán las sesiones que tengas
          abiertas en otros dispositivos.
        </p>

        {error && <p className="cuenta__aviso" role="alert">{error}</p>}

        <CampoTexto
          id="contrasena"
          etiqueta="Contraseña nueva"
          type="password"
          required
          autoComplete="new-password"
          ayuda="Mínimo 8 caracteres, con mayúscula, número y símbolo."
          value={contrasena}
          onChange={(evento) => setContrasena(evento.target.value)}
        />

        <CampoTexto
          id="repetida"
          etiqueta="Repítela"
          type="password"
          required
          autoComplete="new-password"
          value={repetida}
          onChange={(evento) => setRepetida(evento.target.value)}
        />

        <button className="cuenta__boton" type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar la contraseña"}
        </button>
      </form>
    </main>
  );
}
