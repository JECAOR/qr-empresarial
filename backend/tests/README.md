# Pruebas automáticas del backend

428 pruebas de integración sobre la API, con **Jest** y **Supertest**.

```bash
npm test
```

```bash
npm run test:cobertura
```

## Qué son y qué no

Son **pruebas de integración**: levantan la aplicación de Express de verdad y hablan con una
base MySQL de verdad. No se simula ni el servidor ni la base.

La razón es que casi todo lo que puede salir mal en esta API está justo ahí: una consulta mal
escrita, una restricción del esquema, un middleware en el orden equivocado, un `NOT NULL` sin
valor por defecto. Unas pruebas con la base simulada habrían pasado sobre todos los fallos que
estas encontraron.

Lo único simulado es el **envío de correo**. El `.env` puede traer un SMTP real, y sin
simularlo cada ejecución mandaría mensajes a direcciones inventadas desde la cuenta del
proyecto. El simulador guarda los mensajes en memoria, así que las pruebas del RF-03 sí pueden
comprobar que se envió, a quién, y sacar el token del enlace.

## La base de pruebas

Las pruebas **no tocan `qr_empresarial`**. Trabajan sobre `qr_empresarial_test`, que
`tests/setup/global-setup.js` construye en cada ejecución aplicando `database/schema.sql` y
**todas** las migraciones en orden.

Se recrea entera cada vez en lugar de limpiarla. Reutilizarla dejaría que una prueba aprobara
por los datos que dejó otra, que es la forma más fácil de acabar con una suite verde que no
prueba nada.

De regalo, esto comprueba en cada ejecución algo que antes nadie comprobaba: **que la base se
pueda reconstruir desde el repositorio**. Al escribirlo resultó que no se podía (ver abajo).

Al terminar, la base se deja en pie a propósito: si una prueba falla, mirar las filas que
quedaron es la forma más rápida de entender por qué.

## Qué cubren

| Archivo | Requisitos | Pruebas |
|---|---|---|
| `auth.test.js` | RF-01, RF-02, RF-03 | 64 |
| `usuarios.test.js` | RF-01 (administración), RF-12 | 80 |
| `perfiles.test.js` | RF-04, RF-10, tema | 42 |
| `contenido.test.js` | RF-05, RF-06 | 52 |
| `qr-y-publico.test.js` | RF-07, RF-08, RF-09, RF-11 | 60 |
| `admin.test.js` | RF-13, RF-14, RF-15 | 24 |
| `frontend-publicado.test.js` | lo que publica Express | 41 |
| `avisos.test.js` | RF-12, el resumen semanal | 27 |
| `dos-pestanas.test.js` | la misma cuenta actuando dos veces | 13 |
| `correo.test.js` | RF-03, el envío | 14 |
| `arranque.test.js` | CORS, errores, avisos de despliegue | 11 |

Cobertura: **96,4 % de las sentencias**, 92,4 % de las ramas y 99,1 % de las funciones de `src/`.

Los dos puntos de entrada quedan fuera de la medición: `src/server.js` y
`src/tareas/resumen-semanal.js`. No tienen lógica —leen el `.env`, arrancan lo suyo y
cierran el pool— y lo que hacen de verdad vive en el Service correspondiente, que sí se
prueba. Medirlos solo premiaría escribir una prueba que ejecuta un `process.exit`.

### El resumen semanal, y por qué se prueba así

`avisos.test.js` no prueba una ruta: prueba un proceso que **nadie mira cuando corre**. Un
error en una petición web lo ve quien la hizo; un error aquí son correos repetidos a cien
negocios, o ninguno, y no se sabría hasta que alguien se queje. De ahí que se centre en las
dos cosas que pueden doler: a quién se le manda y cuántas veces.

`nodemailer` está simulado en `setup/entorno.js` y cada mensaje queda en
`global.__correosEnviados`, así que se comprueba el correo **de verdad** —asunto, texto y
HTML, el escapado del nombre del negocio incluido— sin abrir una conexión.

Dos detalles que condicionan cómo están escritas:

- **La base de pruebas es una sola para toda la suite** y se llena de cuentas de los otros
  archivos, así que ninguna prueba cuenta correos en total: todas filtran por la dirección
  de la cuenta que acaban de crear.
- **La baja reescribe el correo** a `eliminado_<id>_<correo>`. La prueba de la cuenta dada
  de baja filtraba por la dirección de antes y pasaba aunque el mensaje se mandara: no
  distinguía nada. Ahora comprueba las dos direcciones.

**Una rama que ninguna prueba distingue, y se deja dicho.** La consulta de destinatarios
filtra por `deleted_at IS NULL` **y** por `estado = 'activo'`. Quitar solo el primer filtro
no hace fallar ninguna de las 428 pruebas, y no es un descuido: la baja pone las dos cosas a
la vez —`deleted_at` y `estado = 'restringido'`—, de modo que no existe ningún estado
alcanzable con `deleted_at` puesto y la cuenta activa. La condición es un cinturón de más y
se conserva, pero no hay prueba que pueda demostrarla.

### El código que distingue los dos 401

Once pruebas de `auth.test.js` cuidan un contrato con el frontend, y de los que si se rompen
hacen daño en silencio. Hay **dos clases de 401** y el cliente las trata de forma opuesta:

- **De sesión** —falta el token, venció, la sesión se cerró, la cuenta fue restringida, la
  contraseña cambió en otro dispositivo—. Lo emite el middleware, y solo él, con
  `codigo: 'sesion'`. El cliente cierra la sesión y lleva al login.
