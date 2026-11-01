import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { registrar } from "../../services/cuentaService";
import { useAuth } from "../../context/AuthContext";
import CampoTexto from "../../components/Formulario/CampoTexto";
import useTitulo from "../../hooks/useTitulo";
import "./cuenta.css";

const VACIO = {
  nombre: "",
  correo: "",
  contrasena: "",
  nombreNegocio: "",
  categoria: ""
};

export default function RegistroPage() {
  useTitulo("Crear cuenta");

  const { usuario, cargando, entrar } = useAuth();

  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // La unica salida, igual que en LoginPage: en cuanto hay sesion se sale
  // por aqui. Antes habia tambien un navegar("/") despues de entrar(), que no
  // hacia nada -React desmonta esta pantalla al dibujar el <Navigate>, y
  // React Router ignora en silencio una navegacion desde un componente
  // desmontado-. Aqui las dos salidas llevaban al mismo sitio y no se notaba;
  // en LoginPage no, y ahi si era un defecto.
  if (!cargando && usuario) return <Navigate to="/" replace />;

  function cambio(evento) {
    const { name, value } = evento.target;

    setForm((previo) => ({ ...previo, [name]: value }));
  }

  async function enviar(evento) {
    evento.preventDefault();

    setError("");
    setEnviando(true);

    try {
      await registrar({
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        contrasena: form.contrasena,
        negocio: {
          nombreNegocio: form.nombreNegocio.trim(),
          categoria: form.categoria.trim() || undefined
        }
      });

      // El registro no devuelve token, asi que se entra a continuacion con
      // lo que se acaba de escribir. Pedirlo otra vez seria absurdo.
      await entrar(form.correo.trim(), form.contrasena);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="cuenta">
      <form className="cuenta__tarjeta" onSubmit={enviar}>
        <h1 className="cuenta__titulo">Crear una cuenta</h1>
        <p className="cuenta__sub">
          Para publicar el perfil de tu negocio y compartirlo con un código QR.
        </p>

        {error && <p className="cuenta__aviso" role="alert">{error}</p>}

        <CampoTexto
          id="nombre"
          etiqueta="Tu nombre o el de tu empresa"
          required
          minLength={2}
          value={form.nombre}
          onChange={cambio}
        />

        <CampoTexto
          id="correo"
          etiqueta="Correo electrónico"
          type="email"
          required
          autoComplete="username"
          value={form.correo}
          onChange={cambio}
        />

        <CampoTexto
          id="contrasena"
          etiqueta="Contraseña"
          type="password"
          required
          autoComplete="new-password"
          ayuda="Mínimo 8 caracteres, con mayúscula, número y símbolo."
          value={form.contrasena}
          onChange={cambio}
        />

        <p className="cuenta__seccion">Tu negocio · opcional</p>

        <CampoTexto
          id="nombreNegocio"
          etiqueta="Nombre del negocio"
          minLength={2}
          ayuda="Si lo llenas, se crea su perfil junto con la cuenta."
          value={form.nombreNegocio}
          onChange={cambio}
        />

        <CampoTexto
          id="categoria"
          etiqueta="Categoría"
          placeholder="Panadería, barbería, restaurante…"
          value={form.categoria}
          onChange={cambio}
        />

        <button className="cuenta__boton" type="submit" disabled={enviando}>
          {enviando ? "Creando…" : "Crear cuenta"}
        </button>

        <p className="cuenta__pie">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </main>
  );
}
