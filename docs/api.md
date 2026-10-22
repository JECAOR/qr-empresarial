# API REST — QR Empresarial

Documentación de los endpoints disponibles.

- **Base:** `http://localhost:3000/api`
- **Formato:** JSON en peticiones y respuestas
- **Autenticación:** JWT en la cabecera `Authorization: Bearer <token>`
- **Versión:** v2.0.4

## Resumen

| Método | Endpoint | Acceso | Operación |
|---|---|---|---|
| GET | `/health` | Público | Comprobación del servidor |
| GET | `/publico/:slug` | Público | Perfil y contenido visible |
| POST | `/publico/:slug/eventos` | Público | Registra un escaneo, visita o clic |
| POST | `/auth/registro` | Público | Registro de una empresa |
| POST | `/auth/login` | Público | Iniciar sesión |
| POST | `/auth/logout` | Autenticado | Cerrar la sesión actual |
| POST | `/auth/recuperar-contrasena` | Público | Solicitar el enlace de recuperación |
| GET | `/auth/restablecer/:token` | Público | Comprobar el enlace |
| POST | `/auth/restablecer-contrasena` | Público | Definir la nueva contraseña |
| GET | `/usuarios/me` | Autenticado | Consultar el perfil propio |
| PUT | `/usuarios/me` | Autenticado | Actualizar los datos personales |
| GET | `/usuarios/me/preferencias` | Autenticado | Avisos de la cuenta |
| PUT | `/usuarios/me/preferencias` | Autenticado | Guardar los avisos |
| PUT | `/usuarios/me/contrasena` | Autenticado | Cambiar la contraseña propia |
| DELETE | `/usuarios/me` | Autenticado | Eliminar la cuenta propia |
| GET | `/perfiles/me` | Autenticado | Consultar el perfil empresarial |
| PUT | `/perfiles/me` | Autenticado | Crear o actualizar el perfil empresarial |
| PATCH | `/perfiles/me/tema` | Autenticado | Cambiar solo el color de marca |
| GET | `/contenido` | Autenticado | Listar el contenido del perfil |
| GET | `/contenido/categorias` | Autenticado | Categorías disponibles |
| POST | `/contenido` | Autenticado | Agregar un enlace, texto o botón |
| PUT | `/contenido/orden` | Autenticado | Reordenar una sección |
| PUT | `/contenido/:id` | Autenticado | Editar un bloque |
| PATCH | `/contenido/:id/estado` | Autenticado | Activar o desactivar |
| DELETE | `/contenido/:id` | Autenticado | Eliminar un bloque |
| GET | `/qr` | Autenticado | Consultar el código QR |
| POST | `/qr` | Autenticado | Generar el código QR |
| GET | `/qr/imagen` | Autenticado | Descargar en PNG, SVG o PDF |
| PATCH | `/qr/estado` | Autenticado | Activar o desactivar |
| GET | `/estadisticas` | Autenticado | Escaneos, visitas, clics y serie diaria |
| GET | `/admin/resumen` | Administrador | Cuántas cuentas hay y en qué estado |
| GET | `/admin/usuarios` | Administrador | Lista de cuentas con su actividad |
| GET | `/admin/usuarios/{id}` | Administrador | Detalle de una cuenta |
| GET | `/admin/reportes/usuarios` | Administrador | Reporte de actividad en CSV |
| POST | `/usuarios` | Administrador | Crear usuario con cualquier rol |
| GET | `/usuarios` | Administrador | Listar usuarios activos |
| GET | `/usuarios/:idUsuario` | Administrador | Consultar un usuario |
| PUT | `/usuarios/:idUsuario` | Administrador | Actualizar nombre, correo y rol |
| PATCH | `/usuarios/:idUsuario/estado` | Administrador | Activar o restringir |
| DELETE | `/usuarios/:idUsuario` | Administrador | Eliminación lógica |

### GET /p/:slug

No es un endpoint de la API: es la **pantalla** que ve quien escanea el código. Se documenta
aquí porque el servidor hace algo más que entregar el archivo.

**Las etiquetas de vista previa se arman en el servidor** con los datos de ese negocio:
`<title>`, la descripción, Open Graph, Twitter Card y el bloque de Schema.org.

Tiene que ser en el servidor y no en JavaScript, porque **los robots que generan la vista
previa —WhatsApp, Telegram, Google— no ejecutan JS**: leen lo que venga en el HTML. Mientras
estuvieron escritas a mano, cualquier negocio que compartiera su enlace mostraba la vista
previa del negocio de ejemplo, un restaurante de Medellín.

**No se declara ninguna calificación.** El bloque de Schema.org traía un `aggregateRating` de
4,6 estrellas con 215 reseñas para todos. El sistema no tiene reseñas, así que la propiedad no
existe: no se rellena con ceros ni se inventa. Era un dato legible por máquinas adosado a un
negocio real.

**Un perfil retirado responde lo mismo que un slug inventado**: la pantalla con etiquetas
neutrales, `noindex` y sin el nombre del negocio. Responder distinto revelaría qué slugs están
registrados, que es justo lo que evita el 404 uniforme de `GET /api/publico/:slug`.

**El nombre del negocio se escapa dos veces, de forma distinta.** En los atributos `content="…"`
con entidades HTML; dentro del `<script type="application/ld+json">` con escapes JSON, porque
ahí el navegador no interpreta entidades y `&quot;` rompería el bloque. Lo escribe una persona
y acaba en una página que ve cualquiera.

**Los campos del cuerpo van vacíos en el HTML** y los rellena `public.js`. Antes traían los
datos del negocio de ejemplo, de modo que lo que no ejecutara JavaScript leía la dirección y el
teléfono de otro negocio.

---

## Códigos de respuesta

| Código | Significado | Cuándo aparece |
|---|---|---|
| 200 | OK | Consulta o modificación correcta |
| 201 | Created | Usuario creado |
| 400 | Bad Request | Datos mal formados o identificador inválido |
| 401 | Unauthorized | Sin token, token inválido o vencido, credenciales incorrectas, cuenta restringida |
| 403 | Forbidden | Autenticado, pero el rol no tiene permiso |
| 404 | Not Found | El usuario no existe |
| 409 | Conflict | El correo ya está registrado |
| 500 | Internal Server Error | Error inesperado; el detalle queda en el log del servidor |

---

## Origen de las peticiones

El servidor hace dos trabajos a la vez: expone la API bajo `/api` y publica las
pantallas del frontend en el resto de las rutas. Por eso la aplicación completa
queda en `http://localhost:3000` y no hace falta un segundo servidor. Importa
para el RF-03: el enlace del correo de recuperación apunta a
`APP_URL/restablecer.html`, que este mismo servidor resuelve.

