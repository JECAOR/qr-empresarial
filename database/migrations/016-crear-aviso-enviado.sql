-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 016: registro de los avisos ya enviados (RF-12, modulo 7).
--
-- Hasta ahora la preferencia aviso_resumen se guardaba y ningun proceso la
-- consultaba. Con esta tabla empieza a enviarse de verdad, y lo primero que
-- necesita un proceso que manda correo es recordar lo que ya mando.
--
-- EL PROBLEMA QUE RESUELVE. El resumen lo dispara el Programador de tareas
-- de Windows una vez por semana. Un proceso asi se ejecuta dos veces mas a
-- menudo de lo que parece: el equipo estaba apagado a la hora prevista y la
-- tarea corre al encenderlo, alguien la lanza a mano para probar, o la
-- version anterior quedo a medias y se repite. Sin memoria, cada una de esas
-- veces es otro correo para el mismo negocio por la misma semana.
--
-- POR QUE UNA TABLA Y NO UNA COLUMNA. Una columna
-- preferencia_usuario.ultimo_resumen bastaria para no repetir, pero no
-- dejaria ver que se envio ni cuando, y habria que compararla con fechas en
-- el codigo. Aqui la que impide el duplicado es la base: la restriccion
-- UNIQUE sobre (id_usuario, tipo, periodo) hace imposible insertar dos veces
-- el mismo aviso del mismo periodo, sin importar cuantos procesos corran a
-- la vez. El proceso inserta ANTES de enviar y, si la insercion choca, sabe
-- que ese correo ya salio y lo salta. Si el envio falla despues, borra su
-- reserva para que el siguiente intento vuelva a probar.
--
-- El tipo es texto y no ENUM a proposito: si mas adelante hay otro aviso,
-- entra sin tocar el esquema.
USE qr_empresarial;

CREATE TABLE aviso_enviado (
  id_aviso    INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario  INT NOT NULL,
  tipo        VARCHAR(20) NOT NULL
    COMMENT 'Que aviso fue; hoy solo "resumen"',
  -- El primer dia de la semana resumida, no el dia del envio: es lo que
  -- identifica al correo. Dos ejecuciones del mismo lunes comparten periodo
  -- y la segunda choca con el UNIQUE, que es justo lo que se busca.
  periodo     DATE NOT NULL
    COMMENT 'Primer dia del periodo que resume el correo',
  fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aviso_enviado_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
  CONSTRAINT uq_aviso_enviado UNIQUE (id_usuario, tipo, periodo)
);
