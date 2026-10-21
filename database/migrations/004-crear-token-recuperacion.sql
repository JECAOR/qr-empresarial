-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 004: tabla de tokens para la recuperacion de contrasena (RF-03).
--
-- Reglas que soporta:
--   RN-04  El enlace expira a los 30 minutos y es de un solo uso.
--   El token se guarda cifrado (hash), igual que las contrasenas: si alguien
--   lee la tabla no puede construir el enlace de recuperacion.
USE qr_empresarial;

CREATE TABLE token_recuperacion (
  id_token    INT AUTO_INCREMENT PRIMARY KEY,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en   DATETIME NOT NULL,
  usado_en    DATETIME NULL,
  id_usuario  INT NOT NULL,
  CONSTRAINT fk_token_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);

-- Acelera la consulta tipica: tokens vigentes de un usuario
CREATE INDEX idx_token_usuario ON token_recuperacion (id_usuario, expira_en);
