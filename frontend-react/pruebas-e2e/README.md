# Pruebas de extremo a extremo — frontend en React

**226 pruebas en 12 archivos**, con [Playwright](https://playwright.dev) sobre
Chromium. Corren contra el **paquete compilado**, en un navegador de verdad.

```bash
npm install
npx playwright install chromium webkit   # solo la primera vez
npm run test:e2e
```

El informe visual, con las capturas de los fallos si los hay:

```bash
npm run test:e2e:report
```

Y en modo interactivo, útil mientras se programa:

```bash
npm run test:e2e:ui
```

## Por qué existen, si ya hay 548 pruebas

Las de Vitest corren en **jsdom, que no es un navegador**. No aplica CSS, no
tiene arrastre nativo, no descarga archivos, no tiene `sendBeacon`, no tiene
historial ni pestañas, y —lo más importante— envuelve cada evento en `act()`,
que vacía la cola de React entre uno y otro. Eso esconde justo lo que depende
del momento en que React aplica un cambio.

No se repite aquí nada que jsdom pueda contestar: **que una pantalla pinte lo
que le llega, que un servicio arme bien su petición o que un formulario valide,
se prueba allí**, que es mil veces más rápido. Aquí está solo lo que necesita un
navegador.

Y encontraron cosas. Tres, en la primera corrida:

- **El destino recordado al entrar no funcionaba.** Quien abría un enlace a
  `/contenido` sin sesión, entraba y aterrizaba en la portada. `LoginPage` tenía
  dos salidas que competían, y en el navegador ganaba la equivocada. La prueba
  de Vitest no podía verlo —con `act()` de por medio ganaba la otra— y el
  comentario que tenía el código afirmaba, sin haberlo medido, que en el
  navegador funcionaba bien. Ver `entrar.spec.js`.
- **Las flechas de reordenar medían 22 × 20 px**, por debajo de los 24 × 24 que
  pide el criterio 2.5.8 de la WCAG 2.2 — y son la *única* forma de reordenar
  con el dedo, porque el arrastre de HTML no funciona al tacto. Ver
  `movil.spec.js`.
- **La etiqueta del rol en la barra no tenía contraste suficiente**: blanco al
  75 % sobre el índigo da 4,27:1, y hace falta 4,5:1. Salía en las nueve
  pantallas que llevan la barra. Ver `accesibilidad.spec.js`.

Y una más, al aplicar por fin el color de marca del negocio (RF-12):

- **La opacidad no sobrevive a cambiar el fondo.** Los enlaces de la barra
  estaban al 80 % de opacidad y la etiqueta del rol al 85 %, los dos medidos
  sobre el índigo. Con los otros dos temas la barra cambia de color y el
  contraste se cae: 3,80:1 y 4,09:1 sobre el esmeralda, 3,85:1 y 4,15:1 sobre
  el terracota. La auditoría de axe ahora corre con los tres colores, que es lo
  que lo encontró. Ver `accesibilidad.spec.js` y `tema.spec.js`.

Y corrigieron una afirmación falsa: el comentario de `ListaBloques.jsx` decía
que con el índice de origen en estado el arrastre rápido fallaba. **No falla.**
Se midió cambiándolo a `useState` y arrastrando en Chromium, despacio y con los
tres eventos seguidos: reordena igual. La `ref` se queda porque ahorra un
redibujado, no porque haga falta.

## Qué cubre cada archivo

| Archivo | Qué prueba | Por qué no en jsdom |
|---|---|---|
| `entrar.spec.js` (15) | A dónde se llega al entrar, el historial, Atrás después de salir, la guardia de rol | `act()` decide quién gana entre dos salidas; no hay historial de navegador |
| `arrastrar.spec.js` (12) | Reordenar arrastrando, despacio y con los tres eventos seguidos; las flechas con ratón y teclado | jsdom no tiene arrastre nativo ni `dataTransfer` |
| `descargar.spec.js` (14) | PNG, SVG, PDF y el CSV de la administración: nombre y primeros bytes del archivo; la vista previa en `blob:`; el portapapeles | jsdom no descarga nada; `createObjectURL` es de pega |
| `recargar.spec.js` (17) | Recargar cada pantalla, enlaces directos, direcciones que no existen, la sesión al arrancar en frío | no hay recarga, ni pestañas, ni `sessionStorage` entre pruebas |
| `escaneada.spec.js` (19) | Escaneos, visitas y clics del RF-11, que el panel del dueño no cuente nada, y que el logo del negocio se descargue y sus datos de contacto se puedan pulsar | `sendBeacon` no existe en jsdom; que un `<img>` CARGUE y que algo mida 24 px tampoco se ven allí |
| `movil.spec.js` (21) | Lo que decide el CSS a 375 px: la tabla en tarjetas, la barra que baja, el desbordamiento, el tamaño de lo que se pulsa | Vitest corre con `css: false` y jsdom no maqueta |
| `accesibilidad.spec.js` (24 × 2) | Auditoría de axe-core en 14 pantallas, 4 estados y los tres colores de marca, el tabulador y el foco visible | la mitad de las reglas de axe miden contraste y tamaños |
| `tema.spec.js` (19) | El color de marca (RF-12): que la barra se pinte con él, que cambie sin recargar, que no haya parpadeo al recargar, y que quien escanea vea los colores del negocio | jsdom puede ver el atributo, pero no que PINTE: Vitest corre con `css: false` |
| `titulos.spec.js` (18) | El título de la pestaña en cada pantalla, al navegar y al volver atrás | lo que falla aquí es el cambio al NAVEGAR, y en jsdom cada pantalla se monta sola |
| `pwa.spec.js` (15) | Que el icono, el manifiesto, `robots.txt` y el sitemap se sirvan de verdad, y que el service worker se registre y abra la aplicación sin conexión | jsdom no pide archivos ni registra service workers |
| `desarrollo.spec.js` (8) | El doble paso de `StrictMode`: que ocurra, y que aun así una visita se cuente una sola vez | React quita `StrictMode` al compilar, así que corre contra el servidor de desarrollo |
| `menu.spec.js` (20) | El recorrido del menú (RF-05): que el botón navegue sin recargar, que la pantalla aguante un enlace directo y una recarga, que Atrás vuelva al perfil, y que el clic en un enlace del menú salga contado | que el contenido quede AGRUPADO es estructura del DOM y se prueba en jsdom; el recorrido y `sendBeacon` no |
| `ayudas.js` | No es una prueba: es la API simulada y la sesión sembrada | — |

Once de las quince de `pwa.spec.js` solo comprueban que los archivos
**existan** y se sirvan; quitar los `<link>` del HTML no las tumba, y eso es a
propósito: un enlace a un archivo que falta es peor que no tenerlo, y son dos
fallos distintos. Las cuatro que sí miran el enlazado son las del `<head>`, la
del manifiesto y las dos del service worker.

`accesibilidad.spec.js` y `movil.spec.js` corren además en el proyecto
**Móvil**, con un iPhone 13: en una pantalla estrecha cambian el contraste de
algunos fondos, el orden visual y el tamaño de lo que hay que pulsar.

Ese proyecto usa **WebKit de verdad**, que es el motor de Safari y el único
que hay en un iPhone —allí hasta Chrome y Firefox lo usan por dentro—. Durante
varias versiones corrió con Chromium y el viewport del teléfono, porque el
entorno no había podido instalar WebKit, y quedó escrito aquí que un fallo
propio de WebKit se escaparía.

## Por qué no hace falta el backend

Igual que la suite del frontend original, **estas pruebas no levantan el backend
ni necesitan MySQL**: comprueban el frontend, y deben pasar en una máquina donde
no haya nada de eso instalado. `ayudas.js` se encarga de las dos cosas que hacen
falta:

- `simularApi(page)` intercepta `/api/...` y lo responde dentro del navegador.
  **Con memoria**: reordenar y volver a pedir la lista devuelve el orden nuevo,
  como haría el servidor. Sin eso, una prueba de reordenar pasaría aunque la
  pantalla no mandara nada.
- `sembrarSesion(page)` deja el token antes de que arranque la aplicación. Va en
  `addInitScript` porque `AuthContext` lee `sessionStorage` en su primer efecto:
  puesto después, la guardia ya habría mandado al login.

Lo habitual es `prepararSesion(page)`, que hace las dos.

**Dónde se comprueba lo demás.** Que el servidor publique estas pantallas y
reenvíe sus direcciones lo prueba
[`backend/tests/frontend-publicado.test.js`](../../backend/tests/frontend-publicado.test.js),
con Supertest. Que la API responda lo que debe, la colección de Postman en
[`docs/postman/`](../../docs/postman) y las 171 pruebas del backend.

### Que la simulación se parezca a la API no es un detalle

Los dos endpoints de contenido **no devuelven la misma forma**:
`GET /contenido` arma `categoria: {id, nombre, icono}` para el panel del dueño,
y `GET /publico/:slug` aplana la columna a `categoria: "WhatsApp"`. La primera
versión de `ayudas.js` mandaba el objeto a la pantalla pública y la dejó en
blanco con «Objects are not valid as a React child». El defecto estaba en la
simulación, no en la pantalla — pero una simulación que no se parece a la API
deja pasar exactamente eso en el otro sentido.

Por eso `ayudas.js` sale de los servicios del backend, no de lo que le
convendría a la prueba, y una ruta sin simular responde **501 diciéndolo**, en
lugar de caer en el servidor de las pruebas y aparecer como «no se pudo
convertir el JSON».

## Cómo está montado

`playwright.config.js` compila la aplicación y la sirve con `vite preview`:

```
npm run build -- --mode e2e --outDir dist-e2e
npx vite preview --mode e2e --outDir dist-e2e --port 4174 --strictPort
```

- **Se compila en cada corrida**, porque estas pruebas miran el paquete que se
  publica. Un `dist` viejo daría por buena una pantalla que ya no existe.
- **A `dist-e2e` y no a `dist`**, porque `dist/` es lo que publica Express:
  dejárselo con la configuración de las pruebas le cambiaría la dirección de la
  API sin avisar.
- **`vite preview` reenvía las direcciones** igual que Express, que es lo que
  hace falta para probar una recarga de `/contenido`.
- **El puerto 4174**, para no chocar con el 4173 de la suite del frontend
  original ni con el 3000 del backend.

Hay un **segundo servidor**, `vite` en desarrollo sobre el 5174, y es el único
sitio de toda la suite donde no se mira el paquete compilado. Lo necesita
`desarrollo.spec.js`: React quita `StrictMode` al compilar, así que contra
`vite preview` no habría doble paso que comprobar y esas pruebas pasarían sin
haber mirado nada. Su `.env.e2e-dev` es el mismo que el otro con el puerto
cambiado.

Y **tres proyectos**:

| Proyecto | Motor | Qué corre |
|---|---|---|
| `Escritorio` | Chromium, 1280×900 | todo menos `movil` y `desarrollo` |
| `Móvil` | **WebKit**, iPhone 13 | `movil` y `accesibilidad` |
| `Desarrollo` | Chromium, contra `vite` | `desarrollo` |

`.env.e2e` apunta `VITE_API_URL` **al propio servidor de las pruebas**
(`http://localhost:4174/api`) y no al backend de desarrollo. Es el mismo origen,
así que no hay CORS que configurar en cada respuesta ni peticiones `OPTIONS` de
verificación previa; y si una petición se escapara sin simular, cae en el
servidor de las pruebas en lugar de pegarle al backend de verdad y dejar la base
de datos tocada. Por si acaso, `simularApi` **corta toda salida a internet** en
el contexto: las tarjetas de contenido llevan enlaces reales a `wa.me` y a
`maps.app.goo.gl`.

**Los service workers van bloqueados** (`serviceWorkers: 'block'`). El paquete
compilado registra uno, y uno activo respondería desde su caché: las peticiones
saldrían del alcance de `page.route()` y los datos simulados dejarían de
aplicarse, con fallos que no tendrían nada que ver con lo que la prueba mira. El
único sitio donde se permiten es `pwa.spec.js`, que los necesita, y los activa
solo para su propio bloque.

## Lo que estas pruebas tampoco demuestran

- **El conteo al ir de un negocio a otro sin recargar.** La aplicación nunca
  navega de `/p/a` a `/p/b` por dentro, así que no hay forma de provocarlo desde
  la interfaz. Esa regresión la cubre Vitest, que monta un `<Link>` para
  reproducirla.
- **Que la vista previa de WhatsApp se vea bien.** Las etiquetas Open Graph las
  inyecta Express, y `vite preview` no: eso lo prueba el backend.
- **Los eventos del RF-11 en WebKit.** No es una decisión: Playwright no puede
  leer el cuerpo de un `sendBeacon` en ese motor. Está medido, abajo.
- **Safari de escritorio.** El proyecto **Móvil** cubre WebKit donde más
  importa —lo que ve quien escanea el código, en un teléfono—. Correr además
  toda la suite en un Safari de escritorio se probó y no encontró ni un
  defecto de la aplicación: 165 de 173 en verde, y los 8 restantes por lo que
  cuenta el apartado siguiente.

### Lo que WebKit no deja observar, y lo que sí se comprobó

Al pasar el proyecto Móvil a WebKit de verdad, las pruebas que cuentan los
eventos del RF-11 fallaban. La pregunta importante era si fallaba **la
aplicación** —es decir, si un iPhone no cuenta las visitas— o solo el arnés de
pruebas. Se midió con un servidor HTTP corriente, fuera de Playwright:

| | Chromium | WebKit |
|---|---|---|
| `sendBeacon` con un Blob JSON devuelve | `true` | `true` |
| El cuerpo llega al servidor | `{"tipo":"visita",…}` | `{"tipo":"visita",…}` |
| `page.route()` intercepta la petición | sí | sí |
| `request.postData()` al interceptarla | el cuerpo | **`null`** |
| `request.postDataBuffer()` | el cuerpo | **`null`** |

O sea: **la aplicación cuenta bien en WebKit** —el evento sale con su cuerpo
íntegro, igual que en Chromium— y lo que no puede es Playwright leerlo cuando
lo intercepta. Por eso esas pruebas se quedan en Chromium: medir allí no
prueba menos, y en WebKit no probaría nada.

El otro fallo del experimento fue `context.grantPermissions('clipboard-write')`,
que WebKit no admite: afecta a la prueba de copiar la dirección pública.
