import { createContext, useContext, useEffect, useState } from "react";

import { iniciarSesion, cerrarSesion, consultarMiPerfil } from "../services/authService";
import { CLAVE_TOKEN } from "../services/apiClient";

const ContextoAuth = createContext(null);

/**
 * Da forma al perfil venga de donde venga.
 *
 * El inicio de sesion responde {data: {usuario}} y GET /usuarios/me responde
 * {data} a secas, con un campo mas: `estado`. La guia avisa de esto y tiene
 * razon: dar por hecho que los dos JSON son iguales es de los errores que
 * mas cuesta encontrar luego.
 */
function normalizarPerfil(resultado) {
  const crudo = resultado?.data?.usuario ?? resultado?.data;

  if (!crudo) throw new Error("No se pudo leer el perfil");

  if (typeof crudo.rol !== "string") {
    throw new Error("El perfil llegó sin rol: revise GET /usuarios/me");
  }

  return crudo;
}

export function ProveedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null);

  // Arranca en true: mientras no se sepa si hay sesion, no se puede decidir
  // si echar a alguien al login. Sin esto, al recargar una pantalla privada
  // se ve un parpadeo hacia /login antes de volver.
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;

    async function restaurar() {
      if (!sessionStorage.getItem(CLAVE_TOKEN)) {
        setCargando(false);
        return;
      }

      try {
        // No se confia en el usuario guardado en el navegador: se le pregunta
        // al servidor. Asi se detecta un token caducado o revocado, y de paso
        // llegan los datos de ahora y no los de cuando se entro.
        const resultado = await consultarMiPerfil();

        if (vigente) setUsuario(normalizarPerfil(resultado));
      } catch {
        await cerrarSesion();
        if (vigente) setUsuario(null);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    restaurar();

    return () => {
      vigente = false;
    };
  }, []);

  async function entrar(correo, contrasena) {
    const nuevo = await iniciarSesion(correo, contrasena);

    setUsuario(nuevo);

    // Se devuelve ademas de guardarlo: quien llama necesita el rol ya mismo
    // para decidir a que pantalla ir, y el estado todavia no se ha aplicado.
    return nuevo;
  }

  async function salir() {
    await cerrarSesion();
    setUsuario(null);
  }

  return (
    <ContextoAuth.Provider value={{ usuario, cargando, entrar, salir }}>
      {children}
    </ContextoAuth.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(ContextoAuth);

  if (!contexto) throw new Error("useAuth se usó fuera de ProveedorAuth");

  return contexto;
}
