# Evidencias del proyecto

Carpeta de entrega. Reúne, en un solo sitio, los cuatro elementos que pide el
proyecto formativo y dice de dónde sale cada uno.

> QR Empresarial — Tecnólogo en Análisis y Desarrollo de Software, SENA, ficha 3336250.
> JCOH. Repositorio: <https://github.com/JECAOR/qr-empresarial>

## Los cuatro elementos

| Lo que se pide | Dónde está |
|---|---|
| Código fuente en un repositorio Git | El repositorio completo: `backend/`, `frontend/`, `database/` y `docs/`. En GitHub, en el enlace de arriba |
| Historial de commits que evidencie el proceso | [`historial-commits.txt`](historial-commits.txt), y el mismo historial vivo en GitHub |
| Evidencia de funcionamiento de los módulos | [`capturas/`](capturas), [`pruebas-backend.txt`](pruebas-backend.txt) y [`pruebas-frontend.txt`](pruebas-frontend.txt) |
| README con descripción, tecnologías y módulos | [`README.md`](../../README.md) en la raíz |

## Qué hay en cada archivo

### `capturas/` — las pantallas funcionando

Catorce capturas, numeradas en el orden en que se recorre la aplicación.

| | Pantalla | Módulo |
|---|---|---|
| 01 | Inicio de sesión | M1 |
| 02 | Registro | M1 |
| 03 | Recuperar contraseña | M1 |
| 04 | Enlace de restablecimiento inválido | M1 |
| 05 | Página 404 | M1 |
| 06 | Panel con estadísticas | M6 |
| 07 | Gestión de contenido | M3 |
| 08 | Código QR | M4 |
| 09 | Configuración | M7 |
| 10 | Vista pública en móvil | M5 |
| 11 | Menú en móvil | M5 |
| 12 | Administración | M8 |
| 13 | Detalle de una cuenta | M8 |
| 14 | Panel en móvil | — diseño adaptable |

No son capturas hechas a mano: las toma
[`generar-capturas.js`](generar-capturas.js), que abre un navegador, entra con
una cuenta de verdad y recorre las pantallas. **Contra el servidor real, no
contra la API simulada de las pruebas**: lo que se ve en las imágenes sale de
MySQL. Una pantalla dibujada con datos inventados no demuestra nada.

Para volver a generarlas:

```bash
mysql -u root -p qr_empresarial < database/seed.sql
cd backend && npm run dev
node docs/evidencias/generar-capturas.js
```

Los datos son los que siembra `database/seed.sql`: la panadería de
demostración, su contenido, su código QR y la actividad de los últimos siete
días. Las fechas de los eventos son relativas a hoy, así que la gráfica
semanal siempre tiene algo que mostrar.

### `pruebas-backend.txt` — 130 pruebas de la API

Salida de `npx jest` en `backend/`. Son pruebas de integración: cada una entra
por la ruta HTTP real, con supertest, y llega hasta MySQL. No se simula ni el
servidor ni la base de datos; lo único simulado es el envío de correo, que sí
saldría a la red.

La base `qr_empresarial_test` se borra y se reconstruye desde `schema.sql` y
las 14 migraciones en cada ejecución, así que el resultado no depende de lo
que haya quedado de una corrida anterior.

### `pruebas-frontend.txt` — 396 pruebas de las pantallas

Salida de `npx playwright test` en `frontend/`. Playwright abre cada pantalla
en Chromium y la usa como la usaría una persona. Cada prueba corre en dos
tamaños, escritorio y móvil.

Se ejecuta **sin reintentos** a propósito: una prueba que solo pasa al segundo
intento no sirve como evidencia.

### `historial-commits.txt` — el proceso de desarrollo

`git log --graph` completo: los commits, las ramas de cada módulo y las
etiquetas de versión. Se ve el orden en que se construyó el proyecto, que cada
módulo se desarrolló en su propia rama y que se integró con `merge --no-ff`
para que la rama quede en el historial en lugar de aplanarse.

El archivo se genera justo antes del commit que lo incorpora, así que sus
últimas líneas son los dos o tres commits anteriores a este. El historial
vivo y completo está en GitHub, y se regenera aquí con:

```bash
git log --graph --date=short --pretty=format:"%h %ad %d %s"
```

## Una nota sobre estas evidencias

Preparar esta carpeta encontró cuatro defectos, y los cuatro eran de lo mismo:
pantallas que afirmaban cosas sin haberlas comprobado.

- El encabezado del panel decía **«Jun 2026»** escrito a mano —en octubre
  seguía diciendo junio— y el nombre del negocio salía de la caché del
  navegador, que en uno nuevo trae los datos de ejemplo.
- La tarjeta del código en el panel decía **«QR Activo · En línea»** escrito en
  el HTML. Quien retirara su página volvía al panel y seguía leyendo que estaba
  en línea, y el saludo le decía que su perfil estaba activo.
- En la pantalla de Código QR, el botón de publicar/retirar nacía **sin texto y
  ya pulsable**: quien lo pulsara antes de que llegara la respuesta disparaba la
  acción contraria.
- La cuarta tarjeta del panel, «Tasa de conversión», quedaba **cortada contra el
  borde** en pantallas de 1366 y 1440 px.

Los cuatro se corrigieron y cada uno tiene su prueba de regresión, verificada
al revés: se deshizo la corrección y se comprobó que la prueba falla.

Las capturas de esta carpeta se tomaron **después** de corregirlos.
