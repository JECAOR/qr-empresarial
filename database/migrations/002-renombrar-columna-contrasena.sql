-- Migracion 002: renombra la columna "contraseña" a "contrasena".
-- Motivo: evitar caracteres no ASCII en los identificadores de la base de datos,
-- que obligan a escribir fila['contraseña'] en el codigo JavaScript y pueden
-- generar problemas de codificacion entre sistemas operativos y clientes SQL.
USE qr_empresarial;

ALTER TABLE usuario
  CHANGE COLUMN `contraseña` contrasena VARCHAR(255) NOT NULL;
