# QR Empresarial

Aplicación web responsive que permite a pymes y emprendedores crear un **perfil empresarial digital** y compartirlo mediante un **código QR dinámico**. El QR apunta siempre a la misma URL, así que la información se puede actualizar sin volver a imprimir el código.

> Proyecto formativo — Tecnología en Análisis y Desarrollo de Software (SENA, ficha 3336250).
> Evidencia GA7-220501096-AA1-EV02: plan de desarrollo, tecnologías y estándares de codificación.
> El detalle completo está en `Plan_de_desarrollo_QR_Empresarial.docx`.

## Estado del proyecto

| Parte | Estado |
|---|---|
| Análisis y diseño (requisitos, casos de uso, modelo relacional, prototipos) | Terminado |
| Base de datos MySQL `qr_empresarial` (7 tablas) | Implementada |
| Frontend HTML/CSS/JS (11 pantallas, PWA, pruebas Playwright) | Implementado con datos en `localStorage` |
| Backend (API REST) | Por construir (sprints 0 a 6) |

## Stack tecnológico ratificado

| Capa | Tecnología |
|---|---|
| Backend | Node.js 22 LTS + Express 5 |
| Base de datos | MySQL 8.0 (conector `mysql2`, consultas parametrizadas) |
| Frontend | HTML5, CSS3 y JavaScript ES2022, sin framework (PWA) |
| Seguridad | `bcrypt`, `jsonwebtoken` en cookie httpOnly, `helmet`, `cors`, `express-rate-limit`, validación con `zod` |
| QR | `qrcode` (servidor) y `qrcode.min.js` (navegador) |
| Gráficos | `chart.js` |
| Pruebas | Jest + Supertest (API), Playwright + axe-core (E2E y accesibilidad) |
| Calidad | ESLint, Prettier, EditorConfig, Lighthouse |
| Versionamiento | Git + GitHub, GitHub Actions |
| Despliegue | Ubuntu Server 24.04, Nginx, PM2, Let's Encrypt (SSL) |

**¿Por qué este stack?** Un solo lenguaje (JavaScript) en frontend, backend y pruebas. Además, reutiliza el esquema MySQL que ya existe y el frontend que ya está construido, y encaja con el diagrama de despliegue en VPS.

## Módulos y orden de desarrollo

| Sprint | Fechas (2026) | Módulo | Requisitos |
|---|---|---|---|
| 0 | 22/09 – 28/09 | Configuración: repositorio, Express base, conexión MySQL, migraciones | — |
| 1 | 29/09 – 05/10 | M1. Autenticación y cuentas | RF-01, RF-02, RF-03 |
| 2 | 06/10 – 12/10 | M2. Perfil empresarial | RF-04, RF-10 |
| 3 | 13/10 – 19/10 | M3. Gestión de contenido (enlaces, textos, botones) | RF-05, RF-06 |
| 4 | 20/10 – 26/10 | M4. Código QR dinámico + M5. Vista pública | RF-07, RF-08, RF-09 |
| 5 | 27/10 – 02/11 | M6. Estadísticas + M7. Configuración | RF-11, RF-12 |
| 6 | 03/11 – 09/11 | M8. Administración | RF-13, RF-14, RF-15 |
| 7 | 10/11 – 16/11 | Pruebas de integración, aceptación y seguridad | Todos |
| 8 | 17/11 – 18/12 | Despliegue, manuales y cierre | — |

El orden sigue las dependencias entre módulos (usuario → perfil → contenido → QR). Así, el flujo principal queda completo al final del sprint 4.

### Reglas de negocio clave

- El correo es único y la contraseña (mínimo 8 caracteres, con mayúscula, número y símbolo) se guarda cifrada con bcrypt.
- Después de 5 intentos fallidos, el inicio de sesión se bloquea durante 15 minutos.
- Hay **un único QR por perfil activo**. Codifica la URL fija `/p/{slug}` y solo se genera si el perfil tiene contenido activo.
- Las URL deben ser válidas (http/https). No se puede eliminar el último enlace activo, y toda eliminación pide confirmación.
- El módulo de administración es exclusivo del rol `admin`.

### Ajustes previstos al modelo de datos

