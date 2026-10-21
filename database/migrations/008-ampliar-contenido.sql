-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 008: contenido del perfil (RF-05 y RF-06, modulo 3).
--
-- Tres ajustes para que las tablas sostengan lo que la pantalla ya hace:
--
--   1. SECCIONES. La pantalla de Contenido agrupa en pestanas (Menu
--      Principal, Promociones, Reservaciones) y ninguna tabla tenia donde
--      guardar eso. Agrupar tiene sentido en una pagina que se abre desde un
--      codigo QR, asi que se agrega la columna en lugar de recortar la
--      interfaz. Es texto libre: la empresa podra renombrar sus secciones.
--
--   2. TITULO DE LOS ELEMENTOS. La tabla elemento solo tenia "contenido", de
--      modo que un texto no podia tener encabezado y cuerpo a la vez: la
--      pantalla muestra los dos ("Politica de cancelacion" / "Cancela hasta
--      2 horas antes"). Se agrega en tres pasos para no fallar con las filas
--      que ya existen, igual que se hizo con el slug en la migracion 001.
--
--   3. CATEGORIAS QUE FALTABAN. El RF-05 enumera ocho tipos de enlace y la
--      tabla solo tenia cinco: faltaban YouTube, PDF y Google Maps.
--
-- Se aprovecha para dar valores por defecto a orden y activo, que eran
-- NOT NULL sin defecto: todo INSERT tenia que calcularlos.
USE qr_empresarial;

-- ------------------------------------------------------------------
-- 1. Secciones y valores por defecto
-- ------------------------------------------------------------------
ALTER TABLE enlace
  ADD COLUMN seccion VARCHAR(60) NOT NULL DEFAULT 'menu'
    COMMENT 'Pestana donde se muestra: menu, promos, reservas...' AFTER titulo,
  MODIFY COLUMN orden INT NOT NULL DEFAULT 0,
  MODIFY COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE elemento
  ADD COLUMN seccion VARCHAR(60) NOT NULL DEFAULT 'menu'
    COMMENT 'Pestana donde se muestra: menu, promos, reservas...' AFTER tipo,
  MODIFY COLUMN orden INT NOT NULL DEFAULT 0,
  MODIFY COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;

-- ------------------------------------------------------------------
-- 2. Titulo de los elementos, en tres pasos
-- ------------------------------------------------------------------

-- 2.1 Se crea admitiendo NULL, para que las filas existentes no fallen
ALTER TABLE elemento
  ADD COLUMN titulo VARCHAR(100) NULL AFTER id_elemento;

-- 2.2 Las filas que ya estaban se quedan con el nombre de su tipo como
--     titulo: no hay de donde sacar uno mejor, y dejarlo vacio se veria peor
UPDATE elemento SET titulo = tipo WHERE titulo IS NULL;

-- 2.3 Ahora que todas tienen valor, pasa a obligatorio
ALTER TABLE elemento
  MODIFY COLUMN titulo VARCHAR(100) NOT NULL;

-- ------------------------------------------------------------------
-- 3. Categorias de enlace que pide el RF-05
-- ------------------------------------------------------------------
INSERT INTO categoria_enlace (nombre, descripcion, icono) VALUES
  ('YouTube',     'Canal o video de YouTube',        'youtube'),
  ('PDF',         'Documento PDF, como una carta o catalogo', 'file-text'),
  ('Google Maps', 'Ubicacion en Google Maps',        'map-pin');

-- ------------------------------------------------------------------
-- 4. Indices para la consulta habitual: el contenido de un perfil,
--    por seccion y en orden
-- ------------------------------------------------------------------
CREATE INDEX idx_enlace_perfil_seccion ON enlace (id_perfil, seccion, orden);
CREATE INDEX idx_elemento_perfil_seccion ON elemento (id_perfil, seccion, orden);
