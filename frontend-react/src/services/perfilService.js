// ============================================
// PERFILSERVICE.JS — el perfil empresarial propio (RF-04 y RF-10)
//
// Tres rutas, todas sobre /me: el perfil es el de quien tiene la sesion. No
// hay forma de pedir el de otro, y por eso ninguna lleva identificador.
// ============================================

import { peticion } from "./apiClient";

/** El perfil del negocio de quien tiene la sesion abierta. */
export const consultarMiPerfil = () => peticion("/perfiles/me");

/**
 * Guarda el perfil completo.
 *
 * Es un PUT: lo que no se envie se borra. Por eso la pantalla manda siempre
 * todos los campos, incluidos los vacios, y no solo los que se tocaron.
 *
 * Lo unico obligatorio es el nombre del negocio (RF-10). Los demas campos
 * vacios se guardan como NULL: "sin telefono" y "telefono igual a nada" no
 * deberian ser dos cosas distintas en la base.
 */
export const guardarMiPerfil = (datos) =>
  peticion("/perfiles/me", { method: "PUT", body: JSON.stringify(datos) });

/**
 * Cambia solo el color de marca (RF-12).
 *
 * Tiene ruta propia para que elegir un color no obligue a reenviar el perfil
 * entero y arriesgarse a pisar algo.
 */
export const guardarMiTema = (tema) =>
  peticion("/perfiles/me/tema", { method: "PATCH", body: JSON.stringify({ tema }) });
