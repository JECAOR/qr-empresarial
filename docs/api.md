# API REST — QR Empresarial

Documentación de los endpoints disponibles.

- **Base:** `http://localhost:3000/api`
- **Formato:** JSON en peticiones y respuestas
- **Autenticación:** JWT en la cabecera `Authorization: Bearer <token>`
- **Versión:** v0.5.0

## Resumen

| Método | Endpoint | Acceso | Operación |
|---|---|---|---|
| GET | `/health` | Público | Comprobación del servidor |
| POST | `/auth/registro` | Público | Registro de una empresa |
| POST | `/auth/login` | Público | Iniciar sesión |
| GET | `/usuarios/me` | Autenticado | Consultar el perfil propio |
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

## Pruebas

La colección de Postman `docs/postman/QR-Empresarial-Usuarios.postman_collection.json` contiene 45 peticiones organizadas por guía, con verificación automática del código de respuesta. Se importa en Postman y se ejecuta con **Run collection**; los dos inicios de sesión de la primera carpeta guardan los tokens que usan las demás.

## Pendiente

| Endpoint | Requisito | Estado |
|---|---|---|
| `POST /api/auth/recuperar-contrasena` | RF-03 | Tabla `token_recuperacion` creada (migración 004); faltan los endpoints y el envío del correo |
| `POST /api/auth/logout` | — | Previsto |
| Módulos Perfil, Contenido, QR, Público, Estadísticas, Configuración y Administración | RF-04 a RF-15 | Pendientes |
