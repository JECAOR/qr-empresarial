// ============================================
// RESUMEN-SEMANAL.JS — la tarea que manda el resumen de actividad (RF-12)
//
// No vive dentro del servidor web, y es a proposito. Un temporizador en el
// proceso de Express habria sido mas corto de escribir, pero:
//
//   - No se puede probar. Una prueba tendria que esperar a que el reloj
//     llegue, o adelantarlo con trucos; aqui basta con llamar al servicio.
//   - Se duplica. Si algun dia corren dos instancias del servidor para
//     repartir la carga, las dos tendrian su temporizador y cada negocio
//     recibiria dos correos. (La reserva de aviso_enviado lo impediria de
//     todos modos, pero no hay que llegar a depender de eso.)
//   - Depende de que el servidor no se reinicie justo a esa hora.
//
// Asi se lanza desde el Programador de tareas de Windows, los lunes:
//
//   Programa:   node
//   Argumentos: src/tareas/resumen-semanal.js
//   Iniciar en: C:\ruta\al\proyecto\backend
//
// O a mano, para probarlo:  npm run avisos:semanal
//
// Correr la tarea dos veces en la misma semana no manda nada dos veces: la
// tabla aviso_enviado lo impide. Se puede relanzar sin miedo.
// ============================================

require('dotenv').config();

const pool = require('../config/database');
const avisoService = require('../modules/avisos/aviso.service');

async function principal() {
  const inicio = Date.now();

  const cuenta = await avisoService.enviarResumenesSemanales();

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log(`Resumen semanal del periodo ${cuenta.periodo} (${segundos}s)`);
  console.log(`  Cuentas consideradas: ${cuenta.considerados}`);
  console.log(`  Enviados:             ${cuenta.enviados}`);
  console.log(`  Sin actividad:        ${cuenta.sinActividad}`);
  console.log(`  Ya enviados antes:    ${cuenta.yaEnviados}`);
  console.log(`  Fallidos:             ${cuenta.fallidos}`);

  // Que un envio falle no invalida la corrida, pero el Programador de tareas
  // solo entiende el codigo de salida: devolviendo 1 queda marcada en rojo
  // en su historial y se puede ver que algo paso.
  return cuenta.fallidos === 0 ? 0 : 1;
}

principal()
  .then(async (codigo) => {
    await pool.end();
    process.exit(codigo);
  })
  .catch(async (error) => {
    console.error('La tarea del resumen semanal no pudo completarse:');
    console.error(error.message);

    // El pool mantiene el proceso vivo si no se cierra, y una tarea
    // programada que no termina se queda colgada hasta el siguiente arranque.
    await pool.end().catch(() => {});
    process.exit(1);
  });
