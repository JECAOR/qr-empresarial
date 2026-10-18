# QR Empresarial

Aplicación web responsive que permite a pymes y emprendedores crear un **perfil empresarial digital** y compartirlo mediante un **código QR dinámico**. El QR apunta siempre a la misma URL, así que la información se puede actualizar sin volver a imprimir el código.

> Proyecto formativo — Tecnología en Análisis y Desarrollo de Software (SENA, ficha 3336250).
> El análisis y la planeación están en `Documento_Proyecto_ADSO`; las decisiones técnicas, en `Plan_de_desarrollo_QR_Empresarial.docx`.

## Estado del proyecto

| Parte | Estado |
|---|---|
| Análisis y diseño (requisitos, casos de uso, modelo relacional, prototipos) | Terminado |
| Base de datos MySQL `qr_empresarial` (9 tablas, 4 migraciones) | Implementada |
| Frontend HTML/CSS/JS (11 pantallas, PWA, pruebas Playwright) | Implementado. Autenticación conectada a la API; el resto de las pantallas sigue con datos en `localStorage` |
| Backend — entorno y servidor Express | Terminado (`v0.2.0`) |
| Backend — módulo Usuarios (CRUD completo) | Terminado (`v0.4.0`) |
| Backend — autenticación con JWT, roles y registro público | Terminado (`v0.5.0`) |
| Backend — recuperación de contraseña y límite de intentos | Terminado (`v0.6.0`) |
| Backend — cierre de sesión y envío del enlace por correo | Terminado (`v0.7.0`) |
| Frontend conectado a la API (registro, inicio y cierre de sesión, recuperación) | Terminado (`v0.8.0`) |
| Cambio de contraseña y cierre de todas las sesiones | Terminado (`v0.9.0`) |
| Eliminación de la cuenta propia | Terminado (`v1.0.0`) |
| M2. Perfil empresarial (RF-04 y RF-10) | Terminado (`v1.1.0`) |
| M3. Gestión de contenido (RF-05 y RF-06) | Terminado (`v1.3.0`) |
| M4. Código QR (RF-07 y RF-08) | Terminado (`v1.4.0`) |
| M5. Vista pública (RF-09) | Terminado (`v1.5.2`) |
| M6. Estadísticas (RF-11) | Terminado (`v1.6.0`) |
| Backend — perfiles, contenido, QR, estadísticas y administración | Pendiente |

### Versiones publicadas

| Etiqueta | Contenido |
|---|---|
| `v0.1.0` | Repositorio, estructura del proyecto y esquema de base de datos |
| `v0.2.0` | Proyecto Node, estructura del backend y servidor Express con `/api/health` |
| `v0.3.0` | `POST /api/usuarios` con arquitectura por capas |
| `v0.4.0` | CRUD completo del módulo Usuarios y colección de Postman |
| `v0.5.0` | Autenticación con JWT, autorización por roles y registro público |
| `v0.6.0` | Recuperación de contraseña (RF-03) y límite de intentos de inicio de sesión (RN-03) |
| `v0.7.0` | Cierre de sesión (RF-02) y envío del enlace de recuperación por correo (RF-03) |
| `v0.8.0` | Frontend conectado a la API: los RF-01 a RF-03 funcionan desde las pantallas |
| `v0.9.0` | Cambio de contraseña propio y cierre de todas las sesiones al cambiarla |
| `v1.0.0` | Eliminación de la cuenta propia. Módulo 1 completo |
| `v1.1.0` | Módulo 2: perfil empresarial, con validación de campos y URL |
| `v1.2.0` | Módulo 3: enlaces, textos y botones del perfil, con secciones y orden |
| `v1.3.0` | Reordenar el contenido arrastrando o con el teclado |
| `v1.4.0` | Módulo 4: código QR por perfil y descarga en PNG, SVG y PDF |
| `v1.5.0` | Módulo 5: vista pública en `/p/{slug}`. Flujo principal completo |
| `v1.5.1` | La pantalla del menú también consume la API, en lugar de datos de ejemplo |
| `v1.5.2` | Se muestra el logo del negocio, y el service worker deja de guardar la API |
| `v1.6.0` | Módulo 6: escaneos, visitas y clics reales en el panel |

