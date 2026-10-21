-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 012: se quita el aviso de resenas (RF-12, modulo 7).
--
-- La migracion 011 creo tres avisos copiando los tres interruptores que traia
-- la pantalla de Configuracion. Al revisar el modulo 7 se vio que uno de ellos
-- prometia algo que no existe: "Nuevas resenas - Cuando un cliente deja una
-- calificacion". En el sistema no hay resenas en ninguna parte. El esquema
-- tiene once tablas y ninguna guarda calificaciones de clientes, ni el RF-12
-- ni ningun otro requisito las pide.
--
-- Era el mismo problema que ya se corrigio en otras pantallas: un control que
-- parece funcionar y no acciona nada. Ofrecer avisar de algo que el sistema no
-- puede detectar es peor que no ofrecerlo, porque quien lo deja encendido se
-- queda esperando un correo que no va a llegar.
--
-- Los otros dos avisos SI se conservan, pero conviene dejarlo escrito: hoy se
-- guardan y se leen, y ningun proceso los envia. El unico correo que manda el
-- sistema es el enlace de recuperacion de contrasena. Son una preferencia
-- guardada, no un envio programado.
--
-- Se pierden los valores que cada cuenta tuviera en esa columna. Son una
-- bandera de un aviso que nunca se envio.
USE qr_empresarial;

ALTER TABLE preferencia_usuario
  DROP COLUMN aviso_resenas;
