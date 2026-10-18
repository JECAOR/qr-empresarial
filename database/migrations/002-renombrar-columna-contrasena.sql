-- Migracion 002: la columna de la contrasena pierde la enye.
--
-- La tabla `usuario` nacio con la columna escrita `contraseña`. Un nombre con
-- caracteres no ASCII obliga a escribirlo entre acentos graves en cada
-- consulta y es una fuente de problemas de codificacion entre el cliente de
-- MySQL, Node y el editor. Se renombra a `contrasena`.
--
-- SE EJECUTA SOLO SI HACE FALTA. El archivo schema.sql se actualizo despues
-- para declarar ya la columna como `contrasena`, asi que al reconstruir la
-- base desde cero esta migracion se encontraba con que no habia nada que
-- renombrar y cortaba la cadena con "Unknown column 'contraseña'".
--
-- Lo descubrieron las pruebas automaticas del backend, que levantan una base
-- propia aplicando schema.sql y todas las migraciones en orden: hasta
-- entonces nadie habia comprobado que el repositorio pudiera reconstruir la
-- base, y no podia. Una migracion tiene que poder volver a correrse sobre una
-- base que ya la tiene aplicada sin reventar.
USE qr_empresarial;

SET @columna_vieja := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usuario'
    AND COLUMN_NAME = 'contraseña'
);

SET @sentencia := IF(
  @columna_vieja = 1,
  'ALTER TABLE usuario CHANGE COLUMN `contraseña` contrasena VARCHAR(255) NOT NULL',
  'DO 0'
);

PREPARE renombrar FROM @sentencia;
EXECUTE renombrar;
DEALLOCATE PREPARE renombrar;
