-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 003: preparacion de la tabla usuario para el CRUD del modulo M1.
-- 1. deleted_at permite la eliminacion logica: el usuario deja de estar
--    disponible sin perder su historial ni romper las claves foraneas.
-- 2. fecha_registro recibe un valor por defecto para que el INSERT del
--    repositorio no tenga que calcularlo.
USE qr_empresarial;

ALTER TABLE usuario
  ADD COLUMN deleted_at DATETIME NULL,
  MODIFY COLUMN fecha_registro DATE NOT NULL DEFAULT (CURRENT_DATE);
