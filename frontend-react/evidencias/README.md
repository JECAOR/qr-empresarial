# Evidencias del frontend en React

El entregable principal es el documento, en los dos formatos:

### [`Evidencias-Frontend-React-JCOH.pdf`](Evidencias-Frontend-React-JCOH.pdf) · [`.docx`](Evidencias-Frontend-React-JCOH.docx)

Diecinueve páginas con los cinco puntos que pide la ficha: los conceptos
fundamentales, los componentes implementados y por qué, la evidencia de
integración con la API, las capturas de la interfaz y los datos del
repositorio.

Los dos salen del **mismo texto**, [`documento/contenido.js`](documento/contenido.js),
y dicen exactamente lo mismo: se comprobó comparando palabra por palabra lo que
extrae `pdftotext` de cada uno. El texto vivía antes dentro del HTML; se sacó a
un archivo aparte al añadir la versión en Word, porque una copia del texto se
separa de la otra en cuanto se corrige una frase en una sola de las dos.

## Qué hay en esta carpeta

| | |
|---|---|
| `Evidencias-Frontend-React-JCOH.pdf` y `.docx` | El documento |
| [`documento/`](documento) | El texto y los tres guiones que lo convierten |
| [`pantallas/`](pantallas) | Las dieciséis capturas de la interfaz |
| [`generar-capturas.js`](generar-capturas.js) | El guion que las toma |
| [`guia-01/`](guia-01) y [`guia-02/`](guia-02) | Las evidencias de cada guía, con su matriz de pruebas |

Dentro de `documento/`:

| | |
|---|---|
| `contenido.js` | **El texto**. La única fuente de los dos formatos |
| `estilos.css` | Los estilos del HTML y del PDF |
| `generar-html.js` | Arma el HTML desde `contenido.js` |
| `generar-pdf.js` | Lo imprime a PDF y deja `evidencias.html` |
| `generar-word.js` | Arma el `.docx` desde el mismo `contenido.js` |
| `evidencias.html` | **Salida**, no fuente: el documento para el navegador |

## Cómo rehacerlo todo

Las capturas se toman **contra el servidor real**, con los datos de
`database/seed.sql`. No se usa una API simulada: una pantalla dibujada con
datos inventados no demuestra nada.

Primero, la base con datos frescos. Los eventos de la semilla son relativos al
día en que se ejecuta, así que si lleva semanas cargada la gráfica de actividad
sale vacía:

```bash
mysql -u root -p --default-character-set=utf8mb4 qr_empresarial < database/seed.sql
```

Luego los dos servidores, cada uno en su terminal:

```bash
cd backend && npm run dev
```

```bash
cd frontend-react && npm run dev
```

Y entonces, las capturas y el PDF:

```bash
node frontend-react/evidencias/generar-capturas.js
node frontend-react/evidencias/documento/generar-pdf.js
```

El primero entra con las cuentas de demostración y recorre las trece pantallas.
El segundo arma el HTML desde `contenido.js`, le incrusta las capturas y lo
imprime con el Chromium de Playwright —el mismo que ya usa el proyecto para sus
pruebas—, de modo que no hace falta ninguna dependencia nueva.

Si la gráfica de actividad sale sin datos, el guion de capturas lo avisa al
terminar y recuerda cómo arreglarlo.

El Word sí necesita una librería, y solo él. No se añadió al `package.json` del
frontend porque no tiene nada que ver con la aplicación: vive en la carpeta del
documento y se instala allí:

```bash
cd frontend-react/evidencias/documento && npm install && node generar-word.js
```

Si falta, el guion lo dice y recuerda el comando en lugar de reventar con un
`Cannot find module`.

## Las capturas

| | Pantalla | Módulo |
|---|---|---|
| 01 | Iniciar sesión | M1 |
| 02 | Registro | M1 |
| 03 | Recuperar la contraseña | M1 |
| 04 | Enlace de recuperación caducado | M1 |
| 05 | Perfil público | M5 |
| 06 | Dirección inexistente | — |
| 07 | Mi negocio | M2 |
| 08 | Contenido | M3 |
| 09 | Código QR | M4 |
| 10 | Actividad | M6 |
| 11 | Configuración | M7 |
| 12 | Gestión de usuarios | RF-01 |
| 13 | Administración | M8 |
| 14 | Detalle de una cuenta | M8 |
| 15 | Acceso denegado | — |
| 16 | Contenido en móvil, 390 px | — diseño adaptable |