## API disponible

Base: `http://localhost:3000/api`

| Método | Endpoint | Acceso | Operación |
|---|---|---|---|
| GET | `/health` | Público | Comprobación del servidor |
| GET | `/publico/:slug` | Público | Perfil y contenido visible (lo que ve quien escanea) |
| POST | `/publico/:slug/eventos` | Público | Registra un escaneo, una visita o un clic |
| POST | `/auth/registro` | Público | Registro de una empresa (rol forzado a `empresa`) |
| POST | `/auth/login` | Público | Iniciar sesión y obtener el JWT |
| POST | `/auth/logout` | Autenticado | Cerrar la sesión actual |
| POST | `/auth/recuperar-contrasena` | Público | Solicitar el enlace de recuperación |
| GET | `/auth/restablecer/:token` | Público | Comprobar que el enlace siga siendo válido |
| POST | `/auth/restablecer-contrasena` | Público | Definir la nueva contraseña |
| GET | `/usuarios/me` | Autenticado | Consultar el perfil propio |
| PUT | `/usuarios/me/contrasena` | Autenticado | Cambiar la contraseña propia |
| DELETE | `/usuarios/me` | Autenticado | Eliminar la cuenta propia |
| GET | `/perfiles/me` | Autenticado | Consultar el perfil empresarial |
| PUT | `/perfiles/me` | Autenticado | Crear o actualizar el perfil empresarial |
| GET | `/contenido` | Autenticado | Listar el contenido del perfil |
| GET | `/contenido/categorias` | Autenticado | Categorías disponibles (las 8 del RF-05) |
| POST | `/contenido` | Autenticado | Agregar un enlace, texto o botón |
| PUT | `/contenido/orden` | Autenticado | Reordenar una sección |
| PUT | `/contenido/:id` | Autenticado | Editar un bloque |
| PATCH | `/contenido/:id/estado` | Autenticado | Activar o desactivar un bloque |
| DELETE | `/contenido/:id` | Autenticado | Eliminar un bloque |
| GET | `/qr` | Autenticado | Consultar el código QR del perfil |
| POST | `/qr` | Autenticado | Generar el código QR |
| GET | `/qr/imagen` | Autenticado | Descargar el código en PNG, SVG o PDF |
| PATCH | `/qr/estado` | Autenticado | Activar o desactivar el código |
| GET | `/estadisticas` | Autenticado | Escaneos, visitas, clics y serie diaria |
| POST | `/usuarios` | Administrador | Crear usuario con cualquier rol |
| GET | `/usuarios` | Administrador | Listar usuarios activos |
| GET | `/usuarios/:idUsuario` | Administrador | Consultar un usuario |
| PUT | `/usuarios/:idUsuario` | Administrador | Actualizar nombre, correo y rol |
| PATCH | `/usuarios/:idUsuario/estado` | Administrador | Activar o restringir la cuenta |
| DELETE | `/usuarios/:idUsuario` | Administrador | Eliminación lógica |

El detalle de cada endpoint, con sus cuerpos y códigos de respuesta, está en [`docs/api.md`](docs/api.md).

Las pruebas están en `docs/postman/QR-Empresarial-Usuarios.postman_collection.json`: 170 peticiones organizadas por guía, con verificación automática del código de respuesta. Se importan en Postman y se ejecutan con **Run collection**; los dos inicios de sesión de la primera carpeta guardan los tokens que usan las demás.

### Cómo consume la API el frontend

Las pantallas no llaman a `fetch` por su cuenta. Todo pasa por
[`frontend/js/api.js`](frontend/js/api.js), que concentra cuatro cosas:

- **La dirección de la API.** Si la página se sirve desde el puerto 3000 usa una
  ruta relativa; si se sirve desde otro puerto (`http-server` en el 4173, Live
  Server en el 5500) apunta al backend. Se puede fijar a mano con
  `window.QR_API_URL`.
- **La sesión.** El token y los datos de la cuenta van a `localStorage` si se
  marcó «Mantenerme conectado», y a `sessionStorage` si no, que se borra al
  cerrar la pestaña.
