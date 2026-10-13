// ============================================
// AUTH.MIDDLEWARE.JS — verificacion del token JWT
// Se ejecuta antes que cualquier validador o controlador de una ruta
// protegida. Si el token es valido y la cuenta sigue habilitada, deja la
// identidad del usuario en req.usuario para las capas siguientes.
// ============================================

const jwt = require('jsonwebtoken');

const authRepository = require('../modules/auth/auth.repository');

/**
 * Comprueba la cabecera Authorization: Bearer <token>.
 * Responde 401 si falta el token, es invalido, vencido, o si el usuario
 * ya no existe o fue restringido.
 */
async function autenticar(req, res, next) {
  try {
    const autorizacion = req.headers.authorization;

    if (!autorizacion?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Autenticación requerida' });
    }

    const token = autorizacion.split(' ')[1];

    // Verifica la firma y la vigencia; lanza si algo no cuadra
    const datos = jwt.verify(token, process.env.JWT_SECRET);

    // Se consulta de nuevo porque el token no cambia hasta que vence:
    // la cuenta pudo ser restringida o eliminada despues de emitirlo
    const usuario = await authRepository.buscarPorId(datos.id);

    if (!usuario || usuario.estado !== 'activo') {
      return res.status(401).json({ message: 'Usuario inválido o restringido' });
    }

    req.usuario = {
      id: usuario.id_usuario,
      rol: usuario.rol
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o vencido' });
  }
}

module.exports = autenticar;