- `usuario`: nuevos campos `rol` y `estado`.
- `perfil_empresarial`: nuevo campo `slug` (único).
- Tablas nuevas: `evento` (escaneos, visitas y clics) y `token_recuperacion`.

## Estructura orientada a objetos

- **Entidades:** `Usuario`, `Administrador extends Usuario`, `PerfilEmpresarial`, `CodigoQR`, `Enlace`, `Elemento` (abstracta) → `ElementoTexto` / `ElementoBoton`, `CategoriaEnlace`, `CategoriaElemento`, `Evento`.
- **Capas:**
  - `Database` (Singleton)
  - `BaseRepository` → `*Repository`
  - `*Service` (reglas de negocio)
  - `*Controller` (HTTP)
  - middlewares `autenticar`, `autorizarRol`, `validar` y `manejarErrores`
- **Principios:**
  - encapsulamiento (`#contrasenaHash`)
  - herencia (`Administrador`, repositorios)
  - polimorfismo (`renderizar()` en los elementos)
  - responsabilidad única por capa

## Estructura de carpetas

```text
qr-empresarial/
├── backend/
│   ├── src/
│   │   ├── config/         # database.js, env.js
│   │   ├── models/         # usuario.model.js ...
│   │   ├── repositories/   # base.repository.js ...
│   │   ├── services/       # auth.service.js, qr.service.js ...
│   │   ├── controllers/    # auth.controller.js ...
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── validators/     # esquemas zod
│   │   ├── utils/
│   │   └── app.js
│   ├── tests/              # unit/ e integration/ (Jest + Supertest)
│   ├── .env.example
│   └── server.js
├── frontend/               # HTML, css/, js/, js/vendor/, assets/, tests/ (Playwright)
├── database/               # schema.sql, migrations/, seed.sql
├── docs/                   # documento del proyecto, diagramas, api.md
├── .editorconfig
├── eslint.config.js
├── .prettierrc
└── README.md
```

## Estándares de codificación

| Elemento | Convención | Ejemplo |
|---|---|---|
| Variables | camelCase | `nombreNegocio` |
| Booleanos | prefijo `es` / `tiene` / `puede` | `esActivo`, `tieneQr` |
| Constantes | UPPER_SNAKE_CASE | `MAX_INTENTOS_LOGIN` |
| Clases | PascalCase + sufijo de capa | `PerfilService` |
| Métodos y funciones | camelCase con verbo | `crearPerfil()`, `generarQr()` |
| Archivos JS | kebab-case + sufijo de capa | `perfil.service.js` |
| Tablas y columnas SQL | snake_case singular | `perfil_empresarial.id_perfil` |
| Rutas API | kebab-case, plural | `/api/perfiles/:idPerfil/enlaces` |
| CSS / HTML | kebab-case | `.qr-card`, `#qr-canvas`, `--color-primary` |

- **Formato:**
  - 2 espacios, comillas dobles, punto y coma y líneas de máximo 100 caracteres (Prettier)
  - `const` por defecto; `var` no se usa
  - `async/await`
  - UTF-8 con saltos de línea LF
- **Idioma:** identificadores del dominio y comentarios en español; las librerías conservan sus nombres en inglés.
- **Comentarios y documentación:**
  - bloque de encabezado en cada archivo (`// ====` NOMBRE.JS — propósito)
  - JSDoc (`@param`, `@returns`, `@throws`) en clases y métodos públicos
  - los comentarios explican el *porqué*
  - sin código comentado; los pendientes se marcan como `// TODO(autor): ...`
- **Git:**
  - ramas `main`, `develop`, `feature/<modulo>-<descripcion>` y `fix/<descripcion>`
  - commits con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), por ejemplo `feat(auth): agrega inicio de sesión con JWT`
  - una etiqueta `v0.x.0` por sprint y `v1.0.0` para la entrega

## Comandos previstos

```bash
# Backend
cd backend
npm install
cp .env.example .env      # configurar credenciales de MySQL y JWT_SECRET
npm run dev               # servidor con nodemon
npm test                  # Jest + Supertest
npm run lint              # ESLint

# Base de datos
mysql -u root -p < database/schema.sql

# Frontend (pruebas E2E existentes)
cd frontend
npm install
npx playwright install chromium
npm test
```

## Autor

Jean Carlos Orozco Hernández — SENA, CGMLTI, Bogotá D.C., 2026.
