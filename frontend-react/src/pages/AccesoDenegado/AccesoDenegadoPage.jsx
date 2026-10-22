import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

export default function AccesoDenegadoPage() {
  const { usuario } = useAuth();

  return (
    <main className="aviso-pagina">
      <h1>Acceso denegado</h1>

      <p>
        Esta sección es solo para cuentas de administrador
        {usuario && <> y la tuya es de tipo <strong>{usuario.rol}</strong></>}.
      </p>

      <p>
        El servidor también lo impide: aunque llegaras a la pantalla, sus
        peticiones responderían <code>403</code>.
      </p>

      <Link to="/">Volver al perfil público</Link>
    </main>
  );
}
