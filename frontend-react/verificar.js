// ============================================
// VERIFICAR.JS — comprobación de extremo a extremo (Guía Frontend N.º 1)
//
// El punto 5.6 de la guía pide contrastar tres cosas: lo que responde la API,
// lo que hay guardado en MySQL y lo que ve el navegador. Este guion hace la
// parte automatizable y deja escrita la consulta SQL para la otra.
//
// No tiene dependencias: usa el fetch que ya trae Node.
//
//   1. cd backend && npm run dev
//   2. node frontend-react/verificar.js
// ============================================

const API = process.env.VITE_API_URL || 'http://localhost:3000/api';
const SLUG = process.env.VITE_SLUG_DEMO || 'panaderia-la-espiga';

// Cuenta de demostración que siembra database/seed.sql. Su contraseña está en
// el repositorio a propósito; no es una credencial real.
const CUENTA = { correo: 'contacto@laespiga.co', contrasena: 'Clave123*' };

const ORIGEN_VITE = 'http://localhost:5173';

function titulo(texto) {
  console.log(`\n${texto}\n${'─'.repeat(texto.length)}`);
}

function resultado(ok, texto) {
  console.log(`  ${ok ? 'ok   ' : 'FALLA'} ${texto}`);
}

(async () => {
  // ----------------------------------------------------------------
  // 1. La ruta pública responde, y el navegador tiene permiso de leerla
  // ----------------------------------------------------------------
  titulo('1. GET público, con el origen de Vite (CORS)');

  const publico = await fetch(`${API}/publico/${SLUG}`, {
    headers: { Origin: ORIGEN_VITE }
  });

  const permitido = publico.headers.get('access-control-allow-origin');

  resultado(publico.status === 200, `HTTP ${publico.status}`);
  resultado(permitido === ORIGEN_VITE, `Access-Control-Allow-Origin: ${permitido}`);

  const { data } = await publico.json();

  resultado(Array.isArray(data.contenido), 'data.contenido es un arreglo');
  console.log(`\n  negocio: ${data.perfil.nombreNegocio}`);
  console.log(`  bloques que ve quien escanea el código: ${data.contenido.length}`);

  for (const b of data.contenido) {
    console.log(`     ${b.tipo.padEnd(7)} ${b.categoria.padEnd(14)} ${b.titulo}`);
  }

  // ----------------------------------------------------------------
  // 2. Un negocio que no existe
  // ----------------------------------------------------------------
  titulo('2. Un slug inexistente');

  const inexistente = await fetch(`${API}/publico/negocio-que-no-existe`);
  const fallo = await inexistente.json();

  resultado(inexistente.status === 404, `HTTP ${inexistente.status} — "${fallo.message}"`);

  // ----------------------------------------------------------------
  // 3. La misma información, vista por su dueño
  //
  // Es el equivalente de la "ruta interna" del punto 6 de la guía: la
  // pública solo muestra lo que está activo; la del dueño, todo.
  // ----------------------------------------------------------------
  titulo('3. La ruta pública frente a la del dueño');

  const sesion = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CUENTA)
  });

  if (sesion.status !== 200) {
    resultado(false, `no se pudo iniciar sesión: HTTP ${sesion.status}`);
    return;
  }

  const { data: autenticado } = await sesion.json();

  const propio = await fetch(`${API}/contenido`, {
    headers: { Authorization: `Bearer ${autenticado.token}` }
  });

  const todos = (await propio.json()).data;
  const ocultos = todos.filter((b) => !b.activo);

  console.log(`  el dueño ve:        ${todos.length} bloques`);
  console.log(`  el público ve:      ${data.contenido.length} bloques`);
  console.log(`  diferencia:         ${todos.length - data.contenido.length}`);

  for (const b of ocultos) {
    console.log(`     oculto: ${b.titulo}`);
  }

  resultado(
    todos.length - data.contenido.length === ocultos.length,
    'la diferencia son exactamente los bloques desactivados'
  );

  // ----------------------------------------------------------------
  // 4. Lo que hay que mirar en MySQL
  // ----------------------------------------------------------------
  titulo('4. Para contrastar en MySQL Workbench');

  console.log(`
  SELECT 'enlace' AS clase, e.titulo, c.nombre AS categoria, e.activo
    FROM enlace e
    JOIN categoria_enlace c ON c.id_categoria_enlace = e.id_categoria_enlace
    JOIN perfil_empresarial p ON p.id_perfil = e.id_perfil
   WHERE p.slug = '${SLUG}'
  UNION ALL
  SELECT 'elemento', el.titulo, c.nombre, el.activo
    FROM elemento el
    JOIN categoria_elemento c ON c.id_categoria_elemento = el.id_categoria_elemento
    JOIN perfil_empresarial p ON p.id_perfil = el.id_perfil
   WHERE p.slug = '${SLUG}'
   ORDER BY activo DESC, titulo;

  Debe devolver ${todos.length} filas: las ${data.contenido.length} que ve el público con activo = 1,
  y ${ocultos.length} con activo = 0 que la API pública no devuelve.

  Una tabla con registros no implica que el GET público los muestre. Aquí
  además hace falta que la cuenta esté activa y que el código QR esté
  encendido; si no, la respuesta correcta es 404.
`);
})();
