-- Migracion 007: amplia el perfil empresarial (RF-04, modulo 2).
--
-- El RF-04 enumera un minimo: "nombre del negocio, descripcion e imagen".
-- La pantalla de Configuracion y la vista publica ya recogen y muestran seis
-- datos mas, y son los que hacen util el perfil: un cliente que escanea el QR
-- busca el telefono, la direccion o el horario. Se amplia la tabla en lugar de
-- recortar la interfaz. Queda documentado como ampliacion justificada del
-- RF-04, igual que la decision de guardar el rol en un ENUM.
--
-- Se aprovecha para tres correcciones del esquema original:
--   1. descripcion e imagen eran NOT NULL sin valor por defecto, asi que no se
--      podia crear un perfil sin ellas. Ahora el perfil nace al registrarse y
--      la descripcion o la imagen pueden llegar despues.
--   2. fecha_creacion era DATE sin valor por defecto: habia que calcularla en
--      el codigo. Pasa a DATETIME con CURRENT_TIMESTAMP, como fecha_registro
--      en usuario (migracion 003).
--   3. id_usuario no era unico, asi que la base permitia dos perfiles para la
--      misma cuenta. El diseno es de uno por cuenta, y de ahi depende el RF-07
--      ("un QR unico por perfil").
USE qr_empresarial;

-- 1. Campos nuevos. Todos opcionales: se completan desde Configuracion.
--    El correo se llama correo_contacto para no confundirlo con usuario.correo,
--    que es el del inicio de sesion.
ALTER TABLE perfil_empresarial
  ADD COLUMN categoria       VARCHAR(80)  NULL COMMENT 'Rubro del negocio, p. ej. Restaurante' AFTER nombre_negocio,
  ADD COLUMN direccion       VARCHAR(200) NULL AFTER descripcion,
  ADD COLUMN telefono        VARCHAR(30)  NULL AFTER direccion,
  ADD COLUMN correo_contacto VARCHAR(100) NULL COMMENT 'Correo publico del negocio' AFTER telefono,
  ADD COLUMN instagram       VARCHAR(60)  NULL AFTER correo_contacto,
  ADD COLUMN horario         VARCHAR(120) NULL AFTER instagram;

-- 2. La descripcion y la imagen dejan de ser obligatorias
ALTER TABLE perfil_empresarial
  MODIFY COLUMN descripcion TEXT         NULL,
  MODIFY COLUMN imagen      VARCHAR(255) NULL;

-- 3. Fechas: creacion automatica y registro de la ultima edicion.
--    La de actualizacion la necesita el RF-09, que exige mostrar la
--    informacion actualizada al escanear el QR.
ALTER TABLE perfil_empresarial
  MODIFY COLUMN fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN fecha_actualizacion DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

-- 4. Un perfil por cuenta
ALTER TABLE perfil_empresarial
  ADD CONSTRAINT uq_perfil_usuario UNIQUE (id_usuario);
