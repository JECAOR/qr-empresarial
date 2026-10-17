// ============================================
// CONTENIDO.VALIDATOR.JS — validacion del contenido (RF-05, RF-06, RF-10)
//
// Aqui se comprueba todo lo que se puede saber sin consultar la base: que el
// tipo exista, que el titulo venga, que los largos quepan.
//
// La URL de los enlaces NO se valida aqui, aunque sea parte del RF-10: la
// regla depende de la categoria elegida -un WhatsApp admite un telefono y un
// sitio web no-, y la categoria hay que leerla de la base. Eso vive en el
// Service, en normalizarDetalle().
// ============================================

const TIPOS_VALIDOS = ['enlace', 'texto', 'boton'];

const LIMITES = {
  titulo: 100,
  seccion: 60,
  detalle: 2000
};

/**
 * Valida el cuerpo de POST y PUT /api/contenido.
 * Normaliza el cuerpo para las capas siguientes.
 */
function validarContenido(req, res, next) {
  const datos = req.body || {};

  const textoDe = (campo) => (typeof datos[campo] === 'string' ? datos[campo].trim() : '');

  // --- Tipo ---
  // En PUT no se admite: cambiar de tipo seria mover la fila de tabla.
  const esCreacion = req.method === 'POST';

  if (esCreacion && !TIPOS_VALIDOS.includes(datos.tipo)) {
    return res.status(400).json({
      message: `El tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`
    });
  }

  // --- Titulo ---
  const titulo = textoDe('titulo');

  if (titulo.length < 2) {
    return res.status(400).json({
      message: 'El título es obligatorio y debe tener al menos 2 caracteres'
    });
  }

  // --- Detalle ---
  // Es la URL en los enlaces y el cuerpo en los textos y botones. Siempre
  // hace falta: un enlace sin destino o un texto vacio no sirven de nada.
  const detalle = textoDe('detalle');

  if (!detalle) {
    return res.status(400).json({
      message: 'El contenido del bloque es obligatorio (la dirección, en el caso de un enlace)'
    });
  }

  // --- Seccion ---
  // Si no llega, va a la primera pestana de la pantalla.
  const seccion = textoDe('seccion') || 'menu';

  // --- Categoria ---
  const idCategoria = Number(datos.idCategoria);

  if (!Number.isInteger(idCategoria) || idCategoria <= 0) {
    return res.status(400).json({
      message: 'Debe indicar la categoría del contenido'
    });
  }

  // --- Largos ---
  for (const [campo, maximo] of Object.entries(LIMITES)) {
    const valor = campo === 'seccion' ? seccion : textoDe(campo);

    if (valor.length > maximo) {
      return res.status(400).json({
        message: `El campo ${campo} no puede superar los ${maximo} caracteres`
      });
    }
  }

  req.body = { tipo: datos.tipo, titulo, detalle, seccion, idCategoria };

  next();
}

/**
 * Valida el cuerpo de PATCH /api/contenido/:id/estado.
 */
function validarEstado(req, res, next) {
  if (typeof req.body?.activo !== 'boolean') {
    return res.status(400).json({
      message: 'El campo activo debe ser true o false'
    });
  }

  next();
}

/**
 * Valida el cuerpo de PUT /api/contenido/orden.
 */
function validarOrden(req, res, next) {
  const { ids } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      message: 'Envíe la lista de identificadores en el orden deseado'
    });
  }

  if (!ids.every((id) => typeof id === 'string' && id)) {
    return res.status(400).json({
      message: 'Los identificadores deben ser cadenas como "enlace-12"'
    });
  }

  next();
}

module.exports = {
  validarContenido,
  validarEstado,
  validarOrden,
  TIPOS_VALIDOS
};
