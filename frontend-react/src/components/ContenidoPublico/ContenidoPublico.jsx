import TarjetaContenido from "../TarjetaContenido/TarjetaContenido";
import { seccionesEnOrden } from "../../services/contenidoService";
import "./ContenidoPublico.css";

/**
 * El contenido publicado, separado por secciones (RF-05).
 *
 * REGRESION. La API devuelve el contenido agrupado -`porSeccion`- y las dos
 * pantallas publicas lo tiraban: recorrian `contenido`, que es la lista
 * plana, y pintaban los bloques uno detras de otro. El dueno reparte su
 * contenido en tres pestanas -Menu principal, Promociones, Reservaciones- y
 * quien visitaba la pagina no las veia separadas: una promocion y un dato de
 * contacto salian con el mismo aspecto, en la misma lista.
 *
 * Los nombres y el orden salen del mismo sitio que las pestanas del panel,
 * para que no haya dos vocabularios: ver SECCIONES en contenidoService.
 *
 * Las secciones vacias no se pintan. Y si no hay ninguna con contenido no se
 * devuelve nada: el aviso de «todavia no hay nada publicado» es de la
 * pantalla, que sabe como se dice en cada caso.
 */
export default function ContenidoPublico({ porSeccion }) {
  const secciones = seccionesEnOrden(porSeccion);

  if (secciones.length === 0) return null;

  return (
    <div className="publicado">
      {secciones.map((seccion) => (
        <section className="publicado__seccion" key={seccion.id}>
          <h2 className="publicado__titulo">{seccion.nombre}</h2>

          {seccion.bloques.map((bloque) => (
            <TarjetaContenido
              key={bloque.id}
              id={bloque.id}
              titulo={bloque.titulo}
              detalle={bloque.detalle}
              categoria={bloque.categoria}
              tipo={bloque.tipo}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
