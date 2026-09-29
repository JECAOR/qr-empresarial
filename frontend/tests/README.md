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
| `auth.spec.js` | Login, Registro (3 pasos), Recuperar contraseña |
| `contenido.spec.js` | Pestañas, agregar/editar/eliminar elementos, estado vacío |
| `qr.spec.js` | Generación real del QR, colores, tamaño, descarga, copiar enlace |
| `theme-and-business-sync.spec.js` | Los 3 temas de color, y que Configuración sincronice con el resto del sitio |
| `accessibility.spec.js` | Auditoría automática con axe-core en las 10 páginas y los 3 temas |
| `responsive.spec.js` | Que ninguna página se desborde horizontalmente en móvil |

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
