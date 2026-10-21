# Frontend React — Guía Frontend N.º 1

Segundo frontend del proyecto, construido con **React + Vite**, que consume la
misma API REST que el original. Corresponde a la Guía Frontend N.º 1 del SENA
(ADSO), cuyo proyecto orientador es SICE; aquí está adaptada a QR Empresarial.

El frontend original, en HTML/CSS/JS sin framework, sigue en [`../frontend`](../frontend)
y no se toca. Son dos clientes del mismo backend.

## Puesta en marcha

Hacen falta dos terminales. Primero la API:

```bash
cd backend
npm run dev          # http://localhost:3000
```

Y en otra, este frontend:

```bash
cd frontend-react
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

La base de datos debe tener los datos de demostración
(`database/seed.sql`), que es de donde sale el perfil que se consulta al abrir.

## Qué hace

Una pantalla: **el perfil público de un negocio**, que es lo que ve quien
escanea el código QR. Pide los datos a `GET /api/publico/:slug` y distingue los
tres estados que exige la guía.

| Estado | Cuándo | Qué muestra |
|---|---|---|
| Cargando | Mientras llega la respuesta | «Cargando perfil…» |
| Error | El negocio no existe, retiró su página o la cuenta está restringida | El mensaje del servidor |
| Vacío | El perfil existe pero no tiene bloques activos | «Este perfil todavía no tiene contenido publicado» |

El campo de texto permite consultar cualquier otro negocio, y sirve para
provocar el error sin tocar el código.

## Estructura

```text
src/
  components/
    Encabezado/            Barra superior. Recibe el texto por props
    FichaNegocio/          Datos del negocio; omite los campos vacíos
    TarjetaContenido/      Un bloque. Enlace o texto, según su tipo
  pages/
    PerfilPublico/         La pantalla: estado, efecto y lista
  services/
    perfilPublicoService.js   Única capa que habla con la API
  styles/global.css        Colores y tipografía, los del frontend original
```

Cada componente lleva su CSS al lado, como pide la guía.

## Cómo funciona

### Los componentes

**`Encabezado`** dibuja la barra superior. No lleva ningún texto escrito
dentro: lo recibe por **props** —`titulo` y `subtitulo`— desde `App.jsx`. Por
eso el mismo componente serviría en otra pantalla con otro texto, sin tocarlo.

**`FichaNegocio`** recibe un solo prop, `perfil`, que es el objeto que devolvió
la API. Dibuja la dirección, el teléfono y el horario **solo si el negocio los
llenó**: `{perfil.telefono && …}`. Sin esa condición aparecerían etiquetas
vacías —«Teléfono:» sin número—, que es peor que no mostrar nada.

**`TarjetaContenido`** recibe cuatro props y decide con una condición cómo
dibujarse: si el bloque es un enlace o un botón lo pinta como `<a>`, porque
lleva a otro sitio y tiene que poder pulsarse; si es un texto, como `<p>`.

### El servicio HTTP

`services/perfilPublicoService.js` es la **única parte que sabe que existe
`fetch`**. La pantalla le pide `obtenerPerfilPublico(slug)` y recibe datos ya
comprobados, o una excepción con un mensaje que se puede mostrar tal cual.

Esa separación es la que permite que la pantalla no se entere del contrato de
la API. Si mañana el backend cambiara la forma de la respuesta, se tocaría este
archivo y nada más.

El servicio comprueba tres cosas antes de devolver: que el código HTTP sea
correcto —y si no, usa el mensaje que explica el servidor en lugar del
número—, que venga un perfil, y que `data.contenido` sea de verdad un arreglo.
Esa última es la que evita el `contenido.map is not a function`.

### `useState`

`useState` guarda los valores que **cambian mientras la pantalla está abierta**
y le avisa a React de que tiene que volver a dibujar cuando cambian. Una
variable normal no serviría: cambiaría su valor, pero la pantalla seguiría
mostrando lo de antes.

`PerfilPublicoPage` tiene cinco:

| Estado | Qué guarda |
|---|---|
| `slug` | El negocio que se está consultando ahora |
| `escrito` | Lo que hay tecleado en la caja, que no es lo mismo |
| `datos` | La respuesta de la API: perfil y contenido |
| `cargando` | Si se está esperando al servidor |
| `error` | El mensaje, cuando algo salió mal |

`slug` y `escrito` están separados a propósito. Si fueran uno solo, cada tecla
que se escribe dispararía una consulta al servidor. Así, `escrito` cambia
mientras se teclea y `slug` solo cuando se pulsa **Consultar**.

### `useEffect`

`useEffect` sirve para lo que hay que hacer **fuera de dibujar**: aquí, pedirle
los datos al servidor. No se puede llamar a la API en medio del renderizado,
porque React dibuja muchas veces y se dispararían peticiones sin control.

Lleva una lista de dependencias, `[slug]`, que significa: ejecútate al montar
la pantalla, y otra vez **solo si cambia el slug**. Con la lista vacía `[]` se
ejecutaría una única vez; sin lista, en cada renderizado —que es la forma
clásica de provocar un bucle infinito—.

Devuelve además una función de limpieza:

```js
return () => { vigente = false; };
```

React la llama antes de volver a ejecutar el efecto. Sirve para que una
respuesta vieja no pise a una nueva: si se consulta un negocio y, antes de que
llegue, se consulta otro, la primera respuesta se descarta en lugar de
sobrescribir la segunda.

**Dos peticiones al abrir, y no es un error.** `StrictMode` ejecuta los efectos
dos veces en desarrollo, a propósito, para que salte a la vista un efecto que
no sabe limpiarse. En producción se ejecuta una sola vez.

## Verificación

El punto 5.6 de la guía pide contrastar lo que responde la API, lo que hay en
MySQL y lo que ve el navegador. La parte automatizable está en
[`verificar.js`](verificar.js), que no tiene dependencias:

```bash
cd backend && npm run dev     # en una terminal
node frontend-react/verificar.js
```

Comprueba cuatro cosas e imprime la consulta SQL para la quinta:

1. El GET público responde 200 con el origen de Vite, y devuelve la cabecera
   `Access-Control-Allow-Origin: http://localhost:5173`.
