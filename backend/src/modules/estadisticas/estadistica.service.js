// ============================================
// ESTADISTICA.SERVICE.JS — reglas de las estadísticas (RF-11)
//
// Dos caras del mismo módulo:
//
//   - Registrar. Lo llama la vista pública, que no tiene sesión, así que
//     nada de lo que llega es de fiar: el perfil se resuelve por slug y el
//     enlace se comprueba contra ese perfil antes de guardar nada.
//   - Consultar. Lo llama el panel, autenticado, y solo ve lo suyo.
//
// El RF-11 pide tres medidas: escaneos del QR, visitas al perfil y clics en
// enlaces. Son los tres valores del ENUM de la tabla, que ya venían en el
// esquema original.
// ============================================

const perfilRepository = require('../perfiles/perfil.repository');
const publicoRepository = require('../publico/publico.repository');
const estadisticaRepository = require('./estadistica.repository');

const TIPOS = ['escaneo', 'visita', 'clic'];

// Ventanas que admite el panel. Se limita a propósito: así una petición no
// puede pedir "los últimos 100.000 días" y poner a la base a recorrerlo todo.
const DIAS_PERMITIDOS = [7, 30, 90];
const DIAS_POR_DEFECTO = 7;

const DIAS_DE_LA_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Fecha como AAAA-MM-DD, en la zona horaria local.
 *
 * No se usa toISOString() a propósito, aunque sea más corto: convierte a UTC
 * y en Colombia, que va cinco horas por detrás, a partir de las 19:00 ya
 * devuelve la fecha de mañana. El efecto era que los eventos de la tarde
 * aparecían en el día anterior de la gráfica y el día de hoy salía en cero.
 *
 * MySQL devuelve las fechas en la zona del servidor, así que ambos lados de
 * la comparación tienen que leerse igual.
 */
function claveLocal(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

/**
 * Registra un evento llegado de la vista pública.
 *
 * @param {string} slug
 * @param {string} tipo
 * @param {number|null} idEnlace
 * @throws {Error} 400 si el tipo no existe, 404 si el perfil no es publicable.
 */
async function registrarEvento(slug, tipo, idEnlace = null) {
  if (!TIPOS.includes(tipo)) {
    const error = new Error(`El tipo de evento debe ser uno de: ${TIPOS.join(', ')}`);
    error.status = 400;
    throw error;
  }

  // Se usa la misma consulta que la vista pública: si el perfil no se puede
  // mostrar —cuenta restringida, código desactivado—, tampoco se le cuentan
  // visitas. Y de paso, un slug inventado no crea filas en la tabla.
  const perfil = await publicoRepository.buscarPerfilPublicable(slug);

  if (!perfil) {
    const error = new Error('Este perfil no está disponible');
    error.status = 404;
    throw error;
  }

  let enlace = null;

  if (tipo === 'clic') {
    // El identificador viene de una pantalla abierta: hay que comprobar que
    // sea un enlace de este perfil y no de otro
    const esDelPerfil = idEnlace
      && await estadisticaRepository.enlaceEsDelPerfil(idEnlace, perfil.id_perfil);

    if (!esDelPerfil) {
      const error = new Error('El enlace indicado no pertenece a este perfil');
      error.status = 400;
      throw error;
    }

    enlace = idEnlace;
  }

  await estadisticaRepository.registrar(perfil.id_perfil, tipo, enlace);
}

/**
 * Completa los días sin actividad.
 *
 * La gráfica del panel muestra siempre la semana entera: un martes sin
 * escaneos tiene que aparecer como cero, no desaparecer del eje.
 *
 * @param {object[]} filas - Lo que devolvió el repositorio.
 * @param {number} dias
 * @returns {object[]}
 */
function completarDias(filas, dias) {
  const porDia = new Map();

  for (const fila of filas) {
    // MySQL devuelve un Date para DATE(); se reduce al día local
    const clave = claveLocal(new Date(fila.dia));

    if (!porDia.has(clave)) porDia.set(clave, { escaneo: 0, visita: 0, clic: 0 });

    porDia.get(clave)[fila.tipo] = Number(fila.total);
  }

  const serie = [];
  const hoy = new Date();

  for (let i = dias - 1; i >= 0; i -= 1) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() - i);

    const clave = claveLocal(fecha);
    const valores = porDia.get(clave) || { escaneo: 0, visita: 0, clic: 0 };

    serie.push({
      fecha: clave,
      etiqueta: DIAS_DE_LA_SEMANA[fecha.getDay()],
      escaneos: valores.escaneo,
      visitas: valores.visita,
      clics: valores.clic
    });
  }

  return serie;
}

/**
 * Estadísticas del perfil de la cuenta autenticada.
 *
 * @param {number} idUsuario
 * @param {number|string} diasPedidos
 * @returns {Promise<object>}
 * @throws {Error} 404 si la cuenta no tiene perfil.
 */
async function obtenerMisEstadisticas(idUsuario, diasPedidos) {
  const perfil = await perfilRepository.buscarPorUsuario(idUsuario);

  if (!perfil) {
    const error = new Error('Esta cuenta todavía no tiene un perfil empresarial');
    error.status = 404;
    throw error;
  }

  const dias = DIAS_PERMITIDOS.includes(Number(diasPedidos))
    ? Number(diasPedidos)
    : DIAS_POR_DEFECTO;

  const [totales, filas, enlaces] = await Promise.all([
    estadisticaRepository.totalesPorTipo(perfil.id_perfil, dias),
    estadisticaRepository.serieDiaria(perfil.id_perfil, dias),
    estadisticaRepository.enlacesMasPulsados(perfil.id_perfil, dias, 5)
  ]);

  // De cada cien personas que vieron el perfil, cuántas pulsaron algo. Es la
  // medida que le dice al negocio si su contenido sirve de algo.
  const vistas = totales.visita + totales.escaneo;
  const conversion = vistas === 0 ? 0 : Math.round((totales.clic / vistas) * 1000) / 10;

  return {
    dias,
    totales: {
      escaneos: totales.escaneo,
      visitas: totales.visita,
      clics: totales.clic,
      conversion
    },
    serie: completarDias(filas, dias),
    enlacesMasPulsados: enlaces.map((e) => ({
      idEnlace: e.id_enlace,
      titulo: e.titulo,
      categoria: e.categoria,
      clics: Number(e.clics)
    }))
  };
}

module.exports = {
  registrarEvento,
  obtenerMisEstadisticas,
  completarDias,
  claveLocal,
  TIPOS,
  DIAS_PERMITIDOS
};