Las rutas bajo `/api` que no existen responden JSON, no el HTML que Express
devuelve por defecto, porque quien llama a la API espera JSON:

```json
{ "message": "Recurso no encontrado" }
```

**CORS.** El navegador bloquea las peticiones entre orígenes distintos salvo que
el servidor las autorice. Hace falta cuando el frontend se sirve aparte: las
pruebas de Playwright lo publican en el 4173 y Live Server suele usar el 5500.

| Entorno | Orígenes aceptados |
|---|---|
| `NODE_ENV=production` | Solo los de `CORS_ORIGINS`, separados por comas |
| Cualquier otro | Todos, para no registrar cada puerto que se use al probar |

Postman y `curl` no están sujetos a CORS: es una restricción que aplica el
navegador, no el servidor.

---

## Comprobación

### GET /api/health

Verifica que la API esté en funcionamiento. No requiere token.

**Respuesta 200**

```json
{
  "status": "ok",
  "message": "QR Empresarial API is running"
}
```

---

## Autenticación

### POST /api/auth/registro

Registro público: una empresa crea su propia cuenta desde el formulario. **El rol siempre es `empresa`**, aunque el cuerpo incluya otro valor.

**Cuerpo**

```json
{
  "nombre": "Panaderia La Espiga",
  "correo": "contacto@laespiga.co",
  "contrasena": "Clave123*"
}
```

| Campo | Regla |
|---|---|
| `nombre` | Obligatorio, mínimo 2 caracteres |
| `correo` | Obligatorio, formato válido y único (RN-01) |
| `contrasena` | Obligatorio, mínimo 8 caracteres con mayúscula, número y símbolo (RN-02) |

**Respuesta 201**

```json
{
  "message": "Cuenta creada correctamente",
  "data": {
    "idUsuario": 12,
    "nombre": "Panaderia La Espiga",
    "correo": "contacto@laespiga.co",
    "rol": "empresa"
  }
}
```

**Errores:** 400 (datos inválidos), 409 (correo ya registrado).

### POST /api/auth/login

**Cuerpo**

```json
{
  "correo": "admin@caferaices.co",
  "contrasena": "Clave123*"
}
```

**Respuesta 200**

```json
{
  "message": "Inicio de sesión correcto",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "idUsuario": 4,
      "nombre": "Cafe Raices S.A.",
      "correo": "admin@caferaices.co",
      "rol": "administrador"
    }
  }
}
```

El token contiene el `id` y el `rol`, se firma con `JWT_SECRET` y vence según `JWT_EXPIRES_IN` (2 horas por defecto).

**Errores:** 400 (falta correo o contraseña), 401 (credenciales inválidas o cuenta restringida). Los tres motivos de fallo devuelven el mismo mensaje para no revelar qué correos existen.

**RN-03.** Tras 5 intentos fallidos desde la misma dirección IP, el endpoint responde 429 durante 15 minutos. Los inicios de sesión correctos no gastan cupo (`skipSuccessfulRequests`), así que un usuario que escribe bien su contraseña nunca se topa con el límite. El contador vive en memoria: al reiniciar el servidor se reinicia.

---

### POST /api/auth/logout

Cierra la sesión actual. Requiere el token en la cabecera `Authorization`, porque lo que se revoca es
precisamente ese token.

**Respuesta 200**

```json
{
  "message": "Sesión cerrada correctamente"
}
```

Un JWT no se puede borrar: una vez firmado es válido hasta que vence, y el servidor no guarda ninguna
sesión que pueda eliminar. Por eso el cierre se implementa al revés: el token lleva un identificador
propio (`jti`), y al cerrar sesión ese identificador queda anotado en la tabla `sesion_revocada`. El
middleware de autenticación la consulta en cada petición protegida y rechaza los tokens que figuren
allí, aunque su firma y su fecha sigan siendo correctas.

Solo se revoca el token con el que se hizo la petición. Las demás sesiones del mismo usuario —otro
navegador, otro dispositivo— siguen abiertas.

Las filas cuya fecha de vencimiento ya pasó se eliminan en cada cierre de sesión: el token que
representan sería rechazado por fecha de todos modos, así que conservarlas no cambiaría ninguna
respuesta y la tabla crecería sin límite.

**Errores:** 401 (falta el token, es inválido, venció o la sesión ya estaba cerrada).

---

## Recuperación de contraseña

Son tres pasos: la empresa pide el enlace, el frontend comprueba que siga sirviendo y luego envía la contraseña nueva.

En la tabla `token_recuperacion` no se guarda el token, sino su hash SHA-256. El token son 32 bytes aleatorios, así que no hace falta bcrypt: no hay nada que adivinar por fuerza bruta y el hash directo permite buscarlo en un solo `SELECT`.

El enlace se envía por correo con `nodemailer`. Si el `.env` trae `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS`,
se usa ese servidor; si no, y `NODE_ENV` no es `production`, el backend crea una cuenta de prueba en
Ethereal y escribe en la consola la URL donde puede verse el mensaje. Así el requisito se prueba
completo sin guardar credenciales de correo en el repositorio. En producción, la falta de configuración
SMTP es un error de despliegue y el envío falla de forma visible.

### POST /api/auth/recuperar-contrasena

**Cuerpo**

```json
{
  "correo": "contacto@laespiga.co"
}
```

**Respuesta 200**

```json
{
  "message": "Si el correo está registrado, recibirá un enlace para restablecer su contrasena",
  "enlaceDesarrollo": "http://localhost:3000/restablecer.html?token=a1b2c3..."
}
```

Responde 200 aunque el correo no exista o la cuenta esté restringida: así nadie puede usar este endpoint para averiguar qué correos están registrados. El campo `enlaceDesarrollo` solo aparece cuando `NODE_ENV` no es `production`, para poder probar sin servidor de correo; en producción el enlace únicamente viaja por correo.

Cada solicitud invalida los enlaces anteriores de esa cuenta, y el nuevo vence según `RECUPERACION_EXPIRA_MINUTOS` (30 por defecto).

Si el envío del correo falla, la petición responde 200 igualmente y el error queda en la consola. El
token ya está guardado, y devolver un 500 solo cuando el correo existe delataría qué cuentas están
registradas, que es justo lo que este endpoint evita.

**Errores:** 400 (falta el correo), 429 (más de 10 solicitudes en 15 minutos desde la misma IP). Aquí se
cuentan todas las solicitudes, no solo las fallidas: como el endpoint responde 200 siempre, un contador
de fallos no subiría nunca y el límite no serviría de nada. El cupo es independiente del login.

