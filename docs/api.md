# API REST — QR Empresarial

Documentación de los endpoints disponibles.

- **Base:** `http://localhost:3000/api`
- **Formato:** JSON en peticiones y respuestas
- **Autenticación:** JWT en la cabecera `Authorization: Bearer <token>`
- **Versión:** v1.1.0

## Resumen

| Método | Endpoint | Acceso | Operación |
|---|---|---|---|
| GET | `/health` | Público | Comprobación del servidor |
| POST | `/auth/registro` | Público | Registro de una empresa |
| POST | `/auth/login` | Público | Iniciar sesión |
| POST | `/auth/logout` | Autenticado | Cerrar la sesión actual |
| POST | `/auth/recuperar-contrasena` | Público | Solicitar el enlace de recuperación |
| GET | `/auth/restablecer/:token` | Público | Comprobar el enlace |
| POST | `/auth/restablecer-contrasena` | Público | Definir la nueva contraseña |
| GET | `/usuarios/me` | Autenticado | Consultar el perfil propio |
| PUT | `/usuarios/me/contrasena` | Autenticado | Cambiar la contraseña propia |
| DELETE | `/usuarios/me` | Autenticado | Eliminar la cuenta propia |
| GET | `/perfiles/me` | Autenticado | Consultar el perfil empresarial |
| PUT | `/perfiles/me` | Autenticado | Crear o actualizar el perfil empresarial |
| POST | `/usuarios` | Administrador | Crear usuario con cualquier rol |
| GET | `/usuarios` | Administrador | Listar usuarios activos |
| GET | `/usuarios/:idUsuario` | Administrador | Consultar un usuario |
| PUT | `/usuarios/:idUsuario` | Administrador | Actualizar nombre, correo y rol |
| PATCH | `/usuarios/:idUsuario/estado` | Administrador | Activar o restringir |
| DELETE | `/usuarios/:idUsuario` | Administrador | Eliminación lógica |

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
      "id_usuario": 4,
      "nombre": "Cafe Raices S.A.",
      "correo": "admin@caferaices.co",
      "rol": "administrador",
      "estado": "activo",
      "fecha_registro": "2026-10-07"
    }
  ]
}
```

La contraseña nunca aparece en las respuestas.

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

**Errores:** 400 (falta el nombre; algún formato o largo inválido), 401 (sin token).

---

## Pruebas

La colección de Postman `docs/postman/QR-Empresarial-Usuarios.postman_collection.json` contiene 94 peticiones organizadas por guía, con verificación automática del código de respuesta. Se importa en Postman y se ejecuta con **Run collection**; los dos inicios de sesión de la primera carpeta guardan los tokens que usan las demás.

## Pendiente

| Endpoint | Requisito | Estado |
|---|---|---|
| Servidor SMTP propio | RF-03 | El envío funciona; en desarrollo usa una cuenta de prueba de Ethereal. Para producción basta configurar `SMTP_*` en el `.env` |
| Módulos Perfil, Contenido, QR, Público, Estadísticas, Configuración y Administración | RF-04 a RF-15 | Pendientes |
