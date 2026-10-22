# Evidencias del frontend en React

Una carpeta por guía. Cada una tiene sus capturas y el guion que las genera.

| | |
|---|---|
| [`guia-01/`](guia-01) | Fundamentos de React y el primer GET contra la API |
| [`guia-02/`](guia-02) | Autenticación JWT, rutas protegidas y gestión de usuarios |

## Guía 01 — seis capturas

| Archivo | Qué se ve | Criterio |
|---|---|---|
| `01-mysql-workbench.png` | La consulta y sus 6 filas, con la columna `activo` | Persistencia en MySQL |
| `02-postman-runner.png` | Las 13 pruebas de la carpeta «Guia React» en verde | GET desde el backend y extensión del punto 6 |
| `03-devtools-cors.png` | Network → Headers → `Access-Control-Allow-Origin` | CORS habilitado |
| `04-pantalla-perfil.png` | El perfil con sus cinco bloques | React consumiendo la API |
| `05-pantalla-error.png` | «Este perfil no está disponible» | Manejo de error |
| `06-vite.png` | El servidor de Vite arrancado | Proyecto React con Vite |

Las dos de la pantalla las genera [`guia-01/generar-capturas.js`](guia-01/generar-capturas.js).
Las otras cuatro son de MySQL Workbench, Postman, DevTools y la terminal.

## Guía 02 — nueve capturas y la matriz de pruebas

| Archivo | Qué se ve |
|---|---|
| `01-login.png` | La pantalla de entrada |
| `02-login-credenciales-invalidas.png` | El mensaje del servidor ante una contraseña equivocada |
| `03-usuarios-listado.png` | La tabla, con los botones de la propia cuenta deshabilitados |
| `04-usuarios-detalle.png` | `GET /usuarios/:id` |
| `05-usuarios-formulario-alta.png` | El formulario de alta |
| `06-usuarios-cuenta-creada.png` | La cuenta creada y la tabla al día |
| `07-usuarios-cuenta-restringida.png` | El cambio de estado |
| `08-usuarios-movil.png` | La tabla convertida en fichas a 390 px |
| `09-acceso-denegado.png` | Una cuenta de empresa intentando entrar a `/usuarios` |
| `10-postman-runner.png` | Las 31 pruebas de la carpeta «Guia React N.2» en verde |
| `11-devtools-authorization.png` | Network → Headers: el método, la URL, el código y la cabecera `Authorization` |
| `12-mysql-borrado-logico.png` | La cuenta eliminada, que sigue en la tabla con `deleted_at` |

La [matriz de pruebas](guia-02/matriz-de-pruebas.md) recoge los 23 casos
ejecutados, con su resultado esperado, el obtenido y la evidencia. Incluye los
dos que fallaron la primera vez y cómo se corrigieron.

### Las tres que no se automatizan

**10 — Postman.** La colección trae la carpeta **«Guia React — Frontend N.2»**:
quince peticiones que recorren los siete endpoints en el mismo orden que la
pantalla, más los casos negativos (400, 401, 403, 404, 409) y el contraste de
permisos entre un administrador y una empresa. Se ejecutan con el **Runner**
sobre la carpeta; son 31 pruebas. Crean su propia cuenta y la eliminan al
terminar.

**11 — DevTools.** Con sesión de administrador en `/usuarios`: `F12` →
**Network** → **Fetch/XHR** → recargar → clic en `usuarios` → **Headers**. Ahí
se ven el método, la URL, el código HTTP y la cabecera `Authorization`.

> **Recorte el valor del token antes de guardar la imagen.** La guía pide no
> exponer el JWT en capturas, y esa cabecera lo muestra entero. Lo que hay que
> demostrar es que la cabecera viaja, no cuál es su contenido.

**12 — MySQL.** Después de ejecutar la carpeta de Postman, la cuenta que creó y
eliminó sigue en la tabla:

```sql
USE qr_empresarial;

SELECT id_usuario, nombre, correo, estado, deleted_at
  FROM usuario
 WHERE correo LIKE '%guia2.postman%'
    OR correo IN ('admin@caferaices.co', 'contacto@laespiga.co')
 ORDER BY id_usuario;
```

Salen tres filas: las dos de demostración con `deleted_at` en `NULL`, y la que
Postman creó y eliminó con la fecha puesta.

**Por qué `LIKE` y no el correo exacto.** El borrado lógico hace tres cosas a la
vez: marca `deleted_at`, pone el estado en `restringido` y **renombra el
correo** a `eliminado_<id>_<correo>`. Así es como se libera la dirección para
que pueda volver a registrarse, que es lo que comprueba la petición 19 de la
Guía 3. Buscando el correo original no aparece nada, y parece que la fila se
borró cuando sigue ahí.

Eso es el borrado lógico: la fila no se va, se marca. React nunca ejecuta un
`DELETE` de SQL; llama al endpoint y es el backend quien decide qué significa
eliminar.

Las nueve las genera [`guia-02/generar-capturas.js`](guia-02/generar-capturas.js),
que entra con las cuentas de demostración y recorre el CRUD completo: crea una
cuenta de prueba, la edita, la restringe y la elimina, de modo que deja la base
como la encontró.

## Cómo regenerarlas

Hace falta el backend y Vite corriendo, y la base con los datos de
demostración:

```bash
mysql -u root -p --default-character-set=utf8mb4 qr_empresarial < database/seed.sql
```

```bash
cd backend && npm run dev
```

```bash
cd frontend-react && npm run dev
```

Y entonces:

```bash
node frontend-react/evidencias/guia-01/generar-capturas.js
node frontend-react/evidencias/guia-02/generar-capturas.js
```
