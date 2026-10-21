# Evidencias — Guía Frontend N.º 1

Capturas que piden los entregables de la guía. Cada una corresponde a un
criterio de su lista de verificación.

| Archivo | Qué debe verse | Criterio |
|---|---|---|
| `01-mysql-workbench.png` | La consulta y sus 6 filas, con la columna `activo` | Persistencia en MySQL |
| `02-postman-runner.png` | Las 13 pruebas de la carpeta «Guia React» en verde | GET desde el backend y extensión del punto 6 |
| `03-devtools-cors.png` | Network → Headers → `Access-Control-Allow-Origin` | CORS habilitado |
| `04-pantalla-perfil.png` | `localhost:5173` con la ficha y los 5 bloques | React consumiendo la API |
| `05-pantalla-error.png` | «Este perfil no está disponible» | Manejo de error |
| `06-vite.png` | El servidor de Vite arrancado | Proyecto React con Vite |

## Cómo se obtiene cada una

**01 — MySQL Workbench.** La consulta está en
[`../verificar.js`](../verificar.js), que la imprime al final, y en el
[README](../README.md#verificación). Empiece por `USE qr_empresarial;` y
ejecute el script completo con `Ctrl` + `Shift` + `Enter`.

Deben salir **6 filas**: 5 con `activo = 1` y «Promocion de Semana Santa» con
`activo = 0`. Las tildes de «Botón» y «Página Web» tienen que leerse bien; si
aparecen como `Bot├│n`, la base se cargó sin `--default-character-set=utf8mb4`.

**02 — Postman.** La colección `docs/postman/` trae la carpeta **«Guia React —
Frontend N.1»** con tres peticiones, fijadas al negocio de demostración para
que las cifras cuadren con la captura de Workbench:

| | | |
|---|---|---|
| 228 | `GET /publico/panaderia-la-espiga` | Sin token · 5 bloques |
| 229 | `POST /auth/login` | Guarda `{{tokenDemo}}` |
| 230 | `GET /contenido` | Con token · 6 bloques |

Se ejecutan con el **Runner** sobre la carpeta, que las corre en orden y
resume las 13 pruebas en una sola pantalla. Despliegue las tres peticiones
para que se lean los nombres de las pruebas y no solo los contadores.

**03 — DevTools.** Con el backend y Vite corriendo: abrir `localhost:5173`,
`F12`, pestaña **Network**, filtro **Fetch/XHR**, recargar, hacer clic en la
petición y buscar en **Response Headers**.

Aparecen **dos** peticiones iguales. Es `StrictMode`, no un error; está
explicado en el [README](../README.md#useeffect).

Postman no sirve para esta: CORS es una restricción del navegador, no del
servidor, y Postman no la aplica.

**04 y 05.** La pantalla cargada, y luego escribiendo `negocio-que-no-existe`
en el campo para provocar el 404.

**06.** La salida de `npm run dev`, con la dirección `http://localhost:5173`.

## La comprobación automática

Lo que no necesita captura está en [`../verificar.js`](../verificar.js):

```bash
cd backend && npm run dev          # en una terminal
node frontend-react/verificar.js   # en otra
```

Comprueba el código HTTP, la cabecera de CORS, el contrato JSON, el 404 y la
diferencia entre lo que ve el público (5 bloques) y lo que ve el dueño (6).
