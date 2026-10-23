# Frontend React

Segundo frontend del proyecto, construido con **React + Vite**, que consume la
misma API REST que el original. Corresponde a las Guías Frontend del SENA
(ADSO), cuyo proyecto orientador es SICE; aquí están adaptadas a QR Empresarial.

| Guía | Qué añadió |
|---|---|
| 01 | Vite, componentes, props, `useState`/`useEffect` y el primer GET público |
| 02 | Inicio de sesión con JWT, rutas protegidas por rol y la gestión de usuarios |

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

Tres pantallas y un guardia.

**`/` — el perfil público de un negocio**, que es lo que ve quien escanea el
código QR. No pide sesión. Pide los datos a `GET /api/publico/:slug` y distingue
los tres estados que exige la guía.

| Estado | Cuándo | Qué muestra |
|---|---|---|
| Cargando | Mientras llega la respuesta | «Cargando perfil…» |
| Error | El negocio no existe, retiró su página o la cuenta está restringida | El mensaje del servidor |
| Vacío | El perfil existe pero no tiene bloques activos | «Este perfil todavía no tiene contenido publicado» |

El campo de texto permite consultar cualquier otro negocio, y sirve para
provocar el error sin tocar el código.

**`/login` — la entrada.** Guarda el token y el usuario en `sessionStorage`, de
modo que la sesión muere al cerrar la pestaña. Al entrar manda a cada quien
donde tiene algo que hacer: un administrador a la gestión de usuarios, una
empresa al perfil público.

**`/usuarios` — la gestión de cuentas**, solo para administradores. Integra los
siete endpoints del módulo: listar, consultar, crear, actualizar, cambiar de
estado y eliminar, más `GET /usuarios/me` para restaurar la sesión.

**`/acceso-denegado`** — a donde va a parar quien entra con un rol que no basta.

**`/registro`** — alta de una cuenta nueva (RF-01). El negocio es opcional: si
se llena, la cuenta y su perfil empresarial se crean en una misma transacción,
de modo que nunca queda una cuenta sin perfil. El registro **no devuelve token**,
así que al terminar se inicia sesión con lo que se acaba de escribir en lugar de
pedirlo otra vez.

**`/recuperar` y `/restablecer`** — el enlace para poner una contraseña nueva
(RF-03). Fuera de producción el servidor devuelve además el enlace, para poder
seguir la prueba sin un buzón de correo.

**`/perfil`** — el perfil del negocio (RF-04 y RF-10): los nueve campos, el
color de marca y la dirección pública. Pide sesión, sin exigir rol: el perfil es
el de quien entra.

**`/contenido`** — los bloques del perfil (RF-05 y RF-06): tres secciones,
alta y edición, activar y desactivar, eliminar y reordenar.

**`/codigo-qr`** — el código (RF-07, RF-08 y RF-09): vista previa, color,
tamaño, descarga en tres formatos y el interruptor de visibilidad.

**`*`** — cualquier otra dirección da una pantalla que lo dice. Antes el router
mandaba a la portada sin avisar, y quien escribía mal una dirección creía haber
llegado donde quería.

## Estructura

```text
src/
  context/
    AuthContext.jsx           La sesión: quién eres, entrar y salir
  components/
    Layout/                   Barra de navegación común
    RutaProtegida/            Exige sesión y, si hace falta, un rol
    FichaNegocio/             Datos del negocio; omite los campos vacíos
    TarjetaContenido/         Un bloque. Enlace o texto, según su tipo
    usuarios/
      TablaUsuarios/          El listado, que en móvil se vuelve fichas
      FormularioUsuario/      Alta y edición
  pages/
    PerfilPublico/            La portada pública
    Login/                    La entrada
    Cuenta/                   Registro, recuperar y restablecer
    Perfil/                   El perfil del negocio
    Contenido/                Los bloques, en sus tres secciones
    CodigoQr/                 El código: vista previa, descarga y visibilidad
    Usuarios/                 La gestión, con los siete endpoints
    AccesoDenegado/           Rol insuficiente
    NoEncontrada/             Una dirección que no existe
  services/
    apiClient.js              Única puerta de salida hacia la API
    authService.js            Entrar, salir, consultar el perfil
    cuentaService.js          Registro y recuperación de contraseña
    contenidoService.js       Los siete endpoints de contenido
    qrService.js              El código QR y su descarga
    perfilService.js          El perfil empresarial propio
    perfilPublicoService.js   El GET público
    usuarioService.js         Los siete endpoints de usuarios
  styles/global.css           Colores y tipografía, los del frontend original
```

Cada componente lleva su CSS al lado, como pide la guía.

El `Encabezado` de la Guía 01 desapareció: lo sustituyó `Layout`, que además de
dar título lleva la navegación y la sesión.

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

