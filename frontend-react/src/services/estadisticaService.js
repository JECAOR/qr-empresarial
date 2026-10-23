// ============================================
// ESTADISTICASERVICE.JS — la actividad del perfil (RF-11)
// ============================================

import { peticion } from "./apiClient";

// Los unicos que acepta el servidor. Cualquier otro valor lo ignora y
// devuelve 7, de modo que una pantalla que pidiera 14 enseñaria 7 dias
// diciendo que son 14.
export const RANGOS = [7, 30, 90];

/**
 * Escaneos, visitas y clics del perfil.
 *
 * Devuelve los totales, la serie dia a dia -con los dias sin actividad
 * rellenos en cero, para que la grafica no tenga huecos- y los enlaces mas
 * pulsados.
 *
 * @param {number} dias  7, 30 o 90.
 */
export const consultarMisEstadisticas = (dias = 7) =>
  peticion(`/estadisticas?dias=${dias}`);
