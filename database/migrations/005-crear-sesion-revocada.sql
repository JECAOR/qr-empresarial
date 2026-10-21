-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 005: tabla de sesiones cerradas (RF-02).
--
-- Un JWT es autocontenido: una vez firmado, sigue siendo valido hasta que
-- vence, aunque el usuario pulse "cerrar sesion". Para que el cierre tenga
-- efecto real en el servidor se guarda aqui el identificador del token
-- (jti) y el middleware de autenticacion rechaza los que aparezcan en esta
-- tabla.
--
-- Solo se guarda el jti, no el token completo: basta para reconocerlo y no
-- expone la firma ni los datos del usuario.
USE qr_empresarial;

CREATE TABLE sesion_revocada (
  id_sesion   INT AUTO_INCREMENT PRIMARY KEY,
  jti         CHAR(32) NOT NULL UNIQUE,
  id_usuario  INT NOT NULL,
  revocada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_en   DATETIME NOT NULL,
  CONSTRAINT fk_sesion_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);

-- Las filas dejan de servir cuando el token vence por si solo: este indice
-- acelera la limpieza periodica de los registros ya inutiles.
CREATE INDEX idx_sesion_expira ON sesion_revocada (expira_en);
