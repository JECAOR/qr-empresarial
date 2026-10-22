// ============================================
// USUARIOSERVICE.JS — los siete endpoints del modulo de usuarios
//
// Todas estas rutas exigen el rol administrador, salvo las de "me". Quien no
// lo tenga recibe 403 del servidor, aunque la pantalla se lo deje pulsar:
// React decide que ensenar, Express decide que se puede hacer.
// ============================================

import { peticion } from "./apiClient";

export const listarUsuarios = () => peticion("/usuarios");

export const consultarUsuario = (id) => peticion(`/usuarios/${id}`);

export const crearUsuario = (datos) =>
  peticion("/usuarios", { method: "POST", body: JSON.stringify(datos) });

export const actualizarUsuario = (id, datos) =>
  peticion(`/usuarios/${id}`, { method: "PUT", body: JSON.stringify(datos) });

/**
 * Activa o restringe una cuenta (RN-23).
 *
 * La ruta es /estado y no /status, y el estado es una palabra -"activo" o
 * "restringido"-, no un 1 o un 0. El ejemplo de la guia compara con 1 y aqui
 * diria siempre "Inactivo".
 */
export const cambiarEstadoUsuario = (id, estado) =>
  peticion(`/usuarios/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado })
  });

/** Eliminacion logica: la cuenta deja de aparecer, sus datos se conservan. */
export const eliminarUsuario = (id) =>
  peticion(`/usuarios/${id}`, { method: "DELETE" });
