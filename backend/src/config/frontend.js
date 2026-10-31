// ============================================
// FRONTEND.JS — cual de las dos interfaces publica el servidor
//
// El proyecto tiene dos frontends terminados. El original, en HTML y
// JavaScript sin framework, y el de React, que es el que piden las guias
// Frontend N.1 y N.2. Los dos hablan con la misma API.
//
// Publicar uno no borra el otro: el original sigue en frontend/ y sus 396
// pruebas de Playwright levantan su propio servidor, asi que no dependen de
// esto y siguen pasando igual.
//
//   FRONTEND=react     (por defecto) publica frontend-react/dist
//   FRONTEND=clasico   publica frontend/
//
// Importa para el RF-03: el enlace del correo de recuperacion tiene que
// apuntar a una pantalla que exista en el frontend que este publicado. Por
// eso esa direccion sale de aqui y no esta escrita en auth.service.js, donde
// se quedaria desfasada en cuanto alguien cambiara la variable.
// ============================================

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..');

const EN_REACT = (process.env.FRONTEND || 'react').toLowerCase() !== 'clasico';

const CARPETA = EN_REACT
  ? path.join(RAIZ, 'frontend-react', 'dist')
  : path.join(RAIZ, 'frontend');

/**
 * La pantalla que se entrega al escanear un codigo QR.
 *
 * En React es el index.html de siempre -una sola pagina, el enrutador decide
 * que dibuja-; en el original, una pantalla propia.
 */
const PANTALLA_PUBLICA = path.join(CARPETA, EN_REACT ? 'index.html' : 'public.html');

/**
 * La direccion del enlace de recuperacion, relativa al origen.
 *
 * React no sirve archivos .html: sus direcciones las resuelve el enrutador.
 */
const RUTA_RESTABLECER = EN_REACT ? '/restablecer' : '/restablecer.html';

/**
 * Comprueba que lo que se va a publicar existe de verdad.
 *
 * Sin esto, con el frontend de React sin compilar el servidor arranca tan
 * contento y responde 404 a todo, que es mucho mas dificil de entender que
 * un aviso al arrancar.
 *
 * @returns {string|null} El motivo, o null si todo esta en su sitio.
 */
function revisar() {
  if (!fs.existsSync(CARPETA)) {
    return EN_REACT
      ? 'Falta frontend-react/dist. Compile el frontend con:\n'
        + '    cd frontend-react && npm install && npm run build\n'
        + '  O publique el frontend original con FRONTEND=clasico.'
      : `No existe la carpeta del frontend: ${CARPETA}`;
  }

  if (!fs.existsSync(PANTALLA_PUBLICA)) {
    return `Falta la pantalla publica: ${PANTALLA_PUBLICA}`;
  }

  return null;
}

module.exports = { EN_REACT, CARPETA, PANTALLA_PUBLICA, RUTA_RESTABLECER, revisar };