- **El token.** Se adjunta como `Authorization: Bearer` en las peticiones que lo
  necesitan.
- **Los errores.** Llegan como un `ErrorApi` con el código HTTP, de modo que la
  pantalla distingue un 401 de un 409 sin leer el texto del mensaje. Cuando no
  hay respuesta —servidor apagado— el código es 0 y se avisa en pantalla en
  lugar de quedarse callado.

Las pantallas privadas cargan además
[`frontend/js/guardia.js`](frontend/js/guardia.js), que hace dos comprobaciones
distintas: sin token guardado sale de inmediato, y con token pregunta al
servidor, porque el navegador no se entera si la cuenta fue restringida, si el
token venció o si se cerró la sesión desde otro dispositivo. Un 401 en cualquier
petición borra la sesión y devuelve al login con el aviso correspondiente.

| Pantalla | Qué consume |
|---|---|
| `login.html` | `POST /auth/login` |
| `register.html` | `POST /auth/registro` y después `POST /auth/login` |
| `forgot-password.html` | `POST /auth/recuperar-contrasena` |
| `restablecer.html` | `GET /auth/restablecer/:token` y `POST /auth/restablecer-contrasena` |
| `dashboard`, `contenido`, `qr`, `configuracion` | `GET /usuarios/me` y `POST /auth/logout` |
| `dashboard.html` | además `GET /estadisticas` |
| `configuracion.html` | además `PUT /usuarios/me/contrasena`, `DELETE /usuarios/me` y `PUT /perfiles/me` |
| Toda pantalla privada | `GET /perfiles/me` al cargar, para traer los datos del negocio |
| `contenido.html` | `GET/POST/PUT/PATCH/DELETE /contenido`, `GET /contenido/categorias` y `PUT /contenido/orden` |
| `qr.html` | `GET/POST /qr` y `GET /qr/imagen` |
| `public.html` | `GET /publico/:slug` y `POST /publico/:slug/eventos`, sin token |
| `menu.html` | `GET /publico/:slug`, sin token (la sección «menu» del perfil) |

Los datos del negocio ya vienen del servidor: `js/guardia.js` consulta
`GET /perfiles/me` al abrir cualquier pantalla privada y los deja en el almacén
local, que pasó de ser la fuente de verdad a ser una caché. Así el dashboard, el
código QR y la barra lateral siguieron funcionando sin cambios.

La vista pública se sirve en `/p/{slug}`, que es la dirección que llevan
codificada los códigos QR, y pide los datos a `GET /api/publico/:slug` sin token.
El color, el tamaño y el formato elegidos en la pantalla del código QR sí siguen
en `localStorage`, y ahí se quedan: son preferencias de quien mira esa pantalla,
no datos del negocio. Y
los seis endpoints de administración de usuarios no tienen pantalla: son el
módulo 8 (RF-13 a RF-15).

### Seguridad

- Las contraseñas se guardan cifradas con bcrypt (10 rondas) y nunca viajan en las respuestas.
- El token JWT contiene el `id` y el `rol`, se firma con `JWT_SECRET` y vence a las 2 horas.
- En cada petición protegida se consulta el estado de la cuenta: si fue restringida o eliminada, el token deja de servir de inmediato.
- El registro público siempre asigna el rol `empresa`; crear administradores es exclusivo de `POST /api/usuarios`.

## Stack tecnológico

| Capa | Tecnología | Estado |
|---|---|---|
| Backend | Node.js 22 LTS + Express 5 | En uso |
| Base de datos | MySQL 8.0 con `mysql2` y consultas parametrizadas | En uso |
| Frontend | HTML5, CSS3 y JavaScript ES2022, sin framework (PWA) | En uso |
| Seguridad | `bcrypt` (contraseñas) | En uso |
| Seguridad | `jsonwebtoken` (JWT y middlewares de rol) | En uso |
| Seguridad | `express-rate-limit` (límite de intentos, RN-03) | En uso |
| Seguridad | `cors` (origen de las peticiones del frontend) | En uso |
| Seguridad | `helmet` y `zod` | Previsto |
| Correo | `nodemailer`; cuenta de prueba de Ethereal en desarrollo | En uso |
| QR | `qrcode` (servidor, descargas) y `qrcode.min.js` (navegador, vista previa) | En uso |
| PDF | `pdfkit`, para la descarga del código en PDF (RF-08) | En uso |
| Gráficos | `chart.js` | En uso |
| Pruebas | Postman; Jest + Supertest (API) y Playwright + axe-core (E2E) | Parcial |
| Calidad | ESLint, Prettier, EditorConfig, Lighthouse | Previsto |
| Versionamiento | Git + GitHub | En uso |
| Despliegue | Ubuntu Server 24.04, Nginx, PM2, Let's Encrypt (SSL) | Previsto |