---

### GET /api/auth/restablecer/:token

El frontend lo consulta al abrir el enlace, antes de mostrar el formulario.

**Respuesta 200**

```json
{
  "message": "El enlace es válido"
}
```

**Errores:** 400 (el enlace no existe, ya se usó o expiró). Un solo mensaje para los tres casos.

---

### POST /api/auth/restablecer-contrasena

**Cuerpo**

```json
{
  "token": "a1b2c3...",
  "contrasena": "NuevaClave1*"
}
```

**Respuesta 200**

```json
{
  "message": "Contrasena restablecida correctamente"
}
```

La contraseña nueva se cifra con bcrypt y debe cumplir RN-02, igual que en el registro. El enlace queda consumido: reutilizarlo devuelve 400 (RN-04).

**Se cierran todas las sesiones de la cuenta.** Quien recupera su contraseña muchas veces
lo hace porque perdió el control de la cuenta, así que las sesiones abiertas antes del
cambio dejan de servir. No hace falta conocer los tokens: la columna
`usuario.sesiones_validas_desde` guarda el momento del corte y el middleware rechaza
cualquier token firmado antes. Un solo `UPDATE` invalida cuantas sesiones haya, en cuantos
dispositivos sea.

**Errores:** 400 (enlace inválido, expirado o ya usado; contraseña que no cumple RN-02).

---

## Usuarios

Todas las rutas de esta sección requieren `Authorization: Bearer <token>`.

### GET /api/usuarios/me

Devuelve el perfil del usuario autenticado. El identificador sale del token, no de la URL, así que nadie puede consultar el perfil de otra persona. Accesible para cualquier rol.

**Respuesta 200**

```json
{
  "data": {
    "idUsuario": 5,
    "nombre": "Panaderia La Espiga",
    "correo": "contacto@laespiga.co",
    "rol": "empresa",
    "estado": "activo"
  }
}
```

### PUT /api/usuarios/me

Actualiza los datos personales de la cuenta (RF-12). Antes no había forma de hacerlo: la
pantalla de Configuración solo ofrecía cambiar la contraseña.

**Cuerpo**

```json
{
  "nombre": "Panadería La Espiga",
  "correo": "contacto@laespiga.co",
  "contrasena": "Clave123*"
}
```

**La contraseña solo hace falta si el correo cambia.** Para corregir el nombre no se pide:
no cambia nada con lo que se pueda entrar a la cuenta. El correo sí es el identificador con
el que se inicia sesión y al que llega el enlace de recuperación, así que quien se hiciera
con una sesión abierta podría cambiarlo y después apropiarse de la cuenta con «olvidé mi
contraseña».

**El rol no se puede cambiar por aquí**, aunque llegue en el cuerpo. La actualización
administrativa (`PUT /api/usuarios/:idUsuario`) sí puede; esta no, o cualquiera se ascendería
a administrador cambiando sus «datos personales».

**Errores:** 400 (nombre de menos de 2 caracteres, correo con formato inválido), 401 (falta
la contraseña al cambiar el correo, o no es correcta), 404 (la cuenta ya no existe), 409 (ese
correo ya es de otra cuenta, RN-01).

---

### GET /api/usuarios/me/preferencias

Los avisos que la cuenta quiere recibir (RF-12). Vivían solo en el navegador: quien entraba
desde otro equipo los perdía.

```json
{
  "data": {
    "resumen": true,
    "novedades": false,
    "guardadas": false
  }
}
```

`guardadas: false` significa que esa cuenta nunca cambió nada y se están devolviendo los
valores por defecto. **No es un 404**: la pantalla necesita algo que mostrar en los
interruptores, y «no has cambiado nada» no es un error.

> **Son una preferencia guardada, no un envío programado.** Hoy ningún proceso las consulta
> para mandar correos: el único que el sistema envía es el enlace de recuperación de
> contraseña. Se guardan para que la elección de cada cuenta sobreviva al navegador, que es
> lo que pide el RF-12 con «personalizar opciones de la plataforma». La pantalla de
> Configuración lo dice también, para que nadie se quede esperando un correo.

**Eran tres hasta la migración 012.** El tercero, `resenas`, avisaba de calificaciones nuevas
de clientes, y en el sistema **no hay reseñas**: el esquema tiene once tablas y ninguna las
guarda, ni el RF-12 ni ningún otro requisito las pide. Era el mismo problema que ya se
corrigió en otras pantallas —un control que parece funcionar y no acciona nada—, así que se
quitó en lugar de dejarlo.

---

### PUT /api/usuarios/me/preferencias

**Cuerpo:** `{ "resumen": false, "novedades": true }`

**Los dos son obligatorios.** La pantalla manda siempre los dos interruptores, y aceptar un
cuerpo a medias dejaría el que falta en su valor por defecto sin que nadie lo pidiera.

La fila se crea la primera vez que se guarda, con un `INSERT ... ON DUPLICATE KEY UPDATE`: la
columna `id_usuario` es única, así que la base decide si toca crear o actualizar y no hay
hueco entre consultar y escribir.

**Errores:** 400 (falta algún aviso o no es booleano), 401.

---

### PUT /api/usuarios/me/contrasena

Cambia la contraseña del usuario autenticado. El identificador sale del token, así que
nadie puede cambiar la contraseña de otra persona por esta vía.

**Cuerpo**

```json
{
  "contrasenaActual": "Clave123*",
  "contrasenaNueva": "OtraClave1*"
}
```

**Respuesta 200**

