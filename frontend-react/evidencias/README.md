# Evidencias — Guía Frontend N.º 1

Capturas que piden los entregables de la guía. Cada una corresponde a un
criterio de su lista de verificación.

| Archivo | Qué debe verse | Criterio |
|---|---|---|
| `01-mysql-workbench.png` | La consulta y sus 6 filas, con la columna `activo` | Persistencia en MySQL |
| `02-postman-publico.png` | `GET /api/publico/panaderia-la-espiga`, 200 OK, sin `Authorization` | GET desde el backend |
| `03-postman-dueno.png` | `GET /api/contenido` con token: 6 bloques | Extensión del punto 6 |
| `04-devtools-cors.png` | Network → Headers → `Access-Control-Allow-Origin` | CORS habilitado |
| `05-pantalla-perfil.png` | `localhost:5173` con la ficha y los 5 bloques | React consumiendo la API |
| `06-pantalla-error.png` | «Este perfil no está disponible» | Manejo de error |
| `07-vite.png` | El servidor de Vite arrancado | Proyecto React con Vite |

## Cómo se obtiene cada una

**01 — MySQL Workbench.** La consulta está en
[`../verificar.js`](../verificar.js), que la imprime al final, y en el
[README](../README.md#verificación). Empiece por `USE qr_empresarial;` y
ejecute el script completo con `Ctrl` + `Shift` + `Enter`.

Deben salir **6 filas**: 5 con `activo = 1` y «Promocion de Semana Santa» con
`activo = 0`. Las tildes de «Botón» y «Página Web» tienen que leerse bien; si
aparecen como `Bot├│n`, la base se cargó sin `--default-character-set=utf8mb4`.

**02 y 03 — Postman.** Las dos peticiones ya existen en la colección
`docs/postman/`, en las guías 6 y 5. La segunda necesita el token que guarda
el inicio de sesión de la guía 1.

**04 — DevTools.** Con el backend y Vite corriendo: abrir `localhost:5173`,
`F12`, pestaña **Network**, filtro **Fetch/XHR**, recargar, hacer clic en la
petición y buscar en **Response Headers**.

Aparecen **dos** peticiones iguales. Es `StrictMode`, no un error; está
explicado en el [README](../README.md#useeffect).

**05 y 06.** La pantalla cargada, y luego escribiendo `negocio-que-no-existe`
en el campo para provocar el 404.

**07.** La salida de `npm run dev`, con la dirección `http://localhost:5173`.

## La comprobación automática

Lo que no necesita captura está en [`../verificar.js`](../verificar.js):

```bash
cd backend && npm run dev          # en una terminal
node frontend-react/verificar.js   # en otra
```

Comprueba el código HTTP, la cabecera de CORS, el contrato JSON, el 404 y la
diferencia entre lo que ve el público (5 bloques) y lo que ve el dueño (6).
