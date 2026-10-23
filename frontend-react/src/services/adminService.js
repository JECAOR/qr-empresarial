// ============================================
// ADMINSERVICE.JS — el panel de administracion (RF-13, RF-14 y RF-15)
//
// Todo el modulo exige el rol administrador: el router del backend lo aplica
// de una vez a todas sus rutas, no endpoint por endpoint.
// ============================================

import { peticion, descargar } from "./apiClient";

// Los que acepta el validador. Uno invalido no da error: se ignora y se usa
// el valor por defecto, porque responder 400 porque alguien edito la URL
// dejaria la pantalla en blanco por algo que no importa.
export const ESTADOS = ["activo", "restringido"];
export const ROLES = ["empresa", "administrador"];
export const ORDENES = [
  { valor: "registro", nombre: "Más recientes" },
  { valor: "nombre", nombre: "Nombre" },
  { valor: "acceso", nombre: "Último acceso" },
  { valor: "actividad", nombre: "Más actividad" }
];

export const LARGO_MAXIMO_BUSQUEDA = 100;

/** Quita los filtros vacios para no mandar parametros de relleno. */
function aConsulta(filtros) {
  const parametros = new URLSearchParams();

  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== null && valor !== undefined && valor !== "") {
      parametros.set(clave, String(valor));
    }
  }

  return parametros.toString();
}

/** Las cifras de la cabecera (RF-13). */
export const consultarResumen = () => peticion("/admin/resumen");

/**
 * Las cuentas, con su perfil y su actividad (RF-13).
 *
 * Responde {data, paginacion}: la paginacion no va dentro de data, asi que
 * quien lea solo data se queda sin saber cuantas paginas hay.
 */
export const listarUsuarios = (filtros) =>
  peticion(`/admin/usuarios?${aConsulta(filtros)}`);

/** Una cuenta con sus ultimos eventos (RF-13). */
export const consultarUsuario = (id) => peticion(`/admin/usuarios/${id}`);

/**
 * El reporte en CSV (RF-15).
 *
 * Respeta los filtros de la pantalla: lo que se descarga es lo que se esta
 * viendo, no la tabla entera. El archivo empieza por BOM para que Excel no
 * rompa las tildes.
 */
export const descargarReporte = (filtros) =>
  descargar(`/admin/reportes/usuarios?${aConsulta(filtros)}`);
