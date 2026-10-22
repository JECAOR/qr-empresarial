import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { consultarMiPerfil, guardarMiPerfil, guardarMiTema } from "../../services/perfilService";
import CampoTexto from "../../components/Formulario/CampoTexto";
import SelectorTema from "../../components/perfil/SelectorTema/SelectorTema";
import "./PerfilPage.css";

// Los limites son los del validador del backend. Se repiten aqui para que el
// navegador avise antes de gastar una peticion, no para sustituirlo: quien
// mande el formulario por otra via se encuentra con la misma regla.
const LIMITES = {
  nombreNegocio: 150,
  categoria: 80,
  descripcion: 2000,
  direccion: 200,
  telefono: 30,
  correoContacto: 100,
  instagram: 60,
  horario: 120,
  imagen: 255
};

const VACIO = Object.fromEntries(Object.keys(LIMITES).map((campo) => [campo, ""]));

/** Pasa el perfil de la API al formulario: null se escribe como vacio. */
function aFormulario(perfil) {
  const form = { ...VACIO };

  for (const campo of Object.keys(LIMITES)) form[campo] = perfil?.[campo] ?? "";

  return form;
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState(VACIO);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  // El mensaje sale arriba del panel y el boton de guardar esta abajo del
  // todo: sin esto se pulsa Guardar, el formulario responde, y no se ve
  // nada. Parece que la pantalla se quedo colgada.
  const mensaje = useRef(null);

  useEffect(() => {
    if (error || aviso) {
      mensaje.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error, aviso]);

  useEffect(() => {
    let vigente = true;

    consultarMiPerfil()
      .then((resultado) => {
        if (!vigente) return;

        setPerfil(resultado.data);
        setForm(aFormulario(resultado.data));
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

  function cambio(evento) {
    const { name, value } = evento.target;

    setForm((previo) => ({ ...previo, [name]: value }));
  }

  async function guardar(evento) {
    evento.preventDefault();

    setError("");
    setAviso("");
    setGuardando(true);

    try {
      // Se envian todos los campos, tambien los vacios: PUT reemplaza el
      // perfil entero, de modo que omitir uno lo borraria.
      const resultado = await guardarMiPerfil(form);

      setPerfil(resultado.data);
      setForm(aFormulario(resultado.data));
      setAviso("Perfil guardado");
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  async function elegirTema(tema) {
    if (tema === perfil?.tema) return;

    setError("");
    setAviso("");
    setGuardandoTema(true);

    try {
      const resultado = await guardarMiTema(tema);

      setPerfil(resultado.data);
      setAviso("Color de marca actualizado");
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardandoTema(false);
    }
  }

  if (cargando) {
    return (
      <main className="perfil-edicion">
        <p className="aviso">Cargando el perfil…</p>
      </main>
    );
  }

  return (
    <main className="perfil-edicion">
      <section className="panel">
        <header className="panel__cabecera">
          <div>
            <h1 className="panel__titulo">Perfil del negocio</h1>
            <p className="panel__sub">Lo que ve quien escanea tu código QR.</p>
          </div>

          {perfil?.slug && (
            <Link className="panel__ver" to={`/?slug=${perfil.slug}`}>
              Ver la página pública
            </Link>
          )}
        </header>

        <div ref={mensaje}>
          {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}
          {aviso && <p className="mensaje mensaje--ok" role="status">{aviso}</p>}
        </div>

        <form onSubmit={guardar}>
          <CampoTexto
            id="nombreNegocio"
            etiqueta="Nombre del negocio *"
            required
            minLength={2}
            maxLength={LIMITES.nombreNegocio}
            value={form.nombreNegocio}
            onChange={cambio}
          />

          <div className="rejilla">
            <CampoTexto
              id="categoria"
              etiqueta="Categoría"
              maxLength={LIMITES.categoria}
              placeholder="Panadería, barbería…"
              value={form.categoria}
              onChange={cambio}
            />

            <CampoTexto
              id="horario"
              etiqueta="Horario"
              maxLength={LIMITES.horario}
              placeholder="Lun-Sáb 7:00-20:00"
              value={form.horario}
              onChange={cambio}
            />
          </div>

          <div className="campo">
            <label className="campo__etiqueta" htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              name="descripcion"
              className="campo__input campo__area"
              rows={3}
              maxLength={LIMITES.descripcion}
              value={form.descripcion}
              onChange={cambio}
            />
            <small className="campo__ayuda">
              {form.descripcion.length} de {LIMITES.descripcion} caracteres
            </small>
          </div>

          <CampoTexto
            id="direccion"
            etiqueta="Dirección"
            maxLength={LIMITES.direccion}
            value={form.direccion}
            onChange={cambio}
          />

          <div className="rejilla">
            <CampoTexto
              id="telefono"
              etiqueta="Teléfono"
              maxLength={LIMITES.telefono}
              value={form.telefono}
              onChange={cambio}
            />

            <CampoTexto
              id="correoContacto"
              etiqueta="Correo de contacto"
              type="email"
              maxLength={LIMITES.correoContacto}
              ayuda="El que ve el público, no con el que entras."
              value={form.correoContacto}
              onChange={cambio}
            />
          </div>

          <div className="rejilla">
            <CampoTexto
              id="instagram"
              etiqueta="Instagram"
              maxLength={LIMITES.instagram}
              placeholder="@tunegocio"
              ayuda="Letras, números, puntos y guiones bajos."
              value={form.instagram}
              onChange={cambio}
            />

            <CampoTexto
              id="imagen"
              etiqueta="Imagen"
              type="url"
              maxLength={LIMITES.imagen}
              placeholder="https://…"
              ayuda="Solo http y https."
              value={form.imagen}
              onChange={cambio}
            />
          </div>

          <button className="boton-principal" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar perfil"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel__titulo panel__titulo--chico">Color de marca</h2>
        <p className="panel__sub">
          Se aplica a tu página pública. Se guarda al elegirlo.
        </p>

        <SelectorTema
          valor={perfil?.tema}
          onElegir={elegirTema}
          guardando={guardandoTema}
        />
      </section>

      <section className="panel">
        <h2 className="panel__titulo panel__titulo--chico">Tu dirección pública</h2>

        <p className="direccion">{perfil?.urlPublica}</p>

        <p className="panel__sub">
          No cambia aunque renombres el negocio. Si cambiara, los códigos QR que
          ya hubieras impreso dejarían de funcionar.
        </p>
      </section>
    </main>
  );
}
