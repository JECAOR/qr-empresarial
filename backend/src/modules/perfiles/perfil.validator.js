// ============================================
// PERFIL.VALIDATOR.JS — validacion del perfil empresarial (RF-10)
//
// El RF-10 pide validar "los campos obligatorios y el formato de las URL
// antes de guardar la informacion". Aqui se cumple la primera parte y la
// parte del perfil de la segunda: el Instagram y la imagen. Las URL de los
// enlaces del negocio se validaran en el modulo 3, que es donde se crean.
//
// El frontend valida lo mismo para avisar en el momento, pero esta es la
// validacion que manda: una peticion desde Postman o desde otro cliente no
// pasa por el navegador.
// ============================================

// Solo se aceptan http y https: un enlace con "javascript:" en la vista
// publica seria un agujero de seguridad, y "ftp:" no lo abre ningun telefono.
const PROTOCOLOS_ACEPTADOS = ['http:', 'https:'];

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Un usuario de Instagram: letras, numeros, puntos y guiones bajos.
// Se acepta con o sin la arroba delante.
const FORMATO_INSTAGRAM = /^@?[A-Za-z0-9._]{1,30}$/;

// Los tres temas que existen en el CSS. Un valor inventado dejaria la
// pantalla sin colores, asi que se rechaza aqui aunque la base tambien lo
// impida con su ENUM.
const TEMAS = ['indigo', 'teal', 'terracota'];

const LIMITES = {
  nombreNegocio: 150,
  categoria: 80,
  descripcion: 2000,
  direccion: 200,
  telefono: 30,
  correoContacto: 100,
  instagram: 60,
  horario: 120,
  imagen: 255
};

/**
 * Comprueba que un texto sea una URL que un navegador pueda abrir.
 * @param {string} valor
 * @returns {boolean}
 */
function esUrlValida(valor) {
  try {
    const url = new URL(valor);

    return PROTOCOLOS_ACEPTADOS.includes(url.protocol);
  } catch (error) {
    // El constructor lanza cuando la cadena no es una URL
    return false;
  }
}

/**
 * Valida el cuerpo de PUT /api/perfiles/me.
 *
 * Deja los campos opcionales en null cuando llegan vacios, para que la base
 * guarde NULL en lugar de una cadena vacia: "sin telefono" y "telefono igual
 * a nada" no deberian ser dos cosas distintas en la base.
 */
function validarPerfil(req, res, next) {
  const datos = req.body || {};

  const textoDe = (campo) => (typeof datos[campo] === 'string' ? datos[campo].trim() : '');

  // --- Campos obligatorios (RF-10) ---
  const nombreNegocio = textoDe('nombreNegocio');

  if (nombreNegocio.length < 2) {
    return res.status(400).json({
      message: 'El nombre del negocio es obligatorio y debe tener al menos 2 caracteres'
    });
  }

  // --- Largos ---
  for (const [campo, maximo] of Object.entries(LIMITES)) {
    if (textoDe(campo).length > maximo) {
      return res.status(400).json({
        message: `El campo ${campo} no puede superar los ${maximo} caracteres`
      });
    }
  }

  // --- Formatos ---
  const correoContacto = textoDe('correoContacto');

  if (correoContacto && !FORMATO_CORREO.test(correoContacto)) {
    return res.status(400).json({
      message: 'El formato del correo de contacto no es válido'
    });
  }

  const instagram = textoDe('instagram');

  if (instagram && !FORMATO_INSTAGRAM.test(instagram)) {
    return res.status(400).json({
      message: 'El usuario de Instagram solo admite letras, números, puntos y guiones bajos'
    });
  }

  // La imagen es una URL (RF-10). Mientras no haya subida de archivos, se
  // guarda la direccion de una imagen ya publicada.
  const imagen = textoDe('imagen');

  if (imagen && !esUrlValida(imagen)) {
    return res.status(400).json({
      message: 'La imagen debe ser una URL que empiece por http o https'
    });
  }

  const tema = textoDe('tema');

  if (tema && !TEMAS.includes(tema)) {
    return res.status(400).json({
      message: `El tema debe ser uno de: ${TEMAS.join(', ')}`
    });
  }

  // El cuerpo queda normalizado para las capas siguientes
  req.body = {
    nombreNegocio,
    categoria: textoDe('categoria') || null,
    descripcion: textoDe('descripcion') || null,
    direccion: textoDe('direccion') || null,
    telefono: textoDe('telefono') || null,
    correoContacto: correoContacto || null,
    instagram: instagram || null,
    horario: textoDe('horario') || null,
    imagen: imagen || null,
    // Se deja en null a proposito cuando no llega: el repositorio conserva
    // entonces el que ya tenia, y un perfil nuevo toma el de la base
    tema: tema || null
  };

  next();
}

/**
 * Valida el cuerpo de PATCH /api/perfiles/me/tema.
 */
function validarTema(req, res, next) {
  const { tema } = req.body || {};

  if (!TEMAS.includes(tema)) {
    return res.status(400).json({
      message: `El tema debe ser uno de: ${TEMAS.join(', ')}`
    });
  }

  next();
}

module.exports = {
  validarPerfil,
  validarTema,
  esUrlValida,
  TEMAS
};