```json
{
  "message": "Contraseña actualizada correctamente. Se cerraron las demás sesiones",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Se exige la contraseña actual aunque el token sea válido: si alguien deja la sesión abierta
en un equipo ajeno, no debería poder apropiarse de la cuenta con solo abrir la pantalla de
configuración.

**Por qué devuelve un token.** El cambio cierra todas las sesiones de la cuenta, incluida
la que hizo la petición. El token nuevo se firma después del corte, así que lo sobrevive:
quien cambia su contraseña sigue trabajando sin volver a entrar, mientras los demás
dispositivos quedan fuera. El frontend reemplaza el que tenía guardado.

**Ojo con el 401.** Aquí significa que la contraseña actual está mal escrita, no que la
sesión haya vencido. Un cliente que cierre la sesión ante cualquier 401 echaría al login a
quien simplemente se equivocó en un campo.

**Errores:** 400 (falta la contraseña actual; la nueva no cumple RN-02; la nueva repite la
actual), 401 (la contraseña actual no es correcta), 404 (la cuenta ya no existe o fue
restringida).

---

### DELETE /api/usuarios/me

Elimina la cuenta del propio usuario.

**Cuerpo**

```json
{
  "contrasena": "Clave123*"
}
```

**Respuesta 200**

```json
{
  "message": "Cuenta eliminada correctamente"
}
```

Es el mismo borrado lógico que usa el administrador: se marca `deleted_at` y el correo se
libera con el prefijo `eliminado_<id>_`. La fila no se borra, para no romper las claves
foráneas ni perder el historial, y la dirección queda disponible para registrarse de nuevo.

La contraseña viaja en el cuerpo porque tener la sesión abierta no basta: es la acción menos
reversible de la aplicación. Igual que al cambiar la contraseña, un 401 aquí significa que la
contraseña está mal escrita, no que la sesión haya vencido.

No hace falta revocar los tokens de la cuenta: el middleware la consulta en cada petición y
ya no la encuentra, así que dejan de servir de inmediato.

**Un administrador no puede eliminarse a sí mismo** (403). Si fuera el único, nadie podría
volver a administrar el sistema, y la cuenta no se recupera porque su correo queda
renombrado. Debe pedírselo a otro administrador.

**Errores:** 400 (falta la contraseña), 401 (la contraseña no es correcta), 403 (es
administrador), 404 (la cuenta ya no existe o fue restringida).

---

### POST /api/usuarios

Creación administrativa: permite asignar cualquier rol, incluido `administrador`. Solo para el rol administrador.

**Cuerpo**

```json
{
  "nombre": "Barberia El Corte",
  "correo": "contacto@elcorte.co",
  "contrasena": "Clave123*",
  "rol": "empresa"
}
```

El campo `rol` es opcional; si se omite, se asigna `empresa`.

**Respuesta 201:** igual que la del registro público.
**Errores:** 400, 401, 403, 409.

### GET /api/usuarios

Lista los usuarios no eliminados. Solo administrador.

**Respuesta 200**

```json
{
  "data": [
    {
      "idUsuario": 4,
      "nombre": "Cafe Raices S.A.",
      "correo": "admin@caferaices.co",
      "rol": "administrador",
      "estado": "activo",
      "fechaRegistro": "2026-10-07T05:00:00.000Z"
    }
  ]
}
```

La contraseña nunca aparece en las respuestas.

Los campos van en camelCase, igual que en el inicio de sesión y en
`GET /api/usuarios/me`. Hasta la `v2.5.0` estas dos rutas devolvían las filas
tal como salen de MySQL —`id_usuario`, `fecha_registro`—, de modo que la misma
entidad llegaba al cliente con dos nombres distintos según por dónde se pidiera.

### GET /api/usuarios/:idUsuario

Consulta un usuario por su identificador. Solo administrador.

**Errores:** 400 (identificador no numérico), 404 (no existe o fue eliminado).

### PUT /api/usuarios/:idUsuario

Actualiza nombre, correo y rol. **No modifica la contraseña:** cambiarla exige la contraseña actual (RN-20) y corresponde al módulo de Configuración.

**Cuerpo**

```json
{
  "nombre": "Barberia El Corte S.A.S.",
  "correo": "contacto@elcorte.co",
  "rol": "empresa"
}
```

Los tres campos son obligatorios. Puede enviarse el mismo correo del usuario sin que se considere duplicado.

**Errores:** 400, 404, 409 (el correo pertenece a otro usuario).

### PATCH /api/usuarios/:idUsuario/estado

Activa o restringe la cuenta (RN-23). Una cuenta restringida no puede iniciar sesión, y sus tokens vigentes dejan de servir de inmediato.

**Cuerpo**

```json
{ "estado": "restringido" }
```

Valores admitidos: `activo` y `restringido`.

### DELETE /api/usuarios/:idUsuario

Eliminación lógica. El registro permanece en la base para no romper las relaciones con perfiles, enlaces y códigos QR, pero:

- se marca `deleted_at` con la fecha y hora;
- el estado pasa a `restringido`;
- el correo se prefija con `eliminado_<id>_`, de modo que la dirección vuelve a estar disponible para un registro futuro.

**Respuesta 200**

```json
{ "message": "Usuario eliminado correctamente" }
```

---

## Perfil empresarial

El perfil es lo que ve quien escanea el código QR. Hay **uno por cuenta**: la columna
`id_usuario` es única desde la migración 007, y de eso depende el RF-07 («un QR único por
perfil empresarial»).

**Se crea al registrarse**, en la misma transacción que la cuenta. Así ninguna cuenta queda
sin perfil, y la API se reduce a consultar y actualizar «mi perfil»: no hace falta un POST ni
manejar el estado «todavía no existe» en cada pantalla.

**El `slug` es la parte legible de la URL pública** (`/p/panaderia-dona-luz`). Se genera del
nombre del negocio quitando tildes y espacios, y si ya está tomado se le agrega un sufijo:
`panaderia-dona-luz-2`. **No cambia nunca**, ni cuando se renombra el negocio: si cambiara,
los códigos QR ya impresos dejarían de funcionar, que es justo lo que el RF-09 debe evitar.

### GET /api/perfiles/me

**Respuesta 200**

```json
{
  "data": {
    "idPerfil": 7,
    "nombreNegocio": "Panadería Doña Luz",
    "categoria": "Panadería artesanal",
    "descripcion": "Pan de masa madre horneado cada mañana.",
    "direccion": "Calle 12 #3-45, Bogotá",
    "telefono": "+57 300 111 2233",
    "correoContacto": "hola@donaluz.co",
    "instagram": "@panaderiadonaluz",
    "horario": "Lun-Sáb 6:00–19:00",
    "imagen": "https://ejemplo.co/logo.png",
    "slug": "panaderia-dona-luz",
    "urlPublica": "/p/panaderia-dona-luz",
    "fechaCreacion": "2026-10-17T20:15:00.000Z",
    "fechaActualizacion": "2026-10-17T21:02:11.000Z"
  }
}
```

**Errores:** 401 (sin token o inválido), 404 (la cuenta no tiene perfil). El 404 le ocurre a
las cuentas que creó el administrador con `POST /api/usuarios` y a las registradas antes de
que el registro creara el perfil; se resuelve con un PUT.

---

### PUT /api/perfiles/me

**Cuerpo**

```json
{
  "nombreNegocio": "Panadería Doña Luz",
  "categoria": "Panadería artesanal",
  "descripcion": "Pan de masa madre horneado cada mañana.",
  "direccion": "Calle 12 #3-45, Bogotá",
  "telefono": "+57 300 111 2233",
  "correoContacto": "hola@donaluz.co",
  "instagram": "@panaderiadonaluz",
  "horario": "Lun-Sáb 6:00–19:00",
  "imagen": "https://ejemplo.co/logo.png"
}
```

Devuelve el perfil completo, igual que el GET, con la `fechaActualizacion` recién puesta.

**Reemplaza el perfil completo**, como corresponde a un PUT: los campos que no se envíen
quedan vacíos. El formulario de Configuración los manda todos siempre. Si la cuenta no tenía
perfil, se crea; así la pantalla no tiene que distinguir entre crear y editar.

**Validación (RF-10).** El nombre del negocio es obligatorio (mínimo 2 caracteres). Se valida
el formato del correo de contacto, del usuario de Instagram —letras, números, puntos y
guiones bajos, con o sin arroba— y de la URL de la imagen. De las URL **solo se aceptan
`http` y `https`**: un `javascript:` llegaría a la vista pública y sería un agujero de
seguridad. Los campos opcionales que lleguen vacíos se guardan como `NULL`, para que «sin
teléfono» y «teléfono en blanco» no sean dos cosas distintas en la base.

**El `slug` no se acepta en el cuerpo:** lo decide el servidor y no se puede cambiar.

**El `tema`** (`indigo`, `teal` o `terracota`) es el color de marca del negocio, no una
preferencia de quien lo mira: por eso vive aquí y no en la tabla de preferencias de la
cuenta. **La vista pública lo aplica**, así que quien escanea el código ve los colores que
eligió el negocio; antes esa pantalla usaba el tema guardado en el navegador del visitante y
el color del negocio no llegaba nunca.

Se puede enviar aquí, pero el selector de color usa `PATCH /perfiles/me/tema`, que toca una sola columna (ver abajo). Si no se envía, **se conserva el que ya tenía**. Importa porque el formulario de los datos
del negocio no lo manda —se cambia con su propio selector—, y sin eso guardar el teléfono
devolvería el color a `indigo` sin que nadie lo pidiera.

**Errores:** 400 (falta el nombre; algún formato o largo inválido), 401 (sin token).

---

### PATCH /api/perfiles/me/tema

**Cuerpo**

```json
{ "tema": "teal" }
```

Devuelve el perfil completo, igual que el GET.

**Por qué el color tiene su propio endpoint** y no se guarda con el PUT del perfil: el
selector está en la barra lateral de **todas** las pantallas privadas, no solo en el
formulario del negocio. Para usar el PUT habría que mandar el perfil entero, y lo único
que el navegador tiene a mano es la copia en caché. Eso fue exactamente el fallo: si esa
caché aún no se había sincronizado —al entrar y pulsar un color antes de que llegara el
perfil— el negocio real quedaba **reemplazado por los datos de ejemplo**. Se comprobó:
«Panadería La Espiga», con su categoría, su dirección y su teléfono, se convirtió en
«Fonda La Cosecha» solo por elegir un color.

Este endpoint hace un `UPDATE` de una sola columna, así que no hay nada más que pueda
cambiar. La validación del valor es la misma que en el PUT.

**Errores:** 400 (tema que no es `indigo`, `teal` ni `terracota`), 401 (sin token),
404 (la cuenta no tiene perfil todavía).

---

## Contenido del perfil

Son los bloques que ve quien escanea el código QR: enlaces a otras partes, textos y
botones. Cuelgan del perfil empresarial, así que una cuenta sin perfil no puede tener
contenido (404).

**Una sola lista sobre dos tablas.** El esquema separa `enlace` —lo que lleva a otro
sitio— de `elemento` —los textos y botones—, pero la pantalla y la vista pública
muestran una lista sola. La API expone esa lista única y el servicio decide a qué tabla
escribir según el `tipo`.

Por eso **el identificador es compuesto**: `enlace-12`, `elemento-7`. Los dos contadores
de la base empiezan en 1, así que sin el prefijo el enlace 3 y el elemento 3 serían el
mismo «3» para el cliente.

| `tipo` | Tabla | Para qué |
|---|---|---|
| `enlace` | `enlace` | WhatsApp, Instagram, web, PDF, Google Maps... las ocho del RF-05 |
| `texto` | `elemento` | Un bloque de texto |
| `boton` | `elemento` | Un botón con su destino |

**Las secciones** son las pestañas de la pantalla (`menu`, `promos`, `reservas`). Es texto
libre: la empresa puede renombrarlas. El `orden` es de la sección completa, no de cada
tabla, porque en la pantalla los enlaces y los textos se intercalan.

### GET /api/contenido

Devuelve la lista plana en `data` y la misma agrupada por sección en `porSeccion`, que es
como la pinta la pantalla.

```json
{
  "data": [
    {
      "id": "enlace-12",
      "tipo": "enlace",
      "seccion": "menu",
      "titulo": "Ver el menú",
      "detalle": "https://laespiga.co/menu",
      "categoria": { "id": 4, "nombre": "Página Web", "icono": "globe" },
      "orden": 1,
      "activo": true
    }
  ],
  "porSeccion": { "menu": [] }
}
```

**Errores:** 401 (sin token), 404 (la cuenta no tiene perfil empresarial).

---

### GET /api/contenido/categorias

Las ocho categorías de enlace del RF-05 y las cinco de elemento, para que la pantalla las
ofrezca sin tenerlas escritas en el código.

---

### POST /api/contenido

**Cuerpo**

```json
{
  "tipo": "enlace",
  "titulo": "Pedidos por WhatsApp",
  "detalle": "+57 301 222 3344",
  "idCategoria": 1,
  "seccion": "menu"
}
```

El bloque se coloca al final de su sección. `detalle` es la dirección en los enlaces y el
cuerpo en los textos y botones.

**Validación de las URL (RF-10).** Los enlaces solo admiten `http` y `https`: un
`javascript:` acabaría ejecutándose en la vista pública. **El WhatsApp es la excepción**:
acepta el teléfono tal como lo escribiría cualquiera y lo guarda convertido en
`https://wa.me/573012223344`, de modo que la vista pública no tenga que adivinar si lo
que hay es un número o una dirección.

