// ============================================
// AVISO.SERVICE.JS — el resumen semanal de actividad (RF-12)
// Decide a quien se le manda, con que datos, y lleva la cuenta de lo que
// paso. No lo llama ninguna ruta: lo arranca src/tareas/resumen-semanal.js
// desde el Programador de tareas.
// ============================================

const avisoRepository = require('./aviso.repository');
const estadisticaService = require('../estadisticas/estadistica.service');
const correo = require('../../utils/correo');

const TIPO = 'resumen';

// Los mismos siete dias que ofrece la pantalla de estadisticas. Que el
// correo y la pantalla digan lo mismo no es casualidad: se consulta el mismo
// servicio, asi que no hay dos definiciones de "la semana" que se puedan
// separar con el tiempo.
const DIAS = 7;

/**
 * El lunes de la semana a la que pertenece una fecha, como 'AAAA-MM-DD'.
 *
 * Es la clave con la que se evita el duplicado, y por eso es la semana y no
 * el dia. La primera version restaba siete dias a hoy, y con eso la tarea
 * del lunes y una ejecucion a mano del martes daban claves distintas: dos
 * correos por la misma semana. Anclandolo al lunes, cualquier ejecucion
 * dentro de la misma semana cae en el mismo periodo y la segunda choca con
 * el UNIQUE de la tabla.
 *
 * Se arma con las partes locales de la fecha, no con toISOString(): en
 * Colombia (UTC-5) ese metodo devuelve el dia siguiente a partir de las 7
 * de la noche, y el periodo saldria corrido.
 *
 * @param {Date} fecha
 * @returns {string}
 */
function lunesDeLaSemana(fecha) {
  const dia = fecha.getDay();

  // getDay() da 0 el domingo y 6 el sabado. Esta cuenta convierte eso en
  // "cuantos dias hay que retroceder para llegar al lunes": el domingo son
  // seis, el lunes cero.
  const retroceso = (dia + 6) % 7;

  const lunes = new Date(fecha);
  lunes.setDate(lunes.getDate() - retroceso);

  const mes = String(lunes.getMonth() + 1).padStart(2, '0');
  const dd = String(lunes.getDate()).padStart(2, '0');

  return `${lunes.getFullYear()}-${mes}-${dd}`;
}

/**
 * Manda el resumen de actividad a quien toque.
 *
 * Lo que hace con cada negocio, en orden:
 *
 *   1. Pide sus estadisticas de los ultimos siete dias.
 *   2. Si no hubo nada, lo salta SIN reservar. Un correo semanal que dice
 *      "cero escaneos" es la razon mas comun por la que alguien apaga los
 *      avisos, y al no reservar, el negocio recibe el resumen en cuanto
 *      tenga actividad.
 *   3. Reserva el envio. Si ya estaba reservado, el correo de esta semana ya
 *      salio y lo salta.
 *   4. Envia. Si el envio falla, suelta la reserva y sigue con los demas: un
 *      correo rechazado por un servidor no puede dejar sin resumen a los
 *      otros cien negocios.
 *
 * Los parametros se inyectan para poder probarlo: 'ahora' fija el periodo sin
 * depender del dia en que corran las pruebas, y 'enviar' permite comprobar
 * que se manda lo correcto sin abrir una conexion SMTP.
 *
 * @param {object} [opciones]
 * @param {Date} [opciones.ahora] - Momento de referencia.
 * @param {Function} [opciones.enviar] - Con la firma de enviarResumenSemanal.
 * @returns {Promise<{periodo: string, considerados: number, enviados: number,
 *   sinActividad: number, yaEnviados: number, fallidos: number}>}
 */
async function enviarResumenesSemanales({
  ahora = new Date(),
  enviar = correo.enviarResumenSemanal
} = {}) {
  // Antes de tocar la base. En produccion sin SMTP esto es un error de
  // despliegue, y conviene que se vea entero y de una vez en lugar de como
  // un fallo por cada negocio. Es para lo que existe haySmtpConfigurado().
  if (process.env.NODE_ENV === 'production' && !correo.haySmtpConfigurado()) {
    throw new Error(
      'No se puede enviar el resumen semanal: falta configurar SMTP_HOST, SMTP_USER y SMTP_PASS'
    );
  }

  const periodo = lunesDeLaSemana(ahora);
  const destinatarios = await avisoRepository.destinatariosDelResumen();

  const cuenta = {
    periodo,
    considerados: destinatarios.length,
    enviados: 0,
    sinActividad: 0,
    yaEnviados: 0,
    fallidos: 0
  };

  for (const destinatario of destinatarios) {
    const estadisticas = await estadisticaService.obtenerMisEstadisticas(
      destinatario.id_usuario,
      DIAS
    );

    const { escaneos, visitas, clics } = estadisticas.totales;

    if (escaneos + visitas + clics === 0) {
      cuenta.sinActividad += 1;
      continue;
    }

    const reservado = await avisoRepository.reservarEnvio(
      destinatario.id_usuario,
      TIPO,
      periodo
    );

    if (!reservado) {
      cuenta.yaEnviados += 1;
      continue;
    }

    try {
      const envio = await enviar(destinatario.correo, {
        negocio: destinatario.nombre_negocio,
        dias: estadisticas.dias,
        totales: estadisticas.totales,
        enlacesMasPulsados: estadisticas.enlacesMasPulsados
      });

      cuenta.enviados += 1;

      // En desarrollo el correo no llega a nadie: Ethereal lo publica en una
      // URL temporal. Sin imprimirla no hay manera de ver que se mando, y es
      // lo unico que permite revisar el mensaje antes de configurar un SMTP
      // de verdad. En produccion no hay URL y no se imprime nada.
      if (envio && envio.urlPrevisualizacion) {
        console.log(`  ${destinatario.correo}: ${envio.urlPrevisualizacion}`);
      }
    } catch (error) {
      await avisoRepository.liberarEnvio(destinatario.id_usuario, TIPO, periodo);
      cuenta.fallidos += 1;

      console.error(
        `No se pudo enviar el resumen a la cuenta ${destinatario.id_usuario}:`,
        error.message
      );
    }
  }

  return cuenta;
}

module.exports = {
  enviarResumenesSemanales,
  lunesDeLaSemana,
  TIPO,
  DIAS
};
