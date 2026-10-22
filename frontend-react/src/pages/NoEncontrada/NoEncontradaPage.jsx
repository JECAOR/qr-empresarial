import { Link } from "react-router-dom";

/**
 * Una direccion que no existe.
 *
 * Antes el router mandaba cualquier ruta desconocida a la portada sin decir
 * nada, y quien escribia mal una direccion creia que habia llegado donde
 * queria.
 */
export default function NoEncontradaPage() {
  return (
    <main className="aviso-pagina">
      <h1>Esta página no existe</h1>

      <p>
        La dirección que escribiste no corresponde a ninguna pantalla. Puede
        que el enlace esté mal copiado.
      </p>

      <p>
        Si buscabas el perfil de un negocio, su dirección es del tipo{" "}
        <code>/p/nombre-del-negocio</code> y la sirve el servidor, no esta
        aplicación.
      </p>

      <Link to="/">Ir al inicio</Link>
    </main>
  );
}
