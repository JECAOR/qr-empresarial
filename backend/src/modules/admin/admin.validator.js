// ============================================
// ADMIN.VALIDATOR.JS — filtros de la administracion (RF-13, RF-15)
//
// Todo lo que llega por la cadena de consulta es texto libre que escribio
// alguien. Aqui se normaliza antes de que el Service lo vea, para que las
// capas de abajo trabajen siempre con los mismos valores posibles.
// ============================================

const ESTADOS = ['activo', 'restringido'];
const ROLES = ['empresa', 'administrador'];
const ORDENES = ['registro', 'acceso', 'nombre', 'actividad'];

const LARGO_MAXIMO_BUSQUEDA = 100;

/**
 * Normaliza los filtros de la lista de usuarios.
 *
 * Un filtro invalido no es un error: se ignora y se usa el valor por
 * defecto. La alternativa seria responder 400 porque alguien edito la URL,
 * y eso deja la pantalla en blanco por algo que no importa.
 *
 * El unico que si corta es una busqueda desmedida, porque acaba en tres
 * LIKE '%...%' sobre la tabla de usuarios.
 */
function validarFiltros(req, res, next) {
  const { busqueda, estado, rol, orden, pagina, porPagina } = req.query;

  if (typeof busqueda === 'string' && busqueda.length > LARGO_MAXIMO_BUSQUEDA) {
    return res.status(400).json({
      message: `La búsqueda no puede pasar de ${LARGO_MAXIMO_BUSQUEDA} caracteres`
    });
  }

  req.filtros = {
    busqueda: typeof busqueda === 'string' && busqueda.trim() ? busqueda.trim() : null,
    estado: ESTADOS.includes(estado) ? estado : null,
    rol: ROLES.includes(rol) ? rol : null,
    orden: ORDENES.includes(orden) ? orden : 'registro',
    pagina: Number.parseInt(pagina, 10) || 1,
    porPagina: Number.parseInt(porPagina, 10) || 20
  };

  return next();
}

module.exports = { validarFiltros, ESTADOS, ROLES, ORDENES };
