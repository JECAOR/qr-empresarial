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
 * Responde 401 si falta el token, es invalido, vencido, si la sesion fue
 * cerrada, si la contrasena cambio despues de emitirlo, o si el usuario ya no
 * existe o fue restringido.
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

    // RF-02: un token sin jti no se puede revocar, asi que no se acepta.
    // Solo ocurre con tokens emitidos antes de incorporar el cierre de
    // sesion; basta volver a iniciar sesion para obtener uno nuevo.
    if (!datos.jti) {
      return res.status(401).json({ message: 'Token inválido o vencido' });
    }

    // RF-02: si el usuario cerro sesion, el token queda inservible aunque
    // su firma y su fecha sigan siendo correctas
    if (await authRepository.sesionRevocada(datos.jti)) {
      return res.status(401).json({ message: 'La sesión fue cerrada' });
    }

    // Se consulta de nuevo porque el token no cambia hasta que vence:
    // la cuenta pudo ser restringida o eliminada despues de emitirlo
    const usuario = await authRepository.buscarPorId(datos.id);

    if (!usuario || usuario.estado !== 'activo') {
      return res.status(401).json({ message: 'Usuario inválido o restringido' });
    }

    // Si la contrasena cambio despues de emitirse este token, no sirve.
    //
    // El "iat" del JWT viene en segundos; la columna guarda segundos enteros.
    // La comparacion es estricta para que el token emitido en el mismo segundo
    // del cambio -el que recibe quien acaba de cambiar su contrasena- siga
    // valiendo.
    if (usuario.sesiones_validas_desde) {
      const firmadoEn = datos.iat * 1000;
      const corte = new Date(usuario.sesiones_validas_desde).getTime();

      if (firmadoEn < corte) {
        return res.status(401).json({
          message: 'La contraseña cambió. Inicie sesión de nuevo'
        });
      }
    }

    req.usuario = {
      id: usuario.id_usuario,
      rol: usuario.rol,

      // Los necesita el cierre de sesion para anotar este token concreto.
      // exp viene en segundos, como define el estandar JWT.
      jti: datos.jti,
      expiraEn: new Date(datos.exp * 1000)
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o vencido' });
  }
}

module.exports = autenticar;
