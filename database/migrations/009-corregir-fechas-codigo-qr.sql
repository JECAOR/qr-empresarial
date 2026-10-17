-- Migracion 009: fechas y estado del codigo QR (RF-07, modulo 4).
--
-- La tabla codigo_qr venia con el mismo problema que perfil_empresarial antes
-- de la migracion 007: fecha_creacion y fecha_actualizacion eran DATE NOT NULL
-- sin valor por defecto. Eso obliga a calcular las dos en cada INSERT, y la de
-- actualizacion no tiene sentido al crear la fila: todavia no se ha
-- actualizado nada.
--
-- Se dejan igual que en las demas tablas:
--   fecha_creacion       se pone sola al insertar
--   fecha_actualizacion  queda NULL hasta el primer cambio, y entonces MySQL
--                        la mantiene
--   activo               por defecto 1, porque un codigo recien generado sirve
--
-- Se pasa de DATE a DATETIME para saber la hora, no solo el dia: un negocio
-- puede generar y desactivar su codigo la misma tarde.
USE qr_empresarial;

ALTER TABLE codigo_qr
  MODIFY COLUMN fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN fecha_actualizacion DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  MODIFY COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;
