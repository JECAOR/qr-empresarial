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