## La Guía 02

### Lo que hubo que adaptar, otra vez

El ejemplo de la guía da por confirmada la respuesta de SICE:

```json
{ "success": true, "data": { "token": "…", "expiresIn": "…",
  "user": { "id": 1, "name": "…", "role": { "id": 1, "name": "SYSTEM_ADMIN" } } } }
```

La de esta API es distinta en cinco cosas, y todas rompen el código de ejemplo:

```json
{ "message": "Inicio de sesión correcto", "data": { "token": "…",
  "usuario": { "idUsuario": 4, "nombre": "…", "correo": "…", "rol": "administrador" } } }
```

1. **No hay campo `success`.** `apiClient` no puede comprobarlo: manda el código
   HTTP. Fiarse de un `success` que no existe haría que todo pareciera correcto.
2. **`usuario`, no `user`**, y no viene `expiresIn`.
3. **`rol` es una cadena**, no un objeto `{id, name}`. Eso cambia
   `normalizarPerfil`, `RutaProtegida` y la barra de navegación enteras.
4. **El cuerpo del login es `{correo, contrasena}`**, no `{email, password}`.
5. **Dos roles**, `administrador` y `empresa`, no los cuatro del ejemplo.

Y en la gestión de usuarios, tres más:

6. **La ruta es `/usuarios/:id/estado`**, no `/status`.
7. **El estado es una palabra** —`"activo"` o `"restringido"`—, no `1` o `0`. El
   ejemplo compara con `1`; aquí diría siempre «Inactivo».
8. **Todo el CRUD exige el rol administrador**, que es justo lo que la guía
   quiere demostrar con `rolesPermitidos`.

### Lo que la guía no pide y conviene

El servidor impide que un administrador **se restrinja o se elimine a sí
mismo**: perdería el acceso en la misma petición y, si fuera el único, nadie
podría volver a administrar el sistema. La tabla deshabilita esos dos botones en
la propia fila y dice el motivo. No sustituye la regla —el servidor sigue
mandando— pero evita ofrecer un botón que solo puede dar error.

### Qué protege de verdad cada cosa

`RutaProtegida` **no es seguridad**: quien escriba la dirección a mano o llame a
la API con `curl` se la salta entera. La seguridad la aplica Express en cada
endpoint. Lo que hace el guardia es no enseñar puertas que van a dar 403.

### Pruebas

La [matriz de pruebas](evidencias/guia-02/matriz-de-pruebas.md) recoge los 23
casos ejecutados contra el servidor real, con su resultado esperado, el obtenido
y la evidencia. Dos fallaron a la primera y están documentados con su
corrección.

## El módulo 1, completo

Fuera de las guías, el módulo de autenticación quedó entero: a las dos pantallas
que traía la Guía 02 —entrar y salir— se sumaron el registro público, la
recuperación de contraseña en sus dos pasos y la pantalla de dirección no
encontrada.

**El enlace del correo no apunta aquí.** El backend lo arma con `APP_URL` y
señala a `/restablecer.html`, que es la pantalla del frontend original —el que
está desplegado—. No es un error, es la consecuencia de tener dos clientes de la
misma API. Mientras tanto, la pantalla de recuperación saca el token de ese
enlace y ofrece seguir dentro de React. Para que el correo apuntara a esta
aplicación habría que cambiar `APP_URL` y la ruta en `auth.service.js`.

Recorrido comprobado de extremo a extremo: registrar, entrar, pedir el enlace,
ponerle contraseña nueva y entrar con ella. Después, la contraseña vieja responde
401 y el enlace usado responde 400, porque solo sirve una vez.

## El módulo 2: el perfil del negocio

Los nueve campos del perfil, el color de marca y la dirección pública, en tres
bloques.

**Se envían todos los campos al guardar, también los vacíos.** `PUT` reemplaza
el perfil entero: mandar solo lo que se tocó borraría el resto. Los campos vacíos
llegan como cadena vacía y el backend los guarda como `NULL`, porque «sin
teléfono» y «teléfono igual a nada» no deberían ser dos cosas distintas.

**El color tiene su propia ruta.** `PATCH /perfiles/me/tema` se guarda al
instante, sin pasar por el botón de guardar. Elegir un color es una decisión de
un clic, y obligar a confirmarla aparte sería raro; además así no se arriesga a
pisar nada del formulario.

**Los límites de cada campo se repiten en la pantalla** —150 para el nombre, 2000
para la descripción— para que el navegador avise antes de gastar una petición. No
sustituyen al validador: quien envíe el formulario por otra vía se encuentra con
la misma regla y recibe un 400.

**La dirección pública no se puede editar.** El `slug` se fija al crear el perfil
y no sigue al nombre. Si cambiara, los códigos QR ya impresos dejarían de
funcionar, que es justo lo que el RF-09 debe evitar.

