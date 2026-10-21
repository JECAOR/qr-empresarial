// ============================================
// TESTS/SETUP/BASE-DE-PRUEBAS.JS — el esquema que usan las pruebas
//
// Las pruebas no tocan `qr_empresarial`. Trabajan sobre una base propia que
// se construye con el MISMO schema.sql y las MISMAS migraciones, para que lo
// que se prueba sea el esquema real y no una copia que se quede atras.
//
// De regalo, esto comprueba algo que nadie comprobaba: que la base se pueda
// reconstruir desde el repositorio. Al escribirlo aparecio que no se podia
// —la migracion 002 fallaba— y hubo que arreglarlo.
// ============================================

const fs = require('node:fs');
const path = require('node:path');

const NOMBRE = 'qr_empresarial_test';

const RAIZ = path.join(__dirname, '..', '..', '..', 'database');

/**
 * Parte un archivo SQL en sentencias.
 *
 * No vale con `split(';')`: un punto y coma dentro de una cadena no termina
 * la sentencia, y el proyecto tiene al menos uno —el COMMENT de la columna
 * `tema`, en la migracion 011—. Partir por las bravas lo rompia por la mitad
 * y daba un error de sintaxis que parecia de la migracion y era de aqui.
 *
 * Tampoco dentro de un comentario: la cabecera de `seed.sql` lleva uno
 * —«...contacto@laespiga.co; sin este archivo...»— que partia el archivo por
 * la mitad y dejaba media frase en castellano donde MySQL esperaba una
 * sentencia. Los comentarios se descartan, que es lo unico que se puede
 * hacer con ellos aqui.
 *
 * @param {string} sql
 * @returns {string[]}
 */
function trocear(sql) {
  const sentencias = [];

  let actual = '';
  let comilla = null;

  for (let i = 0; i < sql.length; i += 1) {
    const caracter = sql[i];

    // Comentarios, solo cuando no se esta dentro de una cadena. MySQL exige
    // un espacio despues de `--`, de modo que `5--3` sigue siendo una resta.
    if (!comilla) {
      const dosGuiones = caracter === '-' && sql[i + 1] === '-'
        && (sql[i + 2] === undefined || ' \t\r\n'.includes(sql[i + 2]));

      if (dosGuiones || caracter === '#') {
        const fin = sql.indexOf('\n', i);

        i = fin === -1 ? sql.length : fin;
        continue;
      }

      if (caracter === '/' && sql[i + 1] === '*') {
        const fin = sql.indexOf('*/', i + 2);

        i = fin === -1 ? sql.length : fin + 1;
        continue;
      }
    }

    if (comilla) {
      actual += caracter;

      // En MySQL, '' dentro de una cadena es una comilla literal
      if (caracter === comilla && sql[i + 1] === comilla) {
        actual += sql[i + 1];
        i += 1;
      } else if (caracter === '\\') {
        actual += sql[i + 1] || '';
        i += 1;
      } else if (caracter === comilla) {
        comilla = null;
      }

      continue;
    }

    if (caracter === "'" || caracter === '"' || caracter === '`') {
      comilla = caracter;
      actual += caracter;
      continue;
    }

    if (caracter === ';') {
      sentencias.push(actual);
      actual = '';
      continue;
    }

    actual += caracter;
  }

  sentencias.push(actual);

  return sentencias.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Lee schema.sql y las migraciones en orden, quitando las lineas que fijan
 * la base de datos.
 *
 * `CREATE DATABASE qr_empresarial` y `USE qr_empresarial` estan escritos en
 * los archivos. Si se ejecutaran tal cual, las pruebas escribirian en la base
 * de desarrollo: se filtran y la conexion decide a donde van.
 *
 * @returns {string[]} Las sentencias, en el orden en que deben correr.
 */
function sentencias() {
  const archivos = [
    path.join(RAIZ, 'schema.sql'),
    ...fs
      .readdirSync(path.join(RAIZ, 'migrations'))
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .map((n) => path.join(RAIZ, 'migrations', n))
  ];

  const sinComentarios = (sql) =>
    sql
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('--'))
      .join('\n');

  return archivos
    .flatMap((archivo) => trocear(sinComentarios(fs.readFileSync(archivo, 'utf8'))))
    .filter((s) => !/^CREATE\s+DATABASE/i.test(s))
    .filter((s) => !/^USE\s/i.test(s));
}

module.exports = { NOMBRE, sentencias, trocear };