2. Un slug inexistente responde 404 con su mensaje.
3. **La ruta pública frente a la del dueño.** Es el equivalente de la
   «extensión orientativa» del punto 6: con `GET /api/contenido` y un token, el
   dueño ve **6 bloques**; el público, por `GET /api/publico/:slug`, ve **5**.
   La diferencia es exactamente «Promoción de Semana Santa», que está
   desactivada.
4. La consulta para MySQL Workbench, que devuelve esas mismas 6 filas con su
   columna `activo`.

Esa comparación es la que la guía subraya en su nota de atención: **una tabla
con registros no implica que el GET público los devuelva**. Aquí hacen falta
además dos condiciones: que la cuenta esté activa y que el código QR esté
encendido. Si falta cualquiera, la respuesta correcta es 404.

### Sobre el estado «sin resultados»

La pantalla lo contempla, pero **no se puede provocar** en esta aplicación. Dos
reglas de negocio lo impiden: el código QR no se enciende sobre un perfil sin
bloques activos, y no se deja desactivar el último bloque mientras el código
esté encendido. Si un perfil es visible, siempre tiene al menos un bloque.

El `if` se queda como defensa ante una respuesta inesperada, no como un caso
que se vaya a dar.

## Lo que hubo que adaptar

**El contrato JSON no es el del ejemplo.** La guía usa `{success, message, data: []}`.
Esta API responde:

```json
{ "data": { "perfil": {…}, "contenido": […], "porSeccion": {…} } }
```

No hay campo `success` —el código HTTP ya dice si salió bien— y `data` es un
objeto, no un arreglo: el arreglo está en `data.contenido`. Copiar el servicio
de la guía tal cual produce `contenido.map is not a function`, que la propia
guía lista entre los errores frecuentes.

**CORS ya estaba resuelto.** El paso 5.3 manda instalar `cors` y permitir
`http://localhost:5173`. El backend ya lo trae y mejor planteado: acepta
cualquier origen en desarrollo y restringe por `CORS_ORIGINS` solo en
producción. No se tocó `app.js`.

**El GET lleva un parámetro.** El de SICE no tiene; este necesita el `slug` del
negocio. Sale de `VITE_SLUG_DEMO` en `.env`, y se puede cambiar desde la
pantalla.

## Un hallazgo

Construir esta pantalla destapó un defecto del backend. El bloque «Encargar una
torta» salía como **texto** cuando es un **botón**.

La causa: el tipo se decidía comparando el nombre de la categoría con el
literal `'Botón'`, y la base de datos guardaba otra cosa. Los archivos SQL
estaban bien en UTF-8, pero el cliente `mysql` de la línea de órdenes envía los
acentos en la página de códigos de la consola si no se le dice lo contrario, y
en Windows eso convierte `Botón` en `Bot├│n`. La comparación fallaba en
silencio.

Se corrigió en tres sitios: los archivos SQL declaran `SET NAMES utf8mb4`, el
README documenta `--default-character-set=utf8mb4`, y la clasificación dejó de
depender de un texto en castellano con tilde —ahora mira el icono, que es
ASCII—. Hay una prueba de regresión en
[`backend/tests/qr-y-publico.test.js`](../backend/tests/qr-y-publico.test.js).

Las 130 pruebas del backend no lo veían, y no podían: construyen su base con
`mysql2`, que sí habla utf8mb4, así que el nombre siempre les llegaba entero.

## Lo que viene

La Guía 02 añade inicio de sesión con JWT, rutas protegidas, permisos por rol,
CRUD y pruebas de integración.