### Un fallo de usabilidad, corregido

El mensaje de error sale arriba del panel y el botón de guardar está abajo del
todo. Al probarlo en una pantalla de 600 px, el aviso quedaba **281 píxeles por
encima** de lo visible: se pulsaba Guardar, el formulario respondía, y no se veía
nada. Ahora el mensaje se desplaza a la vista cuando aparece.

## El módulo 3: el contenido

Los bloques que ve quien escanea el código, en las mismas tres secciones que el
frontend original —Menú principal, Promociones y Reservaciones— para que un
perfil se vea igual en las dos aplicaciones.

**Se reordena de dos maneras, a propósito.** Arrastrar es lo cómodo con ratón,
pero el arrastre de HTML no funciona con el dedo: en un móvil la lista se
quedaría sin forma de reordenarse. Las flechas funcionan en los dos sitios y
además se manejan con el teclado.

El índice del bloque que se arrastra va en una **ref**, no en estado. Los tres
eventos del arrastre pueden ocurrir en el mismo tic y el estado de React no se
habría aplicado cuando llega el `drop`. Con estado parecía funcionar al
arrastrar despacio y fallaba al hacerlo rápido, que es la peor clase de error.

**El tipo no se puede cambiar al editar.** Cada tipo vive en una tabla distinta
—los enlaces en `enlace`, los textos y botones en `elemento`—, así que cambiarlo
sería mover la fila de tabla. El formulario lo muestra deshabilitado y lo dice,
en lugar de dejar intentarlo y responder con un error.

**La categoría depende del tipo.** Un enlace usa las ocho de enlace —WhatsApp,
Instagram, Google Maps…— y un texto o un botón las cinco de elemento. Al cambiar
de tipo se descarta la categoría elegida en vez de mandar un id que daría 400.

**WhatsApp acepta un teléfono.** Si la categoría es WhatsApp, el destino puede
ser `320 555 7788` y el servidor arma `https://wa.me/3205557788`. La pantalla
cambia el marcador y la ayuda para decirlo.

### La regla que más se nota

Con el código QR encendido, el servidor no deja desactivar ni borrar el último
bloque activo:

> «Es el último bloque activo y el perfil ya tiene un código QR. Agregue otro
> antes de quitarlo, o quien escanee el código no encontrará nada»

Comprobado con una cuenta desechable: sin código se puede; con el código
encendido responde 409 tanto al desactivar como al borrar; y después de retirar
la página vuelve a permitirse. Esa es la salida, y está en la pantalla de Código
QR —que es del módulo 4 y todavía no existe aquí—.

## El módulo 4: el código QR

Vista previa, color, tamaño, descarga en PNG, SVG y PDF, y el interruptor que
publica o retira la página.

**La vista previa la dibuja el servidor, no el navegador.** Se pide el mismo
`GET /qr/imagen` que usa la descarga y se muestra el resultado. Así lo que se ve
en pantalla es exactamente el archivo que se va a bajar, sin un segundo
generador que pueda discrepar. El frontend original dibuja su propia vista
previa con una librería y descarga la del servidor: son dos códigos distintos
que casualmente coinciden.

El precio es una petición por cada cambio de color o de tamaño, y por eso se
espera un cuarto de segundo a que el deslizador deje de moverse. Cada imagen
anterior se libera con `revokeObjectURL`; sin eso el navegador se queda con una
copia de cada paso del deslizador.

**La descarga no puede ser un enlace normal.** La ruta exige el token y una
etiqueta `<a href>` no manda cabeceras. Se trae el archivo como blob y se
dispara la descarga desde el navegador. El nombre sale de `Content-Disposition`,
que el servidor expone a propósito con `Access-Control-Expose-Headers`: sin eso
el navegador no deja leer esa cabecera desde otro origen y el archivo se
guardaría con un nombre genérico.

**Los tres estados del código**, comprobados con una cuenta desechable:

| | |
|---|---|
| Sin generar | `GET /qr` responde 404. La pantalla ofrece generarlo, no muestra un error |
| Perfil vacío | `POST /qr` responde 409: «Agregue al menos un bloque de contenido activo antes de generar el código QR» |
| Ya generado | `POST /qr` responde 200 con el mismo. La dirección no cambia, y de eso depende que un código impreso siga sirviendo |

### La salida del módulo 3

Esta es la pantalla a la que apunta el mensaje que impide quitar el último
bloque activo. Retirar la página apaga el código sin borrarlo: la dirección se
conserva y se puede volver a publicar cuando se quiera.

Comprobado de extremo a extremo: al retirarla, `GET /api/publico/:slug`
responde 404; al publicarla de nuevo, 200 con sus cinco bloques.

## Lo que viene

La Guía 03, cuando llegue.