**Errores:** 400 (tipo o categoría inválidos, falta el título o el detalle, URL que no
sirve), 401, 404 (sin perfil).

---

### PUT /api/contenido/:id

Mismo cuerpo que el POST, **sin `tipo`**: cambiarlo significaría mover la fila a la otra
tabla, así que no se permite. La pantalla tampoco lo ofrece al editar.

**Errores:** 400 (el identificador no tiene la forma `enlace-N`), 401, 404 (no existe o es
de otra cuenta).

---

### PATCH /api/contenido/:id/estado

**Cuerpo:** `{ "activo": false }`

Desactivar no es borrar: el bloque sigue en el panel y deja de salir en la vista pública
(RF-06).

> **No se puede dejar el perfil sin contenido activo si ya tiene código QR** (409).
> El módulo 4 no genera un código para un perfil vacío, porque quien lo escanee no
> encontraría nada. Sin esta comprobación esa garantía duraba lo que tardara el dueño en
> quitar su último bloque: se vigilaba la puerta de entrada y no la de salida, y el código
> ya impreso y pegado en la vitrina seguía llevando a una página en blanco.
>
> **Se vigilan las dos salidas**, borrar y desactivar, porque dejan el perfil igual de
> vacío; comprobar solo una se esquivaría por la otra. Y **solo cuenta si el código está
> encendido**: mientras el perfil se está armando no hay nada que proteger, y bloquearlo
> atraparía a quien se equivocó al escribir su primer enlace. Para vaciar el perfil a
> propósito, se apaga antes el código con `PATCH /api/qr/estado`.

