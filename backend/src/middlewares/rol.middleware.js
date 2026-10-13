// ============================================
// ROL.MIDDLEWARE.JS — autorizacion por rol (RN-22)
// Se ejecuta despues de auth.middleware, que es quien deja la identidad
// del usuario en req.usuario. Decide si ese rol puede realizar la operacion.
// ============================================

/**
 * Devuelve un middleware que solo deja pasar los roles indicados.
 *
 * Ejemplos:
 *   autorizarRoles('administrador')              solo el administrador
 *   autorizarRoles('administrador', 'empresa')   cualquiera de los dos
 *
 * @param {...string} rolesPermitidos
 * @returns {Function} Middleware de Express.
 */
function autorizarRoles(...rolesPermitidos) {
  return function (req, res, next) {
    // Si falta req.usuario, la ruta se monto sin autenticar primero
    if (!req.usuario) {
      return res.status(401).json({ message: 'Autenticación requerida' });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    next();
  };
}

module.exports = autorizarRoles;