**¿Por qué este stack?** Un solo lenguaje (JavaScript) en frontend, backend y pruebas. Además, reutiliza el esquema MySQL que ya existe y el frontend que ya está construido, y encaja con el diagrama de despliegue en VPS.

## Módulos y orden de desarrollo

| Sprint | Fechas (2026) | Módulo | Requisitos | Estado |
|---|---|---|---|---|
| 0 | 22/09 – 28/09 | Configuración: repositorio, Express base, conexión MySQL, migraciones | — | Terminado |
| 1 | 29/09 – 05/10 | M1. Usuarios y cuentas (CRUD que usará el módulo 8) | RF-01 | Terminado |
| 1 | 06/10 – 13/10 | M1. Autenticación, registro público, cierre de sesión, recuperación y cambio de contraseña | RF-01, RF-02, RF-03 | Terminado |
| 2 | 14/10 – 20/10 | M2. Perfil empresarial | RF-04, RF-10 | Terminado |
| 3 | 20/10 – 26/10 | M3. Gestión de contenido (enlaces, textos, botones) | RF-05, RF-06 | Terminado |
| 4 | 27/10 – 02/11 | M4. Código QR dinámico + M5. Vista pública | RF-07, RF-08, RF-09 | Terminado |
| 5 | 03/11 – 09/11 | M6. Estadísticas (terminado) + M7. Configuración | RF-11, RF-12 | En curso |
| 6 | 10/11 – 16/11 | M8. Administración | RF-13 a RF-15 | Pendiente |
| 7 | 17/11 – 23/11 | Pruebas de integración, aceptación y seguridad | Todos | Pendiente |
| 8 | 24/11 – 18/12 | Despliegue, manuales y cierre | — | Pendiente |

El orden sigue las dependencias entre módulos (usuario → perfil → contenido → QR). Así, el flujo principal queda completo al final del sprint 4.

El CRUD de usuarios del sprint 1 es la base que consumirán los requisitos RF-13 a RF-15, pero esos requisitos pertenecen al **módulo 8** y se abordan en el sprint 6: todavía falta la actividad de los usuarios (RF-13), las pantallas de administración (RF-13 y RF-14) y los reportes descargables (RF-15).

### Reglas de negocio aplicadas

