import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { obtenerPerfilPublico, informarEvento } from "../../services/perfilPublicoService";
import FichaNegocio from "../../components/FichaNegocio/FichaNegocio";
import ContenidoPublico from "../../components/ContenidoPublico/ContenidoPublico";
import useTitulo from "../../hooks/useTitulo";
import { aplicarTema, temaGuardado } from "../../styles/tema";
import "../PerfilPublico/PerfilPublicoPage.css";
import "./PaginaEscaneadaPage.css";

/**
 * LA PAGINA QUE LLEVA EL CODIGO QR — /p/:slug (RF-09 y RF-11)
 *
 * Es lo que ve quien escanea. Se parece a la portada, pero no es la misma
 * pantalla y no debe serlo:
 *
 *   - El slug viene en la direccion, no en una caja de texto. Quien escanea
 *     no busca un negocio: ya llego al suyo, y ofrecerle un buscador seria
 *     invitarle a irse a otro sitio.
 *   - Aqui SI se informan los eventos. El panel del dueno no lo hace, porque
 *     inflaria sus propias estadisticas cada vez que abriera su perfil.
 *
 * Las etiquetas de vista previa -las que leen WhatsApp o Telegram al pegar el
 * enlace- no se arman aqui: las inyecta Express en el HTML antes de
 * entregarlo, porque esos robots no ejecutan JavaScript.
 */
export default function PaginaEscaneadaPage() {
  const { slug } = useParams();
  const [parametros] = useSearchParams();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // La imagen del QR lleva ?qr=1; el enlace que se comparte por WhatsApp o se
  // copia a mano, no. Son las dos primeras medidas que pide el RF-11.
  const tipo = parametros.get("qr") === "1" ? "escaneo" : "visita";

  useEffect(() => {
    let vigente = true;

    // El dato viene de la red: no se puede derivar durante el dibujado, y al
    // cambiar de negocio hay que volver a decir que se esta cargando.
    // eslint-disable-next-line react/set-state-in-effect
    setCargando(true);
    setError("");

    obtenerPerfilPublico(slug)
      .then((resultado) => {
        if (!vigente) return;

        setDatos(resultado);

        // Solo si el perfil existe: contar la visita a una direccion
        // inventada ensuciaria las estadisticas de nadie.
        //
        // No hace falta una guarda contra el doble conteo de StrictMode: la
        // bandera `vigente` de arriba ya descarta el primero de los dos
        // pases. Una guarda en una ref, ademas, dejaria sin contar la visita
        // al ir de un negocio a otro dentro de la aplicacion, porque React
        // Router reutiliza este componente al cambiar solo el slug.
        informarEvento(slug, { tipo });
      })
      .catch((fallo) => {
        if (vigente) {
          setError(fallo.message);
          setDatos(null);
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [slug, tipo]);

  // El titulo de la pestana es el nombre del negocio, el mismo que el
  // servidor ya escribio en el HTML para los robots. Mientras no se sabe,
  // useTitulo no toca nada y ese titulo sigue en pie.
  useTitulo(datos?.perfil?.nombreNegocio);

  // --- El color de marca del negocio (RF-12) ---
  //
  // Es el sentido del requisito: quien escanea el codigo ve los colores que
  // eligio el negocio, no los de la aplicacion.
  //
  // No se recuerda. Esta pantalla es la de OTRO negocio, y guardar su color
  // pintaria con el el panel propio la proxima vez que se abriera la
  // aplicacion en este navegador. Al salir se repone el que hubiera
  // guardado -el del negocio propio, si hay sesion-, para que volver al
  // panel no deje un instante con los colores de otro.
  const temaDelNegocio = datos?.perfil?.tema;

  useEffect(() => {
    if (!temaDelNegocio) return undefined;

    aplicarTema(temaDelNegocio, { recordar: false });

    return () => aplicarTema(temaGuardado(), { recordar: false });
  }, [temaDelNegocio]);

  /**
   * Cuenta los clics en los enlaces (RF-11).
   *
   * Por delegacion sobre el contenedor y no con un onClick por tarjeta: los
   * bloques se dibujan cuando llega la respuesta, y asi TarjetaContenido no
   * tiene que saber que existen las estadisticas.
   *
   * No se impide la navegacion: el evento se manda con sendBeacon, que el
   * navegador entrega aunque la pagina ya se este yendo.
   */
  function contarClic(evento) {
    const enlace = evento.target.closest("a[data-bloque]");

    if (!enlace) return;

    const idEnlace = Number(String(enlace.dataset.bloque).split("-")[1]);

    if (!Number.isInteger(idEnlace)) return;

    informarEvento(slug, { tipo: "clic", idEnlace });
  }

  if (cargando) {
    return (
      <main className="escaneada">
        <p className="perfil__aviso">Cargando perfil…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="escaneada">
        <p className="perfil__aviso perfil__aviso--error" role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main className="escaneada">
      <FichaNegocio perfil={datos.perfil} />

      {datos.contenido.length === 0 ? (
        <p className="perfil__aviso">
          Este perfil todavía no tiene contenido publicado.
        </p>
      ) : (
        <>
          {/* El onClick va en el contenedor, no en cada tarjeta: ver contarClic */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div className="escaneada__bloques" onClick={contarClic}>
            <ContenidoPublico porSeccion={datos.porSeccion} />
          </div>
        </>
      )}
    </main>
  );
}
