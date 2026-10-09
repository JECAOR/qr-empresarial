# QR Empresarial

Aplicación web responsive que permite a pymes y emprendedores crear un **perfil empresarial digital** y compartirlo mediante un **código QR dinámico**. El QR apunta siempre a la misma URL, así que la información se puede actualizar sin volver a imprimir el código.

> Proyecto formativo — Tecnología en Análisis y Desarrollo de Software (SENA, ficha 3336250).
> El análisis y la planeación están en `Documento_Proyecto_ADSO`; las decisiones técnicas, en `Plan_de_desarrollo_QR_Empresarial.docx`.

## Estado del proyecto

| Parte | Estado |
|---|---|
| Análisis y diseño (requisitos, casos de uso, modelo relacional, prototipos) | Terminado |
| Base de datos MySQL `qr_empresarial` (8 tablas, 3 migraciones) | Implementada |
| Frontend HTML/CSS/JS (11 pantallas, PWA, pruebas Playwright) | Implementado con datos en `localStorage` |
| Backend — entorno y servidor Express | Terminado (`v0.2.0`) |
| Backend — módulo Usuarios (CRUD completo) | Terminado (`v0.4.0`) |
| Backend — autenticación, perfiles, contenido, QR, estadísticas y administración | Pendiente |

### Versiones publicadas

| Etiqueta | Contenido |
|---|---|
| `v0.1.0` | Repositorio, estructura del proyecto y esquema de base de datos |
| `v0.2.0` | Proyecto Node, estructura del backend y servidor Express con `/api/health` |
| `v0.3.0` | `POST /api/usuarios` con arquitectura por capas |
| `v0.4.0` | CRUD completo del módulo Usuarios y colección de Postman |

## API disponible

Base: `http://localhost:3000/api`

| Método | Endpoint | Operación | Respuestas |
|---|---|---|---|
| GET | `/health` | Comprobación del servidor | 200 |
| POST | `/usuarios` | Crear usuario | 201, 400, 409 |
| GET | `/usuarios` | Listar usuarios activos | 200 |
| GET | `/usuarios/:idUsuario` | Consultar un usuario | 200, 400, 404 |
| PUT | `/usuarios/:idUsuario` | Actualizar nombre, correo y rol | 200, 400, 404, 409 |
| PATCH | `/usuarios/:idUsuario/estado` | Activar o restringir la cuenta | 200, 400, 404 |
| DELETE | `/usuarios/:idUsuario` | Eliminación lógica | 200, 400, 404 |

Las pruebas de estos endpoints están en `docs/postman/QR-Empresarial-Usuarios.postman_collection.json`: 21 peticiones organizadas en tres carpetas, con verificación automática del código de respuesta. Se importan en Postman y se ejecutan con **Run collection**.

## Stack tecnológico

| Capa | Tecnología | Estado |
|---|---|---|
| Backend | Node.js 22 LTS + Express 5 | En uso |
| Base de datos | MySQL 8.0 con `mysql2` y consultas parametrizadas | En uso |
| Frontend | HTML5, CSS3 y JavaScript ES2022, sin framework (PWA) | En uso |
| Seguridad | `bcrypt` (contraseñas) | En uso |
| Seguridad | `jsonwebtoken`, `helmet`, `cors`, `express-rate-limit`, `zod` | Previsto |
| QR | `qrcode` (servidor) y `qrcode.min.js` (navegador) | Previsto / en uso |
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
| 1 | 29/09 – 05/10 | M1. Usuarios y cuentas | RF-01, RF-13 a RF-15 | Terminado |
| 1 | 06/10 – 12/10 | M1. Autenticación (JWT, recuperación) | RF-02, RF-03 | En curso |
| 2 | 13/10 – 19/10 | M2. Perfil empresarial | RF-04, RF-10 | Pendiente |
| 3 | 20/10 – 26/10 | M3. Gestión de contenido (enlaces, textos, botones) | RF-05, RF-06 | Pendiente |
| 4 | 27/10 – 02/11 | M4. Código QR dinámico + M5. Vista pública | RF-07, RF-08, RF-09 | Pendiente |
| 5 | 03/11 – 09/11 | M6. Estadísticas + M7. Configuración | RF-11, RF-12 | Pendiente |
| 6 | 10/11 – 16/11 | M8. Administración | RF-13 a RF-15 | Pendiente |
| 7 | 17/11 – 23/11 | Pruebas de integración, aceptación y seguridad | Todos | Pendiente |
| 8 | 24/11 – 18/12 | Despliegue, manuales y cierre | — | Pendiente |

