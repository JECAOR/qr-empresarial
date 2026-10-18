-- Migracion 010: eventos para las estadisticas (RF-11, modulo 6).
--
-- La tabla evento ya venia bien pensada: el tipo es un ENUM con 'escaneo',
-- 'visita' y 'clic', que son justo las tres metricas que enumera el RF-11, y
-- id_enlace admite NULL porque una visita no apunta a ningun enlace.
--
-- Le faltan dos cosas:
--
--   1. La fecha era DATETIME NOT NULL sin valor por defecto, igual que en las
--      otras tablas del esquema original. Un evento se registra cuando
--      ocurre, asi que la pone la base.
--
--   2. Un indice para la consulta del panel: los eventos de un perfil, de un
--      tipo, en un rango de fechas. Sin el, cada carga del dashboard
--      recorreria la tabla entera, que es la que mas va a crecer de todo el
--      esquema: una fila por cada escaneo, visita y clic.
USE qr_empresarial;

ALTER TABLE evento
  MODIFY COLUMN fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_evento_perfil_tipo_fecha ON evento (id_perfil, tipo, fecha);

-- Para el ranking de enlaces mas pulsados
CREATE INDEX idx_evento_enlace ON evento (id_enlace, fecha);