- **RN-01** El correo es único entre las cuentas activas.
- **RN-02** La contraseña tiene mínimo 8 caracteres, con mayúscula, número y símbolo, y se guarda cifrada con bcrypt (10 rondas).
- **RN-03** El inicio de sesión se bloquea 15 minutos tras 5 intentos fallidos desde la misma IP; los inicios correctos no gastan cupo. La solicitud de recuperación lleva su propio contador (10 por 15 minutos, contando todas), para que agotar uno no inhabilite el otro.
- **El logo del negocio se muestra** en la vista pública y en la barra lateral del panel. Si no hay logo, o si la dirección deja de servir, se usa el dibujo genérico o las iniciales: la imagen la escribe una persona y puede caducar.
- **El service worker no guarda las respuestas de la API.** Solo las pantallas. Son datos de una cuenta concreta, y en un equipo compartido sin conexión la caché habría devuelto los de quien usó el navegador antes.
- **Ninguna pantalla pública muestra datos de ejemplo.** La del menú mostraba los platos y precios de un negocio de muestra a cualquier visitante; ahora enseña los bloques que el negocio publicó en la sección «menu» de su panel, y su botón se oculta si esa sección está vacía.
- **Un escaneo se distingue de una visita directa.** La imagen del código lleva `?qr=1` y el enlace que se comparte no, así que la vista pública sabe por dónde llegó la persona. Son dos de las tres medidas del RF-11; la tercera son los clics en enlaces.
- **Las estadísticas no identifican a quien visita.** No se guarda ni la IP ni nada parecido, así que se cuentan visitas, no visitantes únicos. El RF-11 pide «visitas al perfil».
- **La vista pública se apaga, no se borra.** Deja de responder si el código QR fue desactivado o si la cuenta dueña está restringida, y en los tres casos —incluido el perfil inexistente— devuelve lo mismo: decir «existe pero está suspendido» no es asunto de quien escanea.
- **Un código QR por perfil, y no se regenera.** La base lo garantiza con un `UNIQUE` sobre `id_perfil` (RF-07). Pedirlo otra vez devuelve el mismo: cambiar su dirección invalidaría los códigos ya impresos.
- **No se genera un código para un perfil vacío.** Hace falta al menos un bloque de contenido activo. Un código que lleva a una página en blanco es peor que no tener código: quien lo escanea se queda sin saber si el negocio existe.
- **El contenido se reordena arrastrando o con el teclado.** El asa de cada bloque es un botón enfocable: con las flechas arriba y abajo también se mueve. Arrastrar es cómodo con el ratón e imposible sin él, así que ofrecer solo esa vía dejaría fuera a quien no pueda usarlo.
- **Desactivar no es borrar.** Un bloque de contenido inactivo sigue en el panel y deja de aparecer en la vista pública (RF-06). Sirve para una promoción que vuelve cada temporada, sin volver a escribirla.
- **Los enlaces solo admiten `http` y `https`.** Un `javascript:` guardado como enlace acabaría ejecutándose en la vista pública. El WhatsApp es la excepción: acepta un teléfono y se guarda convertido en `https://wa.me/<dígitos>`.
- **RN-04** El enlace de recuperación sirve una sola vez y expira en 30 minutos. En la base solo se guarda su hash SHA-256: aunque alguien leyera la tabla, no podría reconstruir el enlace.
- **Cambio de contraseña:** al restablecerla o cambiarla se cierran todas las sesiones de la cuenta. Quien recupera su cuenta suele hacerlo porque perdió el control de ella, así que las sesiones abiertas antes del cambio dejan de servir. Al cambiarla desde Configuración se devuelve un token nuevo, para no echar de la pantalla a quien la cambió.
- **RN-22** El módulo de administración es exclusivo del rol `administrador`; los demás reciben 403.
- **RN-23** Una cuenta puede quedar `activo` o `restringido`; una restringida no puede iniciar sesión ni seguir usando tokens emitidos antes.
- **Eliminación lógica:** al borrar un usuario se marca `deleted_at` y su correo se prefija con `eliminado_<id>_`, para liberar la dirección sin perder el historial ni romper las claves foráneas. La puede pedir el administrador o el propio dueño de la cuenta, confirmando su contraseña. Un administrador no puede eliminarse a sí mismo: si fuera el único, nadie podría volver a administrar el sistema.

- **Un perfil por cuenta.** La columna `id_usuario` de `perfil_empresarial` es única, y de eso depende el RF-07: un código QR por perfil.
- **La dirección pública no cambia.** El `slug` se fija al crear el perfil y no sigue al nombre del negocio. Si cambiara, los códigos QR ya impresos dejarían de funcionar, que es justo lo que el RF-09 debe evitar.
- **RF-10** Antes de guardar se exige el nombre del negocio y se valida el formato del correo de contacto, del usuario de Instagram y de la URL de la imagen. De las URL solo se aceptan `http` y `https`: un enlace `javascript:` en la vista pública sería un agujero de seguridad.

### Reglas previstas

- Un único QR por perfil activo, con URL fija `/p/{slug}`, generado solo si el perfil tiene contenido activo.
- URL válidas (http/https); no se puede eliminar el último enlace activo.

## Base de datos

