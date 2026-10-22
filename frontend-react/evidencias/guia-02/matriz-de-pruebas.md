# Matriz de pruebas — Guía Frontend N.º 2

Entregable de la Actividad 5. Cada caso se ejecutó contra el servidor real con
los datos de `database/seed.sql`, no contra una simulación.

> Las cuentas son las de demostración: `admin@caferaices.co` (administrador) y
> `contacto@laespiga.co` (empresa), las dos con `Clave123*`.

## Autenticación

| # | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| 1 | Entrar con credenciales correctas | 200, guarda token y usuario, entra al panel | Correcto | `03-usuarios-listado.png` |
| 2 | Entrar con la contraseña equivocada | 401 y el mensaje del servidor | «Credenciales inválidas» | `02-login-credenciales-invalidas.png` |
| 3 | Recargar con sesión válida | La sesión se restaura con `GET /usuarios/me` | La barra conserva nombre y rol | — |
| 4 | Recargar con un token falsificado | Se descarta la sesión y pide entrar de nuevo | Limpia `sessionStorage` y va a `/login` | — |
| 5 | Cerrar sesión | Revoca el token en el servidor y vuelve al login | Correcto | — |

El caso 4 se provocó sustituyendo el token guardado por uno inventado. El
servidor responde 401 a `GET /usuarios/me`, el contexto borra la sesión local y
la ruta protegida redirige. Comprobado que después `sessionStorage` queda vacío.

## Autorización

| # | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| 6 | Abrir `/usuarios` sin sesión | Redirige a `/login` | Correcto, y recuerda a dónde iba | — |
| 7 | Abrir `/usuarios` como empresa | Redirige a `/acceso-denegado` | Correcto | `09-acceso-denegado.png` |
| 8 | El enlace «Usuarios» con rol empresa | No aparece en la barra | No aparece | `09-acceso-denegado.png` |
| 9 | Entrar como empresa | Aterriza en una pantalla útil, no en un error | Va al perfil público | — |

El caso 9 **falló en la primera prueba**: el formulario mandaba a todo el mundo
a `/usuarios`, de modo que una cuenta de empresa entraba correctamente y
aterrizaba en «Acceso denegado», que parece una avería. Se corrigió haciendo que
el destino dependa del rol.

## Los siete endpoints de usuarios

| # | Operación | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| 10 | `GET /usuarios` | Lista con sus estados de carga, vacío y error | 3 cuentas | `03-usuarios-listado.png` |
| 11 | `GET /usuarios/:id` | Detalle de la cuenta elegida | Correcto | `04-usuarios-detalle.png` |
| 12 | `POST /usuarios` | Crea y refresca la tabla | Creada, la tabla pasa a 4 | `06-usuarios-cuenta-creada.png` |
| 13 | `PUT /usuarios/:id` | Cambia los datos en la API y en MySQL | Correcto, verificado en la base | — |
| 14 | `PATCH /usuarios/:id/estado` | Activo ↔ restringido | Correcto | `07-usuarios-cuenta-restringida.png` |
| 15 | `DELETE /usuarios/:id` | Borrado **lógico** | La fila sigue en MySQL con `deleted_at` | — |
| 16 | `GET /usuarios/me` | Identidad al recargar | Correcto | — |

El caso 15 se comprobó consultando la tabla directamente: la cuenta eliminada
sigue ahí, con `deleted_at` puesto, y deja de aparecer en el listado. React no
ejecuta ningún `DELETE` de SQL; llama al endpoint y es el backend quien decide
qué significa eliminar.

## Reglas de negocio

| # | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| 17 | Un administrador se restringe a sí mismo | No se permite | El botón se deshabilita y explica por qué | `03-usuarios-listado.png` |
| 18 | Un administrador se elimina a sí mismo | No se permite | Igual | `03-usuarios-listado.png` |
| 19 | Crear con un correo ya registrado | 409 y el formulario sigue abierto | Correcto | — |
| 20 | Crear con una contraseña débil | 400 con el motivo | Correcto | — |

Los casos 17 y 18 los impide **el servidor** (400): si un administrador se
restringe, pierde el acceso en la misma petición, y si fuera el único, nadie
podría volver a administrar el sistema. La pantalla no se limita a confiar en
eso: deshabilita los dos botones de la propia fila y dice el motivo al pasar el
cursor. Ofrecer un botón que solo puede dar error es una mala pantalla.

## Interfaz

| # | Caso | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|
| 21 | La tabla en móvil (390 px) | Legible, sin desplazamiento horizontal | Cada fila pasa a ser una ficha | `08-usuarios-movil.png` |
| 22 | El formulario en móvil | Una columna | Correcto | — |
| 23 | La barra de navegación en móvil | Los enlaces bajan a su propia línea | Correcto | `08-usuarios-movil.png` |

## Lo que no se puede probar desde la pantalla

El estado **«sin usuarios»** está implementado pero no se puede provocar: para
llegar al listado hace falta ser administrador, y entonces hay al menos una
cuenta, la propia. El `if` se queda como defensa ante una respuesta inesperada.

## Cómo repetirlo

```bash
cd backend && npm run dev              # en una terminal
cd frontend-react && npm run dev       # en otra
node frontend-react/evidencias/guia-02/generar-capturas.js
```

El guion de capturas recorre el mismo camino: entra, lista, consulta, crea,
edita, restringe y elimina. Crea su propia cuenta de prueba y la borra al
terminar, así que deja la base como la encontró.
