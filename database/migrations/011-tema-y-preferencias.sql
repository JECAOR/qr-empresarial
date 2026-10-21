-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 011: tema del negocio y preferencias de la cuenta (RF-12, modulo 7).
--
-- El RF-12 pide "personalizar opciones de la plataforma". Hasta ahora esas
-- opciones vivian solo en el navegador: quien entraba desde otro equipo
-- perdia su tema de color y sus avisos.
--
-- Son dos cosas distintas y van a sitios distintos:
--
--   1. EL TEMA es del negocio, no de la cuenta. Asi lo dice el comentario de
--      theme.js desde el principio: es el color de marca, y la vista publica
--      lo aplica. El problema era que lo leia del navegador del visitante, de
--      modo que el color que elegia el negocio no llegaba nunca a quien
--      escaneaba el codigo. Pasa a perfil_empresarial, que es lo que la vista
--      publica ya consulta.
--
--   2. LOS AVISOS son de la cuenta. Que alguien quiera recibir el resumen
--      semanal no tiene nada que ver con el negocio, y dos personas que
--      administraran el mismo perfil podrian querer cosas distintas. Van a su
--      propia tabla: usuario se queda con lo de identidad y autenticacion, y
--      asi se pueden agregar preferencias mas adelante sin tocarla.
USE qr_empresarial;

-- ------------------------------------------------------------------
-- 1. Tema del negocio
-- ------------------------------------------------------------------
-- ENUM y no texto libre: son los tres temas que existen en el CSS, y un
-- valor inventado dejaria la pantalla sin colores.
ALTER TABLE perfil_empresarial
  ADD COLUMN tema ENUM('indigo', 'teal', 'terracota') NOT NULL DEFAULT 'indigo'
    COMMENT 'Color de marca del negocio; se aplica tambien en la vista publica'
    AFTER imagen;

-- ------------------------------------------------------------------
-- 2. Preferencias de la cuenta
-- ------------------------------------------------------------------
CREATE TABLE preferencia_usuario (
  id_preferencia  INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario      INT NOT NULL,
  aviso_resumen   TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Resumen semanal de la actividad del perfil',
  aviso_resenas   TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Avisos de resenas nuevas',
  aviso_novedades TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Novedades de la plataforma',
  fecha_actualizacion DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_preferencia_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
  -- Una fila por cuenta. La fila se crea la primera vez que se guarda algo;
  -- mientras no exista, valen los valores por defecto de arriba.
  CONSTRAINT uq_preferencia_usuario UNIQUE (id_usuario)
);
