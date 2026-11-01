import { useEffect } from "react";

import { useAuth } from "../context/AuthContext";
import { consultarMiPerfil } from "../services/perfilService";
import { aplicarTema } from "../styles/tema";

/**
 * Aplica el color de marca del negocio de quien tiene la sesion (RF-12).
 *
 * Lo llama Layout, que es la barra comun a todas las pantallas del panel:
 * asi el color se aplica una sola vez por sesion y no en cada pantalla. El
 * frontend original lo pedia en cada carga de pagina porque cada pantalla
 * era un archivo nuevo; aqui la aplicacion no se recarga al navegar.
 *
 * Mientras llega la respuesta ya hay color: main.jsx aplica el que quedo
 * guardado de la ultima vez. Esto lo corrige si se cambio desde otro equipo.
 *
 * Se depende de idUsuario y no del objeto entero porque refrescar() -lo
 * llama Configuracion al cambiar el nombre- crea un objeto nuevo con los
 * mismos datos, y eso volveria a pedir el perfil sin motivo.
 */
export default function useTemaPropio() {
  const { usuario } = useAuth();
  const quien = usuario?.idUsuario;

  useEffect(() => {
    // Sin sesion no hay negocio del que tomar el color. Queda el de defecto,
    // o el del perfil publico que se este mirando.
    if (!quien) return undefined;

    let vigente = true;

    async function traerElTema() {
      try {
        const resultado = await consultarMiPerfil();

        if (vigente) aplicarTema(resultado.data?.tema);
      } catch (fallo) {
        // 404: la cuenta todavia no tiene perfil. Les pasa a las que creo el
        // administrador desde POST /api/usuarios. No es un error que haya
        // que ensenar: el color es lo de menos y la pantalla funciona igual.
        console.warn("No se pudo leer el color de marca:", fallo.message);
      }
    }

    traerElTema();

    return () => {
      vigente = false;
    };
  }, [quien]);
}