**Errores:** 400 (`activo` no es booleano), 401, 404, 409 (es el último bloque activo y el
perfil tiene código QR).

---

### PUT /api/contenido/orden

**Cuerpo:** `{ "ids": ["elemento-7", "enlace-12"] }`

Las posiciones se asignan en ese orden, que es lo que sabe la pantalla después de
arrastrar. Antes de tocar nada se comprueba que todos los bloques sean de esta cuenta,
para no dejar la sección a medio reordenar.

La pantalla lo llama de dos maneras: al soltar una tarjeta arrastrada y al pulsar las
flechas arriba o abajo sobre el asa de un bloque. Si la petición falla, la lista se vuelve
a pedir al servidor, para no quedar mostrando un orden que no se guardó.

---

### DELETE /api/contenido/:id

Aquí el borrado **sí es definitivo**, a diferencia del de usuarios: un enlace que se quita
no tiene historial que conservar. Los eventos del RF-11 que apuntaban a él se borran con
él.

Rige la misma regla del último bloque activo que en `PATCH /api/contenido/:id/estado`.

**Errores:** 400, 401, 404, 409 (es el último bloque activo y el perfil tiene código QR).

---

## Código QR

**Qué lo hace dinámico.** No la imagen, que nunca cambia, sino que la dirección es fija y
lo que hay detrás se puede editar. De ahí que el `slug` del perfil no cambie al renombrar
el negocio: un código ya impreso tiene que seguir llevando al mismo sitio (RF-09).

**Hay uno por perfil** y la base lo garantiza: `codigo_qr.id_perfil` es `UNIQUE`. No es una
comprobación del código que se pueda olvidar.

### GET /api/qr

```json
{
  "data": {
    "idQr": 1,
    "url": "http://localhost:3000/p/panaderia-la-espiga",
    "slug": "panaderia-la-espiga",
    "activo": true,
    "fechaCreacion": "2026-10-17T21:40:00.000Z",
    "fechaActualizacion": null
  }
}
```

La dirección se arma con `APP_URL`, la misma variable que usa el enlace de recuperación de
contraseña, para que todo apunte a donde está publicada la aplicación.

**Errores:** 401, 404 (la cuenta no tiene perfil, o el perfil no tiene código generado).

---

### POST /api/qr

Genera el código. No lleva cuerpo.

**Es idempotente:** la primera vez responde **201**; las siguientes, **200** con el mismo
código y la misma dirección. Así la pantalla puede llamarlo sin preguntar antes.

**No se genera para un perfil sin contenido activo** (409). Un código que lleva a una página
en blanco es peor que no tener código: quien lo escanea se queda sin saber si el negocio
existe.

**Errores:** 401, 404 (sin perfil), 409 (sin contenido activo).

---

### GET /api/qr/imagen

Descarga la imagen del código (RF-08). **Responde el archivo, no JSON.**

| Parámetro | Valores | Por defecto |
|---|---|---|
| `formato` | `png`, `svg`, `pdf` | `png` |
| `tamano` | 120 a 1200 píxeles | 400 |
| `color` | Hexadecimal de seis dígitos, sin `#` | `111827` |

Un `tamano` fuera de rango no falla: se recorta al límite, para que el servidor no se quede
generando una imagen enorme. El `color`, en cambio, sí se valida, porque va directo a la
librería.

El PDF es una página A4 con el código centrado, un título y la dirección debajo como enlace
—listo para llevar a una imprenta—. Las tres imágenes las genera el servidor, así que el
archivo sale igual en cualquier equipo; la vista previa de la pantalla se sigue dibujando en
el navegador porque es instantánea.

**La respuesta lleva `Content-Disposition` con el nombre del archivo**, y la configuración de
CORS lo expone (`exposedHeaders`). Sin eso, un frontend servido desde otro puerto no puede
leer esa cabecera y guardaría los archivos con un nombre genérico.

**Errores:** 400 (formato o color inválidos), 401, 404.

---

### PATCH /api/qr/estado

**Cuerpo:** `{ "activo": false }`

Desactivarlo no lo borra: el código impreso sigue existiendo en el mundo, y esta bandera es
la que decidirá si la vista pública responde (RF-09).

> **No se enciende sobre un perfil vacío** (409), por lo mismo que no se genera: quien lo
> escanee no encontraría nada.
>
> Sin esta comprobación, la regla del módulo 3 tenía una puerta trasera. Esa regla no deja
> quitar el último bloque activo mientras el código esté encendido, pero **apagarlo sí se
> permite** —es la vía para retirar la página a propósito—, así que la secuencia
> **apagar → vaciar → encender** dejaba exactamente el estado que las dos reglas existen
> para evitar. Se comprobó contra el servidor que ocurría.
>
> Son **tres puertas al mismo sitio** y las tres están vigiladas: generar el código
> (`POST /api/qr`), quitar el contenido (`DELETE` y `PATCH` de `/api/contenido/:id`) y
> encenderlo (aquí).

**Apagarlo nunca se bloquea.** Solo se vigila encender: apagar algo que ya está apagado no
deja a nadie peor, y el dueño tiene que poder retirar su página cuando quiera.

**Quién lo llama:** la tarjeta «Visibilidad» de `qr.html`, con los botones *Retirar mi
página* / *Publicar mi página*. Hasta `v2.0.1` este endpoint no tenía pantalla: existía,
estaba probado y documentado, y el dueño no tenía forma de usarlo. Como además la regla
del módulo 3 no le deja quitar su último bloque mientras el código esté encendido,
quedaba sin salida.

