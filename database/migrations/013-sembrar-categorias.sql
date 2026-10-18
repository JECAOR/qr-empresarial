-- Migracion 013: las categorias pasan a estar en el repositorio.
--
-- Las ocho categorias de enlace del RF-05 y las cinco de elemento son datos
-- que la aplicacion NECESITA para funcionar: el formulario de contenido las
-- lista y manda su identificador numerico. Sin ellas, agregar cualquier
-- bloque responde 400.
--
-- Cinco de las de enlace (WhatsApp, Facebook, Instagram, Pagina Web,
-- LinkedIn) y las cinco de elemento se habian insertado a mano en la base de
-- desarrollo y no estaban en ningun archivo. La migracion 008 agrego las tres
-- que faltaban del RF-05 sin indicar el id, dando por hecho que las cinco
-- primeras ya existian.
--
-- Consecuencia: al reconstruir la base desde el repositorio solo aparecian
-- tres categorias, y ademas con los ids 1, 2 y 3. El frontend manda
-- idCategoria 4 para una pagina web, asi que en una instalacion nueva NO SE
-- PODIA AGREGAR NINGUN BLOQUE DE CONTENIDO.
--
-- Lo encontraron las pruebas automaticas del backend, que levantan una base
-- propia aplicando schema.sql y las migraciones en orden. Contra la base de
-- desarrollo nunca se habria visto, porque ahi los datos ya estaban puestos.
--
-- Se usa ON DUPLICATE KEY UPDATE con los ids explicitos, no DELETE + INSERT:
-- las filas de `categoria_enlace` estan referenciadas por `enlace`, y
-- borrarlas romperia las claves foraneas de cualquier base con contenido. En
-- desarrollo esta migracion no cambia nada, porque los valores ya son estos.
USE qr_empresarial;

INSERT INTO categoria_enlace (id_categoria_enlace, nombre, descripcion, icono) VALUES
  (1, 'WhatsApp',    'Enlace de contacto por WhatsApp',          'whatsapp'),
  (2, 'Facebook',    'Página oficial de Facebook',               'facebook'),
  (3, 'Instagram',   'Perfil de Instagram',                      'instagram'),
  (4, 'Página Web',  'Sitio web oficial',                        'globe'),
  (5, 'LinkedIn',    'Perfil empresarial',                       'linkedin'),
  (6, 'YouTube',     'Canal o video de YouTube',                 'youtube'),
  (7, 'PDF',         'Documento PDF, como una carta o catalogo', 'file-text'),
  (8, 'Google Maps', 'Ubicacion en Google Maps',                 'map-pin')
ON DUPLICATE KEY UPDATE
  nombre      = VALUES(nombre),
  descripcion = VALUES(descripcion),
  icono       = VALUES(icono);

INSERT INTO categoria_elemento (id_categoria_elemento, nombre, descripcion, icono) VALUES
  (1, 'Texto',   'Bloques de texto para mostrar información', 'text'),
  (2, 'Botón',   'Botones de acción',                         'button'),
  (3, 'Imagen',  'Imágenes del negocio',                      'image'),
  (4, 'Video',   'Videos promocionales',                      'video'),
  (5, 'Horario', 'Horario de atención',                       'clock')
ON DUPLICATE KEY UPDATE
  nombre      = VALUES(nombre),
  descripcion = VALUES(descripcion),
  icono       = VALUES(icono);

-- El AUTO_INCREMENT queda por encima de lo sembrado, para que una categoria
-- nueva no choque con estos ids
ALTER TABLE categoria_enlace   AUTO_INCREMENT = 9;
ALTER TABLE categoria_elemento AUTO_INCREMENT = 6;