- **De credencial confirmada** —la contraseña está mal al cambiar el correo, al cambiarla o
  al darse de baja, y las credenciales al entrar—. NO llevan el código. El cliente se queda
  en el formulario para poder reintentar.

Si los primeros perdieran la marca, el frontend volvería a dejar a quien estaba trabajando
dentro de una aplicación muerta, con cada pantalla diciéndole que su negocio se quedó sin
contenido, sin código QR y sin estadísticas. Y si la marca se colara en los segundos,
equivocarse al teclear la contraseña echaría a la persona de la aplicación. Las dos
direcciones se comprobaron quitando y colando la marca: la primera rompe 7 pruebas y la
segunda, 4.

Se distingue por el campo y no por el texto del mensaje a propósito: comparar frases se
rompería al reescribir una. Lo sabe el servidor, que es quien los emite.

Las tres últimas subidas salieron de mirar **qué no se ejecutaba nunca**, no de añadir casos a lo que ya pasaba:

| Qué estaba sin cubrir | Antes | Ahora |
|---|---|---|
| El reintento cuando dos negocios piden la misma dirección pública a la vez | 50 % de ramas | 93,8 % |
| La elección de servidor de correo y el fallo al crearlo | 53,3 % de ramas | 100 % |
| `GET /contenido/categorias`, el único endpoint sin ninguna prueba | — | cubierto |
| Las reglas de `usuario.validator.js`, una por una | 76,3 % | 100 % |
| Las de entrar y registrarse (`auth.validator.js`) | 77,8 % | 100 % |
| El CORS de producción, que no se había ejecutado nunca | 70 % | 100 % |
| El middleware de errores con un fallo inesperado | 50 % | 100 % |
| Que un error de base que no sea un duplicado **no** se lea como «ya enviado» | — | cubierto |
| La llamada sin argumentos, que es justo la que hace la tarea programada | — | cubierto |
| Las escrituras del lado `elemento` del contenido | 63,6 % | 100 % |

El acento está en lo que, si se rompe, **no da un error visible**. Un 401 que pasa a 200 no
hace fallar ninguna pantalla: simplemente deja entrar a quien no debía. Por eso hay pruebas
para cosas que nunca se ven, como que la contraseña se guarde cifrada, que en la tabla de
recuperación solo esté el hash del token, o que la vista pública no filtre el correo de la
cuenta.

## Lo que encontraron al escribirlas

Cuatro defectos reales, todos corregidos:

1. **La base no se podía reconstruir desde el repositorio.** La migración 002 renombra
   `contraseña` → `contrasena`, pero `schema.sql` se había actualizado después para declarar
   ya la columna renombrada. Al aplicar la cadena desde cero, la 002 cortaba con
   `Unknown column 'contraseña'`. Ahora comprueba antes si hace falta.

2. **Las categorías no estaban versionadas.** Cinco de las ocho de enlace del RF-05 y las
   cinco de elemento se habían insertado a mano en desarrollo. En una instalación nueva solo
   aparecían tres, y además con los ids 1, 2 y 3; como el frontend manda `idCategoria: 4` para
   una página web, **no se podía agregar ningún bloque de contenido**. Lo arregla la migración
   013.

3. **Un administrador podía eliminar su propia cuenta** desde la administración, sin
   confirmar la contraseña. El README daba esa regla por aplicada y no estaba en el código.

4. **Y podía restringirse a sí mismo**, con lo que perdía el acceso en la misma petición que
   lo pedía. Si fuera el único administrador, nadie podría volver a administrar el sistema.

Un quinto defecto se cerró en `v1.9.1`, y ese no lo encontraron las pruebas sino al
implementar la regla del módulo 3: la secuencia **apagar el código → vaciar el perfil →
encenderlo** dejaba justo el estado que esa regla existe para evitar. Ahora tiene sus cuatro
pruebas en `qr-y-publico.test.js`.

Los dos primeros solo se podían ver reconstruyendo la base desde cero. Contra la base de
desarrollo nunca habrían aparecido, porque allí los datos ya estaban puestos.

## Detalles que conviene saber

**El límite de intentos (RN-03) se vacía entre pruebas.** Cuenta por IP, y aquí todas las
peticiones salen de la misma: sin vaciarlo, las que comprueban un 401 gastarían el cupo de las
siguientes y la suite fallaría según el orden en que corre, no según el código. Su propia
prueba lo vacía primero y luego agota los cinco intentos a propósito, así que la regla se
sigue comprobando. `reiniciarContadores()` solo lo usan las pruebas; la aplicación no lo llama
nunca.

**Hay una espera de un segundo** en la prueba de que restablecer la contraseña cierra las
sesiones. El corte se compara con el `iat` del JWT, que el estándar define en **segundos
enteros**, y la comparación es estricta a propósito para que el token emitido en el mismo
segundo del cambio siga valiendo. Sin la espera, la prueba abriría la sesión y la
restablecería dentro del mismo segundo: estaría comprobando ese caso y no el real.

**Corren en serie** (`maxWorkers: 1`). Comparten una sola base de datos y en paralelo se
pisarían entre ellas.

**Cada prueba crea las cuentas que necesita**, en lugar de apoyarse en datos sembrados. Así se
lee entera sin ir a buscar a otro archivo qué hay en la base, y no se rompe cuando otra prueba
cambia esos datos.

## Relación con Postman y con Playwright

Las tres se complementan y ninguna sobra:

- **Postman** (232 peticiones) es la evidencia para el instructor, se ejecuta a mano y sirve
  para explorar la API.
- **Jest + Supertest** (428) es la red de seguridad automática del backend: corre entera en
  medio minuto y avisa si un módulo nuevo rompe uno viejo.
- **Playwright** (396) prueba las pantallas, con la API simulada.
