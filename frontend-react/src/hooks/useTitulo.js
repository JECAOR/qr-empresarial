import { useEffect } from "react";

const MARCA = "QR Empresarial";

/**
 * Pone el titulo de la pestana.
 *
 * Bajo React hay un solo index.html para las trece pantallas, asi que sin
 * esto todas comparten su <title> y la pestana dice lo mismo en el login que
 * en el panel. El frontend original no tenia el problema: alli cada pantalla
 * era un archivo con su propio titulo.
 *
 * Importa mas de lo que parece: el titulo es lo que se lee en una pestana
 * sin espacio, en el historial y en un marcador. Tambien es lo primero que
 * anuncia un lector de pantalla al cambiar de pagina.
 *
 * El separador es el mismo que usa el servidor al armar las etiquetas de
 * /p/:slug -ver publico.metadatos.js-, para que el titulo que ve un robot y
 * el que acaba poniendo el navegador no sean dos cosas distintas.
 *
 * @param {string} [titulo] - El nombre de la pantalla. Vacio o indefinido no
 *   toca nada, a proposito: la pantalla escaneada pasa el nombre del negocio
 *   en cuanto lo sabe, y hasta entonces hay que dejar en pie el titulo que
 *   el servidor ya escribio en el HTML para los robots que no ejecutan
 *   JavaScript. Ponerle "QR Empresarial" mientras carga lo borraria.
 */
export default function useTitulo(titulo) {
  useEffect(() => {
    if (!titulo) return;

    document.title = `${titulo} · ${MARCA}`;
  }, [titulo]);
}
