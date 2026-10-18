# Pruebas automatizadas — QR Empresarial

Esta carpeta contiene la suite de pruebas del proyecto, escrita con
[Playwright Test](https://playwright.dev/). A diferencia de las pruebas que
se corrieron "a mano" durante el desarrollo (scripts sueltos, de un solo
uso), estas quedan guardadas junto con el proyecto — así que si mañana
cambias algo y rompes sin querer un flujo (el login, el registro, el
código QR...), estas pruebas te avisan.

## Instalación (solo la primera vez)

```bash
npm install
npx playwright install chromium
```

## Correr todas las pruebas

```bash
npm test
```

Esto levanta un servidor local del propio proyecto automáticamente,
corre todas las pruebas, y lo apaga al terminar — no hace falta hacer
nada más a mano.

## Ver el reporte visual (con capturas de los fallos, si los hay)

```bash
npm run test:report
```

## Correr las pruebas en modo interactivo (útil mientras programas)

```bash
npm run test:ui
```

## Qué cubre cada archivo

| Archivo | Qué prueba |
|---|---|
| `auth.spec.js` | Login, registro (3 pasos), recuperar contraseña, la pantalla del enlace, la guardia de las pantallas privadas y el cierre de sesión |
| `contenido.spec.js` | Pestañas, agregar/editar/eliminar bloques, reordenar (arrastre y teclado), estado vacío y persistencia en el servidor |
| `qr.spec.js` | Vista previa del QR, colores, tamaño, descarga en los tres formatos y la dirección que asigna el servidor |
| `theme-and-business-sync.spec.js` | Los 3 temas de color, y que Configuración sincronice con el resto del sitio |
| `accessibility.spec.js` | Auditoría automática con axe-core en las 11 páginas y los 3 temas |
| `responsive.spec.js` | Que ninguna página se desborde horizontalmente en móvil |
| `perfil.spec.js` | Perfil empresarial: sincronización con el servidor, guardado y validación del RF-10 |
| `publico.spec.js` | Vista pública: perfil y contenido sin sesión, contacto incompleto y escape de HTML |
| `menu.spec.js` | Pantalla del menú: bloques de la sección, volver al perfil, estados vacíos y escape de HTML |
| `estadisticas.spec.js` | Tarjetas y gráfica del panel con datos del servidor, y el registro de escaneos, visitas y clics |
| `configuracion.spec.js` | Datos personales, avisos de la cuenta y el tema del negocio en la vista pública |
| `ayudas.js` | No es una prueba: es el apoyo compartido que simula la API |

## Por qué no hace falta el backend

Desde que el frontend habla con la API, las pantallas privadas necesitan una
sesión y las públicas hacen peticiones al servidor. Aun así, estas pruebas
**no levantan el backend ni necesitan MySQL**: comprueban el frontend, y deben
pasar igual en una máquina donde no haya nada de eso instalado.

`ayudas.js` se encarga de las dos cosas que hacen falta:

- `simularApi(page)` intercepta las peticiones a `/api/...` y las responde con
  datos fijos, sin salir del navegador.
- `sembrarSesion(page)` deja un token guardado antes de que cargue la página.
  Sin él, la guardia redirige al login antes de que haya algo que comprobar.

Lo habitual es `prepararSesion(page)`, que hace las dos. Varias pruebas de
`auth.spec.js` simulan a propósito respuestas distintas —un 401, un 409, o la
caída del servidor— para comprobar que la pantalla lo informa.

Así que estas pruebas responden a «¿la pantalla envía bien, guarda la sesión,
muestra el error y navega a donde debe?». Que el backend responda lo que debe
se comprueba aparte, con la colección de Postman (`docs/postman/`), que sí
necesita el servidor y la base de datos.

## Sobre las pruebas marcadas `[seguridad]`

Dos pruebas (una en `contenido.spec.js`, otra en
`theme-and-business-sync.spec.js`) son pruebas de regresión para una
vulnerabilidad XSS real que se encontró y corrigió durante el
desarrollo. Si en el futuro alguien edita `contenido.js`, `layout.js` o
`business-data.js` y por accidente quita el escape de HTML
(`escapeHtml()`), estas pruebas van a fallar y avisar — en vez de que
el problema pase desapercibido hasta que alguien lo explote.

## Nota sobre navegadores

Por defecto las pruebas corren en Chromium (Desktop) y en Chromium con
un viewport de iPhone emulado ("Mobile" — usa Chromium en vez de WebKit
real porque el entorno donde se armó este proyecto no pudo instalar
WebKit; ver la sección de más abajo). Si tienes Firefox o WebKit
instalados en tu propia máquina, puedes agregarlos editando los
`projects` en `playwright.config.js`:

```js
{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
{ name: "webkit-mobile", use: { ...devices["iPhone 13"] } }, // WebKit real
```

y luego instalarlos con `npx playwright install firefox webkit`.
