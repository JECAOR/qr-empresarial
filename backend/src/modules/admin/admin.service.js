// ============================================
// ADMIN.SERVICE.JS — administracion (RF-13 y RF-15)
//
// El RF-14 (restringir y eliminar) no esta aqui: ya lo resuelven
// PATCH /api/usuarios/:id/estado y DELETE /api/usuarios/:id, que existen
// desde el modulo 1 con sus reglas y sus pruebas. Duplicarlos para que la
// pantalla nueva tuviera "sus" endpoints habria sido tener dos caminos para
// lo mismo, y tarde o temprano uno de los dos se queda sin una regla.
// ============================================

const adminRepository = require('./admin.repository');

/**
 * Pasa una fila a la forma que espera la pantalla.
 *
 * Las cuentas sin perfil existen de verdad: las crea el administrador desde
 * POST /api/usuarios, y las registradas antes de que el registro creara el
 * perfil tampoco lo tienen. Se devuelven con `perfil: null` en lugar de
 * esconderlas, porque son justo las que el administrador quiere ver.
 */
function aRespuesta(fila) {
  const tienePerfil = fila.id_perfil !== null;

  return {
    id: fila.id_usuario,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    estado: fila.estado,
    fechaRegistro: fila.fecha_registro,
    ultimoAcceso: fila.ultimo_acceso,

    perfil: tienePerfil
      ? {
          nombreNegocio: fila.nombre_negocio,
          slug: fila.slug,
          bloquesActivos: Number(fila.bloques_activos || 0),
          // qr_activo es NULL si nunca genero el codigo, que no es lo mismo
          // que haberlo apagado
          qr: fila.qr_activo === null ? null : Boolean(fila.qr_activo)
        }
      : null,

    actividad: {
      escaneos: Number(fila.escaneos || 0),
      visitas: Number(fila.visitas || 0),
      clics: Number(fila.clics || 0)
    }
  };
}

/**
 * Resumen de cuentas (RF-13).
 */
async function obtenerResumen() {
  return adminRepository.resumen();
}

/**
 * Lista de usuarios con su actividad (RF-13).
 *
 * @param {object} filtros - Ya validados.
 */
async function listarUsuarios(filtros) {
  const { usuarios, total } = await adminRepository.listarConActividad(filtros);

  const porPagina = Math.max(1, Math.min(Number.parseInt(filtros.porPagina, 10) || 20, 100));
  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);

  return {
    usuarios: usuarios.map(aRespuesta),
    paginacion: {
      pagina,
      porPagina,
      total,
      paginas: Math.max(1, Math.ceil(total / porPagina))
    }
  };
}

/**
 * Detalle de una cuenta, con sus ultimos eventos (RF-13).
 */
async function obtenerUsuario(idUsuario) {
  const fila = await adminRepository.buscarConActividad(idUsuario);

  if (!fila) {
    const error = new Error('El usuario no existe');
    error.status = 404;
    throw error;
  }

  const usuario = aRespuesta(fila);

  usuario.ultimosEventos = fila.id_perfil
    ? await adminRepository.ultimosEventos(fila.id_perfil)
    : [];

  return usuario;
}

/**
 * Escapa un valor para CSV.
 *
 * Se entrecomilla siempre y se duplican las comillas internas. Hace falta
 * porque el nombre de un negocio puede llevar una coma, y con eso sola la
 * fila se parte y todas las columnas siguientes quedan corridas.
 *
 * @param {*} valor
 * @returns {string}
 */
function celda(valor) {
  if (valor === null || valor === undefined) return '""';

  const texto = valor instanceof Date ? valor.toISOString() : String(valor);

  return `"${texto.replace(/"/g, '""')}"`;
}

const COLUMNAS = [
  'id', 'nombre', 'correo', 'rol', 'estado', 'fecha_registro', 'ultimo_acceso',
  'negocio', 'slug', 'bloques_activos', 'codigo_qr', 'escaneos', 'visitas', 'clics'
];

/**
 * Reporte de actividad en CSV (RF-15).
 *
 * Se genera como texto y no con una libreria: son catorce columnas de datos
 * planos, y una dependencia mas tendria que justificarse con algo que aqui
 * no hace falta.
 *
 * Lleva BOM al principio porque Excel, al abrir un CSV sin el, lo lee con la
 * codificacion del sistema y los nombres con tilde o enye salen rotos.
 *
 * @param {object} filtros
 * @returns {Promise<string>}
 */
async function generarReporteCsv(filtros) {
  const filas = await adminRepository.listarParaReporte(filtros);

  const lineas = [COLUMNAS.join(',')];

  for (const fila of filas.map(aRespuesta)) {
    lineas.push([
      celda(fila.id),
      celda(fila.nombre),
      celda(fila.correo),
      celda(fila.rol),
      celda(fila.estado),
      celda(fila.fechaRegistro),
      celda(fila.ultimoAcceso),
      celda(fila.perfil ? fila.perfil.nombreNegocio : ''),
      celda(fila.perfil ? fila.perfil.slug : ''),
      celda(fila.perfil ? fila.perfil.bloquesActivos : 0),
      celda(fila.perfil === null || fila.perfil.qr === null
        ? 'sin generar'
        : (fila.perfil.qr ? 'encendido' : 'apagado')),
      celda(fila.actividad.escaneos),
      celda(fila.actividad.visitas),
      celda(fila.actividad.clics)
    ].join(','));
  }

  return `﻿${lineas.join('\r\n')}\r\n`;
}

module.exports = { obtenerResumen, listarUsuarios, obtenerUsuario, generarReporteCsv };