**`POST /api/qr` no lo enciende.** Si ya existe un código apagado, lo devuelve tal cual. La
desactivación fue un acto deliberado y «generar» no debería deshacerla por su cuenta; para
volver a publicarlo está este endpoint.

**Errores:** 400, 401, 404, 409 (el perfil no tiene contenido activo).

---

## Vista pública

Es lo que ve quien escanea el código QR, y **el único endpoint abierto del proyecto**: no
lleva token porque quien escanea no tiene cuenta ni debería necesitarla.

El RF-09 pide «mostrar la información actualizada del perfil cuando el código QR sea
escaneado, sin generar un nuevo código». Eso es justo lo que hace esta ruta: el código
siempre apunta a la misma dirección y aquí se devuelve el estado de ahora. No hay nada que
regenerar, y de eso depende que un código ya impreso siga sirviendo.

**La pantalla se sirve en `/p/{slug}`**, que es la dirección que llevan codificada los
códigos. Esa ruta devuelve siempre `public.html`, exista el perfil o no —así tampoco revela
qué slugs están registrados—, y es su JavaScript el que consulta este endpoint.

### GET /api/publico/:slug

```json
{
  "data": {
    "perfil": {
      "nombreNegocio": "Panadería Doña Luz",
      "categoria": "Panadería artesanal",
      "descripcion": "Pan de masa madre horneado cada mañana.",
      "direccion": "Calle 12 #3-45, Bogotá",
      "telefono": "+57 300 111 2233",
      "correoContacto": "hola@donaluz.co",
      "instagram": "@panaderiadonaluz",
      "horario": "Lun-Sáb 6:00–19:00",
      "imagen": "https://ejemplo.co/logo.png",
      "slug": "panaderia-dona-luz",
      "actualizadoEn": "2026-10-17T21:02:11.000Z"
    },
    "contenido": [],
    "porSeccion": { "menu": [] }
  }
}
```

**Solo el contenido activo.** Desactivar un bloque en el panel es exactamente esto: que deje
de aparecer aquí (RF-06).

**El perfil se arma campo por campo**, no con un `SELECT *`. Si mañana se agrega una columna
a la tabla, no se filtra sola; y no se devuelven ni el correo de la cuenta ni ningún
identificador interno.

**Cuándo responde 404.** Tres situaciones distintas, con la misma respuesta:

1. El slug no corresponde a ningún perfil.
2. La cuenta dueña está restringida o se dio de baja (RN-23).
3. El código QR fue desactivado — es el interruptor que apaga la vista pública sin borrar
   nada.

Distinguirlas le diría a cualquiera que ese negocio existe y está suspendido, y eso no es
asunto de quien escanea. Un perfil **sin** código generado sí se muestra: el enlace puede
haberse compartido por WhatsApp o copiado a mano, sin pasar por el QR.

**Se puede guardar en caché un minuto** (`Cache-Control: public, max-age=60`). La información
cambia cuando el negocio la edita, no en cada escaneo, así que un perfil muy visitado no
debería consultar la base cada vez; y un minuto es poco para que una corrección tarde en
verse.

---

## Estadísticas

El RF-11 pide tres medidas: **escaneos del QR, visitas al perfil y clics en enlaces**. Son
los tres valores del ENUM `evento.tipo`, que ya venían en el esquema original.

**Cómo se distingue un escaneo de una visita.** La imagen del código lleva `?qr=1`; el
enlace que se comparte por WhatsApp o se copia desde el panel, no. La vista pública mira ese
parámetro al cargar. La dirección guardada en `codigo_qr` no cambia: el parámetro solo marca
el origen y no lleva a otro sitio, así que un código impreso seguiría funcionando si mañana
se quitara.

**No se identifica a quien visita.** No se guarda la IP ni nada equivalente, así que se
cuentan visitas, no visitantes únicos. El panel mostraba una tarjeta de «visitantes únicos»
que no se podía calcular con lo que se guarda, y ahora dice «visitas al perfil», que es lo
que pide el requisito.

### POST /api/publico/:slug/eventos

Sin autenticación: lo informa la vista pública, que no tiene sesión.

**Cuerpo**

```json
{ "tipo": "clic", "idEnlace": 12 }
```

`tipo` es `escaneo`, `visita` o `clic`. El `idEnlace` solo en los clics.

**Responde 204, sin cuerpo.** Quien informa el evento no necesita nada de vuelta, y así la
respuesta no gasta ancho de banda en un móvil. La pantalla lo envía con `sendBeacon`, que el
navegador entrega aunque la página se esté yendo al enlace: con un `fetch` normal, la
navegación cancelaría la petición y el clic no se contaría nunca.

**Nada de lo que llega es de fiar**, porque viene de una pantalla abierta:

- El perfil se resuelve por slug con la misma consulta que la vista pública. Si el perfil no
  se puede mostrar —cuenta restringida, código desactivado—, tampoco se le cuentan visitas.
- El enlace se comprueba contra ese perfil antes de guardar nada: con el identificador de
  otro negocio, 400.
- Hay un límite de 120 eventos por IP cada 15 minutos. Es un endpoint abierto que escribe en
  la tabla que más crece del esquema; sin techo, cualquiera podría inflar las estadísticas de
  un negocio con un bucle. El cupo es alto a propósito, porque una misma conexión puede traer
  a varias personas.

**Errores:** 400 (tipo inválido, clic sin enlace o con uno de otro perfil), 404 (el perfil no
está disponible), 429 (se agotó el cupo).

---

### GET /api/estadisticas

Lo que muestra el panel. Admite `?dias=7|30|90`; cualquier otro valor cae en 7, para que una
petición no pueda poner a la base a recorrer la tabla entera.

```json
{
  "data": {
    "dias": 7,
    "totales": { "escaneos": 248, "visitas": 96, "clics": 73, "conversion": 21.2 },
    "serie": [
      { "fecha": "2026-10-17", "etiqueta": "Sáb", "escaneos": 33, "visitas": 12, "clics": 10 }
    ],
    "enlacesMasPulsados": [
      { "idEnlace": 1, "titulo": "Ver menú completo", "categoria": "Página Web", "clics": 41 }
    ]
  }
}
```

**La `conversion`** es el porcentaje de quienes vieron el perfil y pulsaron algo
(`clics / (visitas + escaneos)`). Es la medida que le dice al negocio si su contenido sirve de
algo.

**La serie trae todos los días del rango**, incluidos los que no tuvieron actividad: un
martes sin escaneos aparece como cero y no desaparece del eje de la gráfica.

