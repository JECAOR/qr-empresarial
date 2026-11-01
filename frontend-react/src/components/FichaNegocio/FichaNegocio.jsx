import { useState } from "react";

import "./FichaNegocio.css";

/**
 * El enlace de WhatsApp, o nada si el numero no da para armarlo.
 *
 * wa.me necesita el numero internacional completo. Si el negocio escribio su
 * telefono con indicativo -"+57 301 222 3344"- se usa tal cual; si escribio
 * un movil colombiano sin indicativo -"3012223344"- se le pone el 57.
 *
 * Con cualquier otra cosa -un fijo de siete digitos, una extension- se
 * devuelve null y no se ofrece el enlace. Es a proposito: un wa.me armado a
 * medias no lleva a un numero equivocado en el peor de los casos, lleva a
 * una conversacion con un desconocido, y eso es peor que no ofrecerlo.
 */
function enlaceDeWhatsapp(telefono) {
  const digitos = telefono.replace(/[^\d]/g, "");

  if (telefono.trim().startsWith("+") && digitos.length >= 10) {
    return `https://wa.me/${digitos}`;
  }

  // Movil colombiano: diez digitos que empiezan por 3
  if (/^3\d{9}$/.test(digitos)) return `https://wa.me/57${digitos}`;

  return null;
}

/**
 * El perfil de Instagram.
 *
 * El validador del backend acepta el usuario con o sin arroba y solo deja
 * letras, numeros, puntos y guiones bajos, asi que lo unico que hay que
 * hacer es quitar la arroba para componer la direccion.
 */
const enlaceDeInstagram = (usuario) =>
  `https://instagram.com/${encodeURIComponent(usuario.replace("@", ""))}`;

const enlaceDelMapa = (direccion) =>
  `https://maps.google.com/?q=${encodeURIComponent(direccion)}`;

/**
 * El logo del negocio.
 *
 * Va en su propio componente para que la bandera de «no se pudo cargar» se
 * reinicie sola al cambiar de negocio: en la portada se puede consultar otro
 * sin recargar, y con la bandera en FichaNegocio el logo del segundo se
 * quedaria oculto por el fallo del primero. Se monta con key={imagen}.
 *
 * El alt va vacio a proposito: el nombre del negocio esta escrito al lado, y
 * repetirlo aqui haria que un lector de pantalla lo dijera dos veces.
 */
function Logo({ src }) {
  const [roto, setRoto] = useState(false);

  if (roto) return null;

  return (
    <img className="ficha__logo" src={src} alt="" onError={() => setRoto(true)} />
  );
}

/**
 * Los datos del negocio: quien es y como contactarlo.
 *
 * Cada dato se dibuja solo si el negocio lo lleno. Sin esa condicion
 * aparecerian etiquetas vacias -"Teléfono:" sin numero-, que es peor que no
 * mostrar nada.
 *
 * REGRESION. Esta ficha enseñaba seis de los once campos que devuelve la API
 * publica: se quedaban fuera el logo, el Instagram y el correo de contacto,
 * los tres rellenables desde la pantalla del perfil. El dueño los guardaba y
 * el visitante no los veia nunca, que es el mismo defecto que tuvo el color
 * de marca.
 *
 * Y lo que si se enseñaba era texto plano. El frontend original convertia
 * estos datos en seis botones -llamar, WhatsApp, como llegar, Instagram,
 * escribir y el menu-, y aqui no se podia pulsar ninguno. Esto se lee casi
 * siempre en un telefono, recien escaneado el codigo: la diferencia entre
 * tocar para llamar y copiar el numero a mano no es cosmetica.
 */
function FichaNegocio({ perfil }) {
  const whatsapp = perfil.telefono ? enlaceDeWhatsapp(perfil.telefono) : null;

  return (
    <section className="ficha">
      <div className="ficha__cabecera">
        {perfil.imagen && <Logo key={perfil.imagen} src={perfil.imagen} />}

        <div className="ficha__quien">
          <h2 className="ficha__nombre">{perfil.nombreNegocio}</h2>
          {perfil.categoria && <p className="ficha__categoria">{perfil.categoria}</p>}
        </div>
      </div>

      {perfil.descripcion && <p className="ficha__descripcion">{perfil.descripcion}</p>}

      <dl className="ficha__datos">
        {perfil.direccion && (
          <div>
            <dt>Dirección</dt>
            <dd>
              <a
                className="ficha__accion"
                href={enlaceDelMapa(perfil.direccion)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {perfil.direccion}
              </a>
            </dd>
          </div>
        )}

        {perfil.telefono && (
          <div>
            <dt>Teléfono</dt>
            <dd>
              {/* tel: no abre una pestaña: lo atiende el propio teléfono */}
              <a className="ficha__accion" href={`tel:${perfil.telefono.replace(/\s/g, "")}`}>
                {perfil.telefono}
              </a>

              {whatsapp && (
                <>
                  {" · "}
                  <a
                    className="ficha__accion"
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    WhatsApp
                  </a>
                </>
              )}
            </dd>
          </div>
        )}

        {perfil.horario && (
          <div>
            <dt>Horario</dt>
            <dd>{perfil.horario}</dd>
          </div>
        )}

        {perfil.instagram && (
          <div>
            <dt>Instagram</dt>
            <dd>
              <a
                className="ficha__accion"
                href={enlaceDeInstagram(perfil.instagram)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {perfil.instagram}
              </a>
            </dd>
          </div>
        )}

        {perfil.correoContacto && (
          <div>
            <dt>Correo</dt>
            <dd>
              <a className="ficha__accion" href={`mailto:${perfil.correoContacto}`}>
                {perfil.correoContacto}
              </a>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export default FichaNegocio;