Esquema `qr_empresarial` con 10 tablas: `usuario`, `perfil_empresarial`, `codigo_qr`, `enlace`, `elemento`, `categoria_enlace`, `categoria_elemento`, `evento`, `token_recuperacion` y `sesion_revocada`.

| Migración | Cambio |
|---|---|
| `001-agregar-rol-slug-evento.sql` | Campos `rol` y `estado` en `usuario`, `slug` en `perfil_empresarial` y tabla `evento` |
| `002-renombrar-columna-contrasena.sql` | `contraseña` → `contrasena`, para evitar caracteres no ASCII en el código |
| `003-agregar-deleted-at-usuario.sql` | Columna `deleted_at` y valor por defecto para `fecha_registro` |
| `004-crear-token-recuperacion.sql` | Tabla `token_recuperacion` para el enlace de recuperación (RF-03) |
| `005-crear-sesion-revocada.sql` | Tabla `sesion_revocada`, que permite cerrar sesión en el servidor (RF-02) |
| `006-agregar-sesiones-validas-desde.sql` | Columna `sesiones_validas_desde` en `usuario`, para cerrar todas las sesiones de una cuenta de una vez |
| `007-ampliar-perfil-empresarial.sql` | Seis campos más en `perfil_empresarial`, fechas automáticas y un perfil único por cuenta |
| `008-ampliar-contenido.sql` | Secciones y título en el contenido, y las tres categorías de enlace que faltaban del RF-05 |
| `009-corregir-fechas-codigo-qr.sql` | Fechas automáticas y estado por defecto en `codigo_qr` |
| `010-preparar-eventos.sql` | Fecha automática e índices en `evento`, para las estadísticas |

## Estructura de carpetas

```text
qr-empresarial/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # pool de conexiones a MySQL
│   │   ├── middlewares/
│   │   │   ├── error.middleware.js  # manejo centralizado de errores
│   │   │   ├── auth.middleware.js   # verifica el token JWT
│   │   │   ├── rol.middleware.js    # autorizacion por rol
│   │   │   └── limite.middleware.js # limite de intentos (RN-03)
│   │   ├── modules/
│   │   │   ├── usuarios/            # route, validator, controller, service, repository
│   │   │   ├── auth/                # login, registro publico y recuperacion
│   │   │   ├── perfiles/            # route, validator, controller, service, repository
│   │   │   ├── contenido/           # route, validator, controller, service, repository
│   │   │   ├── qr/                  # route, validator, controller, service, repository
│   │   │   ├── publico/             # route, controller, service, repository
│   │   │   ├── estadisticas/        # route, validator, controller, service, repository
│   │   │   ├── configuracion/       # pendiente
│   │   │   └── admin/               # pendiente
│   │   ├── utils/
│   │   │   └── correo.js            # envio de correo con nodemailer
│   │   ├── app.js                   # configuración de Express
│   │   └── server.js                # arranque del servidor
│   ├── .env                         # no se versiona
│   ├── .env.example
│   └── package.json
├── frontend/                        # HTML, css/, js/, js/vendor/, assets/, tests/ (Playwright)
│   ├── js/api.js                    # cliente de la API y manejo de la sesion
│   ├── js/guardia.js                # protege las pantallas privadas
│   └── restablecer.html             # pantalla del enlace de recuperacion
├── database/
│   ├── schema.sql
│   └── migrations/
├── docs/
│   ├── api.md
│   ├── control-versiones.md
│   └── postman/                     # colección de pruebas
├── .editorconfig
├── .gitignore
└── README.md
```

Cada módulo agrupa sus cinco capas en una carpeta propia:

```text
Route → Validator → Controller → Service → Repository → MySQL
```

- **Route:** a qué endpoint llega la petición y en qué orden se ejecutan los validadores.
- **Validator:** formato de los datos; no consulta la base.
- **Controller:** recibe la petición y arma la respuesta; sin reglas ni SQL.
- **Service:** reglas de negocio; no conoce `req` ni `res`.
- **Repository:** única capa con consultas SQL.

## Estándares de codificación

