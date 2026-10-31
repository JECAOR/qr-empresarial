# Evidencias del frontend en React

El entregable principal es el documento en PDF:

### [`Evidencias-Frontend-React-JCOH.pdf`](Evidencias-Frontend-React-JCOH.pdf)

Diecinueve páginas con los cinco puntos que pide la ficha: los conceptos
fundamentales, los componentes implementados y por qué, la evidencia de
integración con la API, las capturas de la interfaz y los datos del
repositorio.

## Qué hay en esta carpeta

| | |
|---|---|
| `Evidencias-Frontend-React-JCOH.pdf` | El documento |
| [`documento/`](documento) | Su fuente en HTML y el guion que lo convierte a PDF |
| [`pantallas/`](pantallas) | Las dieciséis capturas de la interfaz |
| [`generar-capturas.js`](generar-capturas.js) | El guion que las toma |
| [`guia-01/`](guia-01) y [`guia-02/`](guia-02) | Las evidencias de cada guía, con su matriz de pruebas |

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

Y entonces:

```bash
node frontend-react/evidencias/generar-capturas.js
node frontend-react/evidencias/documento/generar-pdf.js
```

El primero entra con las cuentas de demostración y recorre las trece pantallas.
El segundo incrusta las capturas en el HTML y lo imprime a PDF con el Chromium
de Playwright —el mismo que ya usa el proyecto para sus pruebas—, de modo que
no hace falta ninguna dependencia nueva.

Si la gráfica de actividad sale sin datos, el guion de capturas lo avisa al
terminar y recuerda cómo arreglarlo.

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
