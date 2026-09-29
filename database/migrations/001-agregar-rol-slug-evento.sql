-- Migracion 001: campos y tablas requeridos por los modulos de administracion,
-- estadisticas y vista publica (ver plan de desarrollo, seccion 3).
USE qr_empresarial;

ALTER TABLE usuario
  ADD COLUMN rol ENUM('empresa', 'administrador') NOT NULL DEFAULT 'empresa',
  ADD COLUMN estado ENUM('activo', 'restringido') NOT NULL DEFAULT 'activo';

ALTER TABLE perfil_empresarial
  ADD COLUMN slug VARCHAR(60) NOT NULL UNIQUE;

CREATE TABLE evento (
  id_evento INT AUTO_INCREMENT PRIMARY KEY,
  tipo      ENUM('escaneo', 'visita', 'clic') NOT NULL,
  fecha     DATETIME NOT NULL,
  id_perfil INT NOT NULL,
  id_enlace INT NULL,
  CONSTRAINT fk_evento_perfil FOREIGN KEY (id_perfil) REFERENCES perfil_empresarial (id_perfil),
  CONSTRAINT fk_evento_enlace FOREIGN KEY (id_enlace) REFERENCES enlace (id_enlace)
);