| Elemento | Convención | Ejemplo |
|---|---|---|
| Variables | camelCase | `nombreNegocio` |
| Booleanos | prefijo `es` / `tiene` / `puede` | `esActivo`, `tieneQr` |
| Constantes | UPPER_SNAKE_CASE | `ROLES_VALIDOS` |
| Clases | PascalCase + sufijo de capa | `PerfilService` |
| Métodos y funciones | camelCase con verbo | `crearUsuario()`, `buscarPorId()` |
| Archivos JS | kebab-case + sufijo de capa | `usuario.service.js` |
| Tablas y columnas SQL | snake_case singular | `perfil_empresarial.id_perfil` |
| Rutas API | kebab-case, plural | `/api/usuarios/:idUsuario/estado` |
| CSS / HTML | kebab-case | `.qr-card`, `#qr-canvas`, `--color-primary` |

- **Formato:** 2 espacios, comillas dobles, punto y coma, líneas de máximo 100 caracteres, UTF-8 con saltos LF. `const` por defecto; `var` no se usa; `async/await` con manejo central de errores.
- **Idioma:** identificadores del dominio y comentarios en español; las librerías conservan sus nombres en inglés.
- **Comentarios:** bloque de encabezado por archivo, JSDoc en funciones públicas, comentarios que explican el *porqué*; pendientes como `// TODO(autor): ...`.
- **Git:** ramas `main` y `feature/<modulo>-<descripcion>`, [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), fusión con `--no-ff` y una etiqueta `v0.x.0` por etapa.

## Puesta en marcha

```bash
# 1. Base de datos
mysql -u root -p < database/schema.sql
mysql -u root -p qr_empresarial < database/migrations/001-agregar-rol-slug-evento.sql
mysql -u root -p qr_empresarial < database/migrations/002-renombrar-columna-contrasena.sql
mysql -u root -p qr_empresarial < database/migrations/003-agregar-deleted-at-usuario.sql
mysql -u root -p qr_empresarial < database/migrations/004-crear-token-recuperacion.sql
mysql -u root -p qr_empresarial < database/migrations/005-crear-sesion-revocada.sql
mysql -u root -p qr_empresarial < database/migrations/006-agregar-sesiones-validas-desde.sql
mysql -u root -p qr_empresarial < database/migrations/007-ampliar-perfil-empresarial.sql
mysql -u root -p qr_empresarial < database/migrations/008-ampliar-contenido.sql
mysql -u root -p qr_empresarial < database/migrations/009-corregir-fechas-codigo-qr.sql
mysql -u root -p qr_empresarial < database/migrations/010-preparar-eventos.sql

# 2. Backend
cd backend
npm install
cp .env.example .env      # completar DB_PASSWORD y generar JWT_SECRET
npm run dev               # servidor con nodemon en http://localhost:3000

# 3. Comprobación
# GET  http://localhost:3000/api/health  →  {"status":"ok"}
# Abra http://localhost:3000/login.html  →  la aplicación completa

# 4. Pruebas del frontend
cd ../frontend
npm install
npx playwright install chromium
npm test                  # no necesita el backend encendido: simula la API
```

El backend publica también las pantallas, así que **toda la aplicación vive en
`http://localhost:3000`**: no hace falta un segundo servidor. Esto importa para
el RF-03, porque el enlace del correo de recuperación apunta a ese mismo origen.

Si prefiere servir el frontend aparte (Live Server, `http-server`), funciona
igual: `js/api.js` detecta que no está en el puerto 3000 y apunta al backend, y
el backend autoriza esas peticiones por CORS. Para fijar otra dirección de la
API, defina `window.QR_API_URL` antes de cargar `js/api.js`.

Variables de entorno (`backend/.env`): `PORT`, `DB_HOST`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `APP_URL`,
`RECUPERACION_EXPIRA_MINUTOS`, `CORS_ORIGINS` y las `SMTP_*` del envío de
correo. El secreto se genera con el comando que aparece como comentario en
`.env.example`. Sin `SMTP_*`, y fuera de producción, el enlace de recuperación
se envía a una cuenta de prueba de Ethereal y su URL queda en la consola. El
archivo `.env` nunca se versiona; use `.env.example` como plantilla.

## Autor

Jean Carlos Orozco Hernández — SENA, CGMLTI, Bogotá D.C., 2026.
