-- Migracion 003: preparacion de la tabla usuario para el CRUD del modulo M1.
-- 1. deleted_at permite la eliminacion logica: el usuario deja de estar
--    disponible sin perder su historial ni romper las claves foraneas.
-- 2. fecha_registro recibe un valor por defecto para que el INSERT del
--    repositorio no tenga que calcularlo.
USE qr_empresarial;

ALTER TABLE usuario
  ADD COLUMN deleted_at DATETIME NULL,
  MODIFY COLUMN fecha_registro DATE NOT NULL DEFAULT (CURRENT_DATE);
