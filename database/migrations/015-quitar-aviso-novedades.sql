-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- Migracion 015: se quita el aviso de novedades (RF-12, modulo 7).
--
-- Es el mismo caso que las resenas en la migracion 012, y se resuelve igual.
-- El interruptor ofrecia "Novedades del sistema - Cuando se agregue algo
-- nuevo a la aplicacion", y no hay nada en el sistema que pueda mandar eso:
-- ninguna tabla guarda anuncios, ninguna pantalla los redacta, y ni el RF-12
-- ni ningun otro requisito pide un boletin. No es un envio dificil: es un
-- envio sin contenido.
--
-- Construirlo de verdad significaria un redactor en la administracion y un
-- registro de lo enviado, es decir una funcionalidad entera que nadie pidio.
-- Vale lo que quedo escrito en la 012: ofrecer avisar de algo que el sistema
-- no puede detectar es peor que no ofrecerlo, porque quien lo deja encendido
-- se queda esperando un correo que no va a llegar.
--
-- Queda un solo aviso, aviso_resumen, y a diferencia de antes ese SI se
-- envia: la migracion 016 crea la tabla con la que el proceso semanal
-- recuerda lo que ya mando.
--
-- Se pierden los valores que cada cuenta tuviera en esta columna. Son una
-- bandera de un aviso que nunca se envio.
USE qr_empresarial;

ALTER TABLE preferencia_usuario
  DROP COLUMN aviso_novedades;