El orden sigue las dependencias entre módulos (usuario → perfil → contenido → QR). Así, el flujo principal queda completo al final del sprint 4.

### Reglas de negocio aplicadas

- **RN-01** El correo es único entre las cuentas activas.
- **RN-02** La contraseña tiene mínimo 8 caracteres, con mayúscula, número y símbolo, y se guarda cifrada con bcrypt (10 rondas).
- **RN-23** Una cuenta puede quedar `activo` o `restringido`; una restringida no podrá iniciar sesión.
- **Eliminación lógica:** al borrar un usuario se marca `deleted_at` y su correo se prefija con `eliminado_<id>_`, para liberar la dirección sin perder el historial ni romper las claves foráneas.

### Reglas previstas

- Bloqueo del inicio de sesión durante 15 minutos tras 5 intentos fallidos.
- Un único QR por perfil activo, con URL fija `/p/{slug}`, generado solo si el perfil tiene contenido activo.
- URL válidas (http/https); no se puede eliminar el último enlace activo.
- Módulo de administración exclusivo del rol `administrador`.

## Base de datos

Esquema `qr_empresarial` con 8 tablas: `usuario`, `perfil_empresarial`, `codigo_qr`, `enlace`, `elemento`, `categoria_enlace`, `categoria_elemento` y `evento`.

| Migración | Cambio |
|---|---|
| `001-agregar-rol-slug-evento.sql` | Campos `rol` y `estado` en `usuario`, `slug` en `perfil_empresarial` y tabla `evento` |
| `002-renombrar-columna-contrasena.sql` | `contraseña` → `contrasena`, para evitar caracteres no ASCII en el código |
| `003-agregar-deleted-at-usuario.sql` | Columna `deleted_at` y valor por defecto para `fecha_registro` |

Pendiente: `token_recuperacion`, para la recuperación de contraseña (RF-03).

## Estructura de carpetas

```text
qr-empresarial/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # pool de conexiones a MySQL
│   │   ├── middlewares/
│   │   │   └── error.middleware.js  # manejo centralizado de errores
│   │   ├── modules/
│   │   │   ├── usuarios/            # route, validator, controller, service, repository
│   │   │   ├── auth/                # pendiente
│   │   │   ├── perfiles/            # pendiente
│   │   │   ├── contenido/           # pendiente
│   │   │   ├── qr/                  # pendiente
│   │   │   ├── publico/             # pendiente
│   │   │   ├── estadisticas/        # pendiente
│   │   │   ├── configuracion/       # pendiente
│   │   │   └── admin/               # pendiente
│   │   ├── utils/
│   │   ├── app.js                   # configuración de Express
│   │   └── server.js                # arranque del servidor
│   ├── .env                         # no se versiona
│   ├── .env.example
│   └── package.json
├── frontend/                        # HTML, css/, js/, js/vendor/, assets/, tests/ (Playwright)
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

# 2. Backend
cd backend
npm install
cp .env.example .env      # completar DB_PASSWORD con la contraseña local de MySQL
npm run dev               # servidor con nodemon en http://localhost:3000

# 3. Comprobación
# GET http://localhost:3000/api/health  →  {"status":"ok"}

# 4. Frontend (pruebas E2E existentes)
cd ../frontend
npm install
npx playwright install chromium
npm test
```

Variables de entorno (`backend/.env`): `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `DB_PORT`. El archivo nunca se versiona; use `.env.example` como plantilla.

## Autor

Jean Carlos Orozco Hernández — SENA, CGMLTI, Bogotá D.C., 2026.
