-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- ============================================
-- SCHEMA.SQL — esquema relacional de QR Empresarial
-- Motor: MySQL 8.0
-- ============================================

CREATE DATABASE IF NOT EXISTS qr_empresarial
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE qr_empresarial;

CREATE TABLE usuario (
  id_usuario     INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  correo         VARCHAR(100) NOT NULL UNIQUE,
  contrasena     VARCHAR(255) NOT NULL,
  fecha_registro DATE NOT NULL
);

CREATE TABLE perfil_empresarial (
  id_perfil      INT AUTO_INCREMENT PRIMARY KEY,
  nombre_negocio VARCHAR(150) NOT NULL,
  descripcion    TEXT NOT NULL,
  imagen         VARCHAR(255) NULL,
  fecha_creacion DATE NOT NULL,
  id_usuario     INT NOT NULL,
  CONSTRAINT fk_perfil_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);

CREATE TABLE codigo_qr (
  id_qr               INT AUTO_INCREMENT PRIMARY KEY,
  codigo_qr           TEXT NOT NULL,
  fecha_creacion      DATE NOT NULL,
  fecha_actualizacion DATE NOT NULL,
  activo              TINYINT(1) NOT NULL DEFAULT 1,
  id_perfil           INT NOT NULL UNIQUE,
  CONSTRAINT fk_qr_perfil FOREIGN KEY (id_perfil) REFERENCES perfil_empresarial (id_perfil)
);

CREATE TABLE categoria_enlace (
  id_categoria_enlace INT AUTO_INCREMENT PRIMARY KEY,
  nombre              VARCHAR(100) NOT NULL,
  descripcion         TEXT NULL,
  icono               VARCHAR(100) NULL
);

CREATE TABLE categoria_elemento (
  id_categoria_elemento INT AUTO_INCREMENT PRIMARY KEY,
  nombre                VARCHAR(100) NOT NULL,
  descripcion           TEXT NULL,
  icono                 VARCHAR(100) NULL
);

CREATE TABLE enlace (
  id_enlace           INT AUTO_INCREMENT PRIMARY KEY,
  titulo              VARCHAR(100) NOT NULL,
  url                 TEXT NOT NULL,
  orden               INT NOT NULL,
  activo              TINYINT(1) NOT NULL DEFAULT 1,
  id_perfil           INT NOT NULL,
  id_categoria_enlace INT NOT NULL,
  CONSTRAINT fk_enlace_perfil FOREIGN KEY (id_perfil) REFERENCES perfil_empresarial (id_perfil),
  CONSTRAINT fk_enlace_categoria FOREIGN KEY (id_categoria_enlace) REFERENCES categoria_enlace (id_categoria_enlace)
);

CREATE TABLE elemento (
  id_elemento           INT AUTO_INCREMENT PRIMARY KEY,
  tipo                  VARCHAR(50) NOT NULL,
  contenido             TEXT NOT NULL,
  orden                 INT NOT NULL,
  activo                TINYINT(1) NOT NULL DEFAULT 1,
  id_perfil             INT NOT NULL,
  id_categoria_elemento INT NOT NULL,
  CONSTRAINT fk_elemento_perfil FOREIGN KEY (id_perfil) REFERENCES perfil_empresarial (id_perfil),
  CONSTRAINT fk_elemento_categoria FOREIGN KEY (id_categoria_elemento) REFERENCES categoria_elemento (id_categoria_elemento)
);
