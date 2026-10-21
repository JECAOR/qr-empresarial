-- El cliente mysql de la linea de ordenes envia los bytes en la pagina de
-- codigos de la consola si no se le dice otra cosa. En Windows eso convertia
-- 'Boton' con tilde en 'Bot(basura)' dentro de la base, aunque este archivo
-- estuviera bien en UTF-8 y la base declarara utf8mb4. Esta linea le dice al
-- servidor como interpretar lo que recibe, sin depender de con que opciones
-- se ejecute mysql.
SET NAMES utf8mb4;

-- ============================================================
-- SEED.SQL — datos de demostracion
--
-- Sirve para que quien clone el repositorio pueda abrir la aplicacion y ver
-- algo. Hasta ahora, una instalacion nueva quedaba con el esquema y las
-- categorias, pero sin una sola cuenta: habia que registrarse, crear el
-- perfil, agregar contenido y generar el codigo antes de poder mirar nada.
--
-- Es tambien lo que la coleccion de Postman da por hecho. Sus guias entran
-- con admin@caferaices.co y contacto@laespiga.co; sin este archivo, la
-- primera peticion de la guia 1 responde 401 y falla todo lo demas.
--
--   mysql -u root -p < database/schema.sql
--   for f in database/migrations/*.sql; do mysql -u root -p qr_empresarial < "$f"; done
--   mysql -u root -p qr_empresarial < database/seed.sql
--
-- ------------------------------------------------------------
-- LA CONTRASENA DE LAS DOS CUENTAS ES  Clave123*
--
-- Esta aqui a proposito y no es un descuido: son cuentas de demostracion de
-- un proyecto formativo, y el hash que se guarda abajo corresponde a esa
-- contrasena. NO USE ESTE ARCHIVO EN PRODUCCION. Antes de desplegar,
-- cambie las dos contrasenas o elimine las cuentas.
-- ------------------------------------------------------------
--
-- Se puede ejecutar varias veces: todo va con ON DUPLICATE KEY UPDATE sobre
-- claves que ya son unicas (el correo del usuario, el id_usuario del perfil,
-- el id_perfil del codigo). Volver a correrlo devuelve la demostracion a su
-- estado inicial en lugar de duplicarla.
--
-- Los identificadores NO se fijan a mano. En una base nueva saldran 1 y 2, y
-- en una que ya tenga cuentas saldran otros; nada depende de ellos, ni
-- siquiera la coleccion de Postman, que los resuelve por correo.
USE qr_empresarial;

-- ------------------------------------------------------------------
-- 1. Las dos cuentas
-- ------------------------------------------------------------------

-- El administrador, para la guia 8 y para la pantalla de Administracion.
-- El rol no se puede cambiar desde la API por diseno -ni el registro publico
-- ni la actualizacion de datos propios aceptan el campo-, asi que la unica
-- forma de tener un administrador es crearlo aqui.
INSERT INTO usuario (nombre, correo, contrasena, rol, estado)
VALUES (
  'Cafe Raices S.A.',
  'admin@caferaices.co',
  '$2b$10$g4OzFShR0OZ55Yp5rJ5WkeKbXsdeJfhD6h2MLfrhqtY3D3U2G1xdq',
  'administrador',
  'activo'
)
ON DUPLICATE KEY UPDATE
  nombre     = VALUES(nombre),
  contrasena = VALUES(contrasena),
  rol        = VALUES(rol),
  estado     = VALUES(estado),
  deleted_at = NULL;

-- La empresa de demostracion
INSERT INTO usuario (nombre, correo, contrasena, rol, estado)
VALUES (
  'Panaderia La Espiga',
  'contacto@laespiga.co',
  '$2b$10$g4OzFShR0OZ55Yp5rJ5WkeKbXsdeJfhD6h2MLfrhqtY3D3U2G1xdq',
  'empresa',
  'activo'
)
ON DUPLICATE KEY UPDATE
  nombre     = VALUES(nombre),
  contrasena = VALUES(contrasena),
  rol        = VALUES(rol),
  estado     = VALUES(estado),
  deleted_at = NULL;

SET @id_empresa := (SELECT id_usuario FROM usuario WHERE correo = 'contacto@laespiga.co');

-- ------------------------------------------------------------------
-- 2. El perfil empresarial (RF-04)
-- ------------------------------------------------------------------
-- El slug se fija al crear el perfil y no sigue al nombre: si cambiara, los
-- codigos QR ya impresos dejarian de funcionar.
INSERT INTO perfil_empresarial
  (id_usuario, nombre_negocio, categoria, descripcion, direccion, telefono,
   correo_contacto, instagram, horario, tema, slug)
VALUES (
  @id_empresa,
  'Panaderia La Espiga',
  'Panaderia',
  'Pan de masa madre, almojabanas y pandebono recien salidos del horno desde las 6:00.',
  'Av. 68 #40-12, Bogota',
  '+57 301 222 3344',
  'contacto@laespiga.co',
  '@panaderialaespiga',
  'Lun-Sab 7:00-20:00',
  'indigo',
  'panaderia-la-espiga'
)
ON DUPLICATE KEY UPDATE
  nombre_negocio  = VALUES(nombre_negocio),
  categoria       = VALUES(categoria),
  descripcion     = VALUES(descripcion),
  direccion       = VALUES(direccion),
  telefono        = VALUES(telefono),
  correo_contacto = VALUES(correo_contacto),
  instagram       = VALUES(instagram),
  horario         = VALUES(horario),
  tema            = VALUES(tema);

SET @id_perfil := (SELECT id_perfil FROM perfil_empresarial WHERE id_usuario = @id_empresa);

-- ------------------------------------------------------------------
-- 3. El contenido del perfil (RF-05 y RF-06)
-- ------------------------------------------------------------------
-- Hace falta al menos un bloque activo para que el codigo QR se pueda
-- encender: el modulo 4 no genera un codigo para un perfil vacio, y el
-- modulo 3 no deja quitar el ultimo bloque mientras el codigo este activo.
--
-- Se borra lo que hubiera antes para que volver a ejecutar el archivo no
-- acumule bloques repetidos. Solo de este perfil, y sus eventos se van con
-- ellos por la clave foranea.
DELETE FROM evento   WHERE id_perfil = @id_perfil;
DELETE FROM enlace   WHERE id_perfil = @id_perfil;
DELETE FROM elemento WHERE id_perfil = @id_perfil;

INSERT INTO enlace (titulo, url, seccion, orden, activo, id_perfil, id_categoria_enlace)
VALUES
  ('Escribenos por WhatsApp', 'https://wa.me/573012223344',
   'menu', 2, 1, @id_perfil, 1),
  ('Como llegar', 'https://maps.google.com/?q=Av.+68+%2340-12,+Bogota',
   'menu', 3, 1, @id_perfil, 8),
  ('Siguenos en Instagram', 'https://instagram.com/panaderialaespiga',
   'menu', 4, 1, @id_perfil, 3),
  -- Inactivo a proposito: desactivar no es borrar, y asi se ve la diferencia
  -- entre lo que el dueno tiene guardado y lo que el publico ve
  ('Promocion de Semana Santa', 'https://laespiga.co/semana-santa',
   'promos', 2, 0, @id_perfil, 4);

-- La columna `tipo` guarda el NOMBRE de la categoria, no el tipo de la API:
-- es lo que hace el Service al crear un elemento (tipo: categoria.nombre).
-- Si aqui se pusiera 'texto' o 'boton', la fila quedaria distinta de las que
-- crea la aplicacion.
INSERT INTO elemento (titulo, tipo, contenido, seccion, orden, activo, id_perfil, id_categoria_elemento)
VALUES
  ('Horneamos cada manana', 'Texto',
   'Pan de masa madre, almojabanas y pandebono recien salidos del horno desde las 6:00.',
   'menu', 1, 1, @id_perfil, 1),
  ('Encargar una torta', 'Botón', 'https://wa.me/573012223344',
   'promos', 1, 1, @id_perfil, 2);

-- ------------------------------------------------------------------
-- 4. El codigo QR (RF-07)
-- ------------------------------------------------------------------
-- Un codigo por perfil: la columna id_perfil es UNIQUE. La direccion que
-- queda codificada es la de la vista publica.
INSERT INTO codigo_qr (codigo_qr, fecha_creacion, fecha_actualizacion, activo, id_perfil)
VALUES ('/p/panaderia-la-espiga', CURDATE(), CURDATE(), 1, @id_perfil)
ON DUPLICATE KEY UPDATE
  codigo_qr = VALUES(codigo_qr),
  activo    = 1;

-- ------------------------------------------------------------------
-- 5. Actividad de los ultimos siete dias (RF-11)
-- ------------------------------------------------------------------
-- Sin esto el panel sale en cero y no se entiende que muestra. Las fechas
-- son relativas a hoy para que la grafica de siete dias siempre tenga algo,
-- se ejecute cuando se ejecute.
SET @enlace_whatsapp := (SELECT id_enlace FROM enlace
                         WHERE id_perfil = @id_perfil AND titulo = 'Escribenos por WhatsApp');
SET @enlace_maps     := (SELECT id_enlace FROM enlace
                         WHERE id_perfil = @id_perfil AND titulo = 'Como llegar');

INSERT INTO evento (tipo, fecha, id_perfil, id_enlace) VALUES
  ('escaneo', DATE_SUB(NOW(), INTERVAL 6 DAY), @id_perfil, NULL),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 6 DAY), @id_perfil, NULL),
  ('visita',  DATE_SUB(NOW(), INTERVAL 6 DAY), @id_perfil, NULL),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 5 DAY), @id_perfil, NULL),
  ('clic',    DATE_SUB(NOW(), INTERVAL 5 DAY), @id_perfil, @enlace_whatsapp),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 4 DAY), @id_perfil, NULL),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 4 DAY), @id_perfil, NULL),
  ('visita',  DATE_SUB(NOW(), INTERVAL 4 DAY), @id_perfil, NULL),
  ('clic',    DATE_SUB(NOW(), INTERVAL 4 DAY), @id_perfil, @enlace_whatsapp),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 3 DAY), @id_perfil, NULL),
  ('clic',    DATE_SUB(NOW(), INTERVAL 3 DAY), @id_perfil, @enlace_maps),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 2 DAY), @id_perfil, NULL),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 2 DAY), @id_perfil, NULL),
  ('visita',  DATE_SUB(NOW(), INTERVAL 2 DAY), @id_perfil, NULL),
  ('clic',    DATE_SUB(NOW(), INTERVAL 2 DAY), @id_perfil, @enlace_whatsapp),
  ('escaneo', DATE_SUB(NOW(), INTERVAL 1 DAY), @id_perfil, NULL),
  ('visita',  DATE_SUB(NOW(), INTERVAL 1 DAY), @id_perfil, NULL),
  ('clic',    DATE_SUB(NOW(), INTERVAL 1 DAY), @id_perfil, @enlace_maps),
  ('escaneo', NOW(), @id_perfil, NULL),
  ('escaneo', NOW(), @id_perfil, NULL),
  ('visita',  NOW(), @id_perfil, NULL),
  ('clic',    NOW(), @id_perfil, @enlace_whatsapp);

-- ------------------------------------------------------------------
-- Comprobacion
-- ------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM usuario WHERE deleted_at IS NULL)           AS cuentas,
  (SELECT COUNT(*) FROM enlace   WHERE id_perfil = @id_perfil)      AS enlaces,
  (SELECT COUNT(*) FROM elemento WHERE id_perfil = @id_perfil)      AS elementos,
  (SELECT COUNT(*) FROM evento   WHERE id_perfil = @id_perfil)      AS eventos,
  (SELECT activo   FROM codigo_qr WHERE id_perfil = @id_perfil)     AS qr_activo;
