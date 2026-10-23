import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  consultarMiQr,
  generarMiQr,
  cambiarEstadoQr,
  descargarImagen
} from "../../services/qrService";
import { origenDelBackend } from "../../services/apiClient";
import "./CodigoQrPage.css";

const COLORES = [
  { valor: "#111827", nombre: "Negro" },
  { valor: "#4F46E5", nombre: "Índigo" },
  { valor: "#0B7D73", nombre: "Esmeralda" },
  { valor: "#C2410C", nombre: "Terracota" }
];

const FORMATOS = [
  { valor: "png", nombre: "PNG", ayuda: "Para redes y pantallas" },
  { valor: "svg", nombre: "SVG", ayuda: "Para imprimir a cualquier tamaño" },
  { valor: "pdf", nombre: "PDF", ayuda: "Para llevar a la imprenta" }
];

export default function CodigoQrPage() {
  const [qr, setQr] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);

  const [color, setColor] = useState(COLORES[0].valor);
  const [tamano, setTamano] = useState(400);

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

  // --- El codigo ---
  const cargar = useCallback(async () => {
    try {
      setQr((await consultarMiQr()).data);
    } catch (fallo) {
      // 404 no es un fallo: es un perfil que todavia no ha generado el suyo
      if (fallo.status !== 404) throw fallo;

      setQr(null);
    }
  }, []);

  useEffect(() => {
    let vigente = true;

    cargar()
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

  // --- La vista previa ---
  //
  // Se pide al servidor en lugar de dibujarla aqui: asi lo que se ve en
  // pantalla es exactamente el archivo que se va a descargar, sin un segundo
  // generador que pueda discrepar. El precio es una peticion por cambio, y
  // por eso se espera a que el color y el tamano dejen de moverse.
  useEffect(() => {
    if (!qr) return undefined;

    let vigente = true;
    let urlDelObjeto = null;

    const temporizador = setTimeout(async () => {
      try {
        const { blob } = await descargarImagen({ formato: "svg", tamano, color });

        if (!vigente) return;

        urlDelObjeto = URL.createObjectURL(blob);
        setVistaPrevia(urlDelObjeto);
      } catch {
        // La vista previa no es critica: si falla, se queda la anterior
      }
    }, 250);

    return () => {
      vigente = false;
      clearTimeout(temporizador);

      // Sin esto el navegador se queda con una copia de cada imagen que se
      // genero mientras se movia el deslizador
      if (urlDelObjeto) URL.revokeObjectURL(urlDelObjeto);
    };
  }, [qr, color, tamano]);

  async function ejecutar(accion, mensajeExito) {
    setOcupado(true);
    setError("");
    setAviso("");

    try {
      await accion();
      await cargar();
      setAviso(mensajeExito);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function generar() {
    await ejecutar(generarMiQr, "Código generado");
  }

  async function cambiarVisibilidad() {
    const publicar = !qr.activo;

    const pregunta = publicar
      ? "Tu página volverá a responder y los códigos que ya repartiste funcionarán otra vez. ¿Continuar?"
      : "Los códigos que ya repartiste o imprimiste dejarán de llevar a ninguna parte. "
        + "El código no se borra: puedes volver a publicarlo cuando quieras. ¿Continuar?";

    if (!window.confirm(pregunta)) return;

    await ejecutar(
      () => cambiarEstadoQr(publicar),
      publicar ? "Tu página está publicada" : "Tu página quedó retirada"
    );
  }

  async function bajar(formato) {
    setError("");
    setAviso("");

    try {
      const { blob, nombre } = await descargarImagen({ formato, tamano, color });

      const enlace = document.createElement("a");

      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombre;
      enlace.click();

      URL.revokeObjectURL(enlace.href);
      setAviso(`Descargado ${nombre}`);
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(direccion);
      setAviso("Enlace copiado");
    } catch {
      setError("El navegador no dejó copiar el enlace");
    }
  }

  if (cargando) {
    return (
      <main className="qr">
        <p className="aviso">Cargando el código…</p>
      </main>
    );
  }

  // La API devuelve la ruta relativa; quien escanea necesita el enlace entero
  const direccion = qr ? `${origenDelBackend()}${qr.url}` : "";

  return (
    <main className="qr">
      <section className="panel">
        <h1 className="panel__titulo">Tu código QR</h1>
        <p className="panel__sub">
          Siempre lleva a la misma dirección. Puedes cambiar tu perfil cuantas
          veces quieras sin volver a imprimirlo.
        </p>

        <div ref={mensaje}>
          {error && <p className="mensaje mensaje--error" role="alert">{error}</p>}
          {aviso && <p className="mensaje mensaje--ok" role="status">{aviso}</p>}
        </div>

        {!qr ? (
          <div className="sin-codigo">
            <p>
              Todavía no has generado tu código. Se crea una sola vez y no
              cambia de dirección.
            </p>

            <button
              type="button"
              className="boton-principal"
              onClick={generar}
              disabled={ocupado}
            >
              {ocupado ? "Generando…" : "Generar mi código"}
            </button>

            <p className="sin-codigo__nota">
              Hace falta al menos un bloque de contenido activo. Si no lo tienes,
              agrégalo en <Link to="/contenido">Contenido</Link>.
            </p>
          </div>
        ) : (
          <div className="qr__cuerpo">
            <figure className="qr__lienzo">
              {vistaPrevia
                ? <img src={vistaPrevia} alt="Vista previa del código QR" width={240} height={240} />
                : <span className="qr__cargando">Dibujando…</span>}

              <figcaption>{tamano} × {tamano} px</figcaption>
            </figure>

            <div className="qr__opciones">
              <p className="qr__etiqueta">Dirección</p>
              <p className="qr__direccion">{direccion}</p>

              <div className="qr__acciones">
                <button type="button" onClick={copiarEnlace}>Copiar enlace</button>
                <a href={direccion} target="_blank" rel="noreferrer noopener">Abrirla</a>
              </div>

              <p className="qr__etiqueta">Color</p>
              <div className="qr__colores">
                {COLORES.map((c) => (
                  <button
                    key={c.valor}
                    type="button"
                    className={c.valor === color ? "color color--elegido" : "color"}
                    style={{ background: c.valor }}
                    onClick={() => setColor(c.valor)}
                    aria-label={c.nombre}
                    aria-pressed={c.valor === color}
                  />
                ))}
              </div>

              <label className="qr__etiqueta" htmlFor="tamano">Tamaño</label>
              <input
                id="tamano"
                type="range"
                min={120}
                max={1200}
                step={20}
                value={tamano}
                onChange={(evento) => setTamano(Number(evento.target.value))}
              />

              <p className="qr__etiqueta">Descargar</p>
              <div className="qr__formatos">
                {FORMATOS.map((f) => (
                  <button key={f.valor} type="button" onClick={() => bajar(f.valor)}>
                    <strong>{f.nombre}</strong>
                    <span>{f.ayuda}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {qr && (
        <section className="panel">
          <div className="visibilidad">
            <div>
              <h2 className="panel__titulo panel__titulo--chico">
                Visibilidad
                <span className={qr.activo ? "pastilla pastilla--activa" : "pastilla"}>
                  {qr.activo ? "● Publicada" : "● Retirada"}
                </span>
              </h2>

              <p className="panel__sub">
                {qr.activo
                  ? "Tu página responde a quien escanee el código."
                  : "Tu página no responde. Quien escanee el código no encontrará nada hasta que la publiques de nuevo."}
              </p>
            </div>

            <button type="button" onClick={cambiarVisibilidad} disabled={ocupado}>
              {qr.activo ? "Retirar mi página" : "Publicar mi página"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