**Las fechas se agrupan en la zona horaria local, no en UTC.** Al construir las claves con
`toISOString()`, en Colombia —cinco horas por detrás— a partir de las 19:00 los eventos del
día aparecían en el día anterior y el de hoy salía en cero. Es un fallo que solo se ve a
ciertas horas, y por eso conviene tenerlo escrito.

**Los enlaces eliminados no aparecen** en el ranking: al borrar contenido se borran también
sus eventos.

**Errores:** 401 (sin token), 404 (la cuenta no tiene perfil empresarial).

---

## Administración

Exclusiva del rol `administrador` (RN-22). El guardia se monta sobre el router entero, no
ruta por ruta: así una ruta nueva nace protegida en vez de quedar abierta si alguien olvida
añadirle el middleware. Quien no sea administrador recibe **403**; sin token, **401**.

**El RF-14 no tiene endpoints aquí.** «Restringir accesos y eliminar usuarios» ya lo
resuelven `PATCH /api/usuarios/:id/estado` y `DELETE /api/usuarios/:id`, que existen desde el
módulo 1 con sus reglas y sus pruebas. Duplicarlos para que la pantalla nueva tuviera «sus»
endpoints habría dejado dos caminos para lo mismo, y tarde o temprano uno se queda sin una
regla.

### GET /api/admin/resumen

RF-13: «consultar la cantidad de usuarios registrados».

```json
{
  "data": {
    "total": 42,
    "activos": 39,
    "restringidos": 3,
    "administradores": 1,
    "nuncaEntraron": 7,
    "inactivos30Dias": 12,
    "nuevos30Dias": 5
  }
}
```

Las dos cifras del medio son las que el RF-14 necesita para decidir: «eliminar usuarios
**inactivos**» no se puede juzgar sin saber quién lleva meses sin entrar.

Las cuentas eliminadas no se cuentan. El borrado es lógico y la fila sigue ahí, pero para la
administración esa cuenta ya no existe.

**Errores:** 401, 403.

---

### GET /api/admin/usuarios

RF-13: «y su actividad».

**Parámetros:** `busqueda`, `estado` (`activo` / `restringido`), `rol`, `orden`
(`registro`, `acceso`, `nombre`, `actividad`), `pagina`, `porPagina` (máximo 100).

```json
{
  "data": [
    {
      "id": 12,
      "nombre": "Camila Restrepo",
      "correo": "camila@fondalacosecha.co",
      "rol": "empresa",
      "estado": "activo",
      "fechaRegistro": "2026-09-02",
      "ultimoAcceso": "2026-10-17T14:20:00.000Z",
      "perfil": {
        "nombreNegocio": "Fonda La Cosecha",
        "slug": "fonda-la-cosecha",
        "bloquesActivos": 7,
        "qr": true
      },
      "actividad": { "escaneos": 248, "visitas": 96, "clics": 73 }
    }
  ],
  "paginacion": { "pagina": 1, "porPagina": 20, "total": 42, "paginas": 3 }
}
```

**Casi toda esta actividad ya estaba en el esquema** y solo había que juntarla: si la cuenta
tiene perfil, cuánto contenido publicó, si su código está encendido y cuántos eventos
acumula. Lo único que hubo que agregar fue `ultimo_acceso` (migración 014), porque ninguna de
las columnas que había servía para saber cuándo entró alguien por última vez.

**`perfil: null`** no es un error: las cuentas que crea el administrador desde
`POST /api/usuarios` no tienen perfil, y son justo las que quiere ver. **`qr: null`** tampoco:
significa que nunca generó el código, que no es lo mismo que haberlo apagado (`false`).

**Los conteos no se inflan entre sí.** Los bloques y los eventos se cuentan en subconsultas
correlacionadas y no con `JOIN` + `GROUP BY`: con los JOIN, una cuenta con 3 bloques y 50
eventos multiplicaría las filas y los dos conteos saldrían mal. Hay una prueba que lo fija.

**Un filtro inválido se ignora**, no da 400: responder con un error porque alguien editó la
URL dejaría la pantalla en blanco por algo que no importa. Lo único que sí corta es una
búsqueda de más de 100 caracteres, porque acaba en tres `LIKE '%…%'` sobre la tabla de
usuarios.

**Errores:** 400 (búsqueda demasiado larga), 401, 403.

---

### GET /api/admin/usuarios/:id

Lo mismo que una fila de la lista, más `ultimosEventos`: los diez últimos escaneos, visitas y
clics de ese perfil, con el título del enlace cuando lo hay.

**Errores:** 401, 403, 404.

---

### GET /api/admin/reportes/usuarios

RF-15: «descargar reportes de actividad de los usuarios». Acepta los mismos parámetros de
filtro que la lista.

Devuelve un **CSV de catorce columnas** como `attachment`, no como texto que el navegador abra
en una pestaña: lo que pide el requisito es *descargar*. El nombre lo decide el servidor
(`usuarios-AAAA-MM-DD.csv`) y viaja en `Content-Disposition`, que el backend expone en CORS
para que el navegador pueda leerlo.

```text
id,nombre,correo,rol,estado,fecha_registro,ultimo_acceso,negocio,slug,
bloques_activos,codigo_qr,escaneos,visitas,clics
```

**Empieza con BOM.** Sin él, Excel abre el CSV con la codificación del sistema y los nombres
con tilde o eñe salen rotos.

**Cada celda va entrecomillada.** El nombre de un negocio puede llevar una coma, y con eso
sola la fila se parte y todas las columnas siguientes quedan corridas.

**No se pagina.** Quien abre el reporte en una hoja de cálculo espera el conjunto completo,
no la página que estaba viendo.

**Errores:** 400, 401, 403.

---

## Pruebas

La colección de Postman `docs/postman/QR-Empresarial-Usuarios.postman_collection.json` contiene 235 peticiones organizadas por guía, con verificación automática del código de respuesta. Se importa en Postman y se ejecuta con **Run collection**; los dos inicios de sesión de la primera carpeta guardan los tokens que usan las demás.

## Pendiente

Los quince requisitos funcionales están implementados. Queda lo que no es código:

| Asunto | Requisito | Estado |
|---|---|---|
| Servidor SMTP propio | RF-03 | El envío funciona; en desarrollo usa una cuenta de prueba de Ethereal. Para producción basta configurar `SMTP_*` en el `.env` |
| Envío de los avisos de la cuenta | RF-12 | Las dos preferencias se guardan y ningún proceso las consulta para mandar correos. Es una preferencia guardada, no un envío programado, y la pantalla lo advierte |
