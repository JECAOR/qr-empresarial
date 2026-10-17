-- Migracion 006: cierre de todas las sesiones de una cuenta.
--
-- La tabla sesion_revocada (migracion 005) sirve para cerrar UNA sesion: se
-- guarda el jti del token que se presento. Pero al cambiar la contrasena hay
-- que cerrar TODAS, y los jti de los demas tokens no se conocen: nunca se
-- guardan al emitirlos.
--
-- La solucion es una fecha de corte por usuario. El middleware compara el
-- "iat" del token (el momento en que se firmo) con esta columna y rechaza
-- todo lo anterior. Un solo UPDATE invalida cuantas sesiones haya.
--
-- Se usa DATETIME sin decimales, igual que el resto del esquema, porque el
-- "iat" de un JWT viene en segundos enteros: comparar con mas precision
-- rechazaria el token recien emitido en el mismo segundo del cambio.
USE qr_empresarial;

ALTER TABLE usuario
  ADD COLUMN sesiones_validas_desde DATETIME NULL
  COMMENT 'Los tokens firmados antes de esta fecha se rechazan. NULL = ninguna invalidacion';
