# Pruebas automáticas del backend

130 pruebas de integración sobre la API, con **Jest** y **Supertest**.

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
| `auth.test.js` | RF-01, RF-02, RF-03 | 20 |
| `usuarios.test.js` | RF-01 (administración), RF-12 | 20 |
| `perfiles.test.js` | RF-04, RF-10, tema | 14 |
| `contenido.test.js` | RF-05, RF-06 | 19 |
| `qr-y-publico.test.js` | RF-07, RF-08, RF-09, RF-11 | 33 |
| `admin.test.js` | RF-13, RF-14, RF-15 | 24 |

Cobertura: **85,6 % de las sentencias** y 92,6 % de las funciones de `src/`. El módulo de administración va al 95,2 %.

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
- **Jest + Supertest** (130) es la red de seguridad automática del backend: corre entera en
  medio minuto y avisa si un módulo nuevo rompe uno viejo.
- **Playwright** (376) prueba las pantallas, con la API simulada.
