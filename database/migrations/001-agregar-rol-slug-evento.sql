-- Migracion 001: campos y tablas requeridos por los modulos de administracion,
-- estadisticas y vista publica (ver plan de desarrollo, seccion 3).
USE qr_empresarial;

-- 1. Rol y estado del usuario (modulos M1 y M8)
ALTER TABLE usuario
  ADD COLUMN rol ENUM('empresa', 'administrador') NOT NULL DEFAULT 'empresa',
  ADD COLUMN estado ENUM('activo', 'restringido') NOT NULL DEFAULT 'activo';

-- 2. Slug del perfil: URL fija a la que apunta el codigo QR (RN-13).
-- Se agrega primero como NULL para no romper las filas existentes,
-- luego se rellena a partir del nombre del negocio y por ultimo se
-- marca como obligatorio y unico.
ALTER TABLE perfil_empresarial
  ADD COLUMN slug VARCHAR(60) NULL;

UPDATE perfil_empresarial
SET slug = CONCAT(
      LEFT(LOWER(REPLACE(REPLACE(REPLACE(nombre_negocio, ' ', '-'), '.', ''), ',', '')), 50),
      '-', id_perfil)
WHERE slug IS NULL;

ALTER TABLE perfil_empresarial
  MODIFY COLUMN slug VARCHAR(60) NOT NULL,
  ADD CONSTRAINT uq_perfil_slug UNIQUE (slug);

-- 3. Registro de eventos para las estadisticas (modulo M6)
CREATE TABLE evento (
  id_evento INT AUTO_INCREMENT PRIMARY KEY,
  tipo      ENUM('escaneo', 'visita', 'clic') NOT NULL,
  fecha     DATETIME NOT NULL,
  id_perfil INT NOT NULL,
  id_enlace INT NULL,
  CONSTRAINT fk_evento_perfil FOREIGN KEY (id_perfil) REFERENCES perfil_empresarial (id_perfil),
  CONSTRAINT fk_evento_enlace FOREIGN KEY (id_enlace) REFERENCES enlace (id_enlace)
);
