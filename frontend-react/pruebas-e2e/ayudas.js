// ============================================
// PRUEBAS-E2E/AYUDAS.JS — el apoyo compartido
//
// Estas pruebas no levantan el backend ni necesitan MySQL: comprueban el
// frontend compilado en un navegador de verdad, y deben pasar igual en una
// maquina donde no haya nada de eso instalado. Igual que la suite del
// frontend original, se simula la API dentro del navegador.
//
//   simularApi    responde las peticiones a /api/... sin salir del navegador
//   sembrarSesion deja el token guardado antes de que cargue la aplicacion
//   prepararSesion hace las dos, que es lo habitual
//
// El simulador RECUERDA lo que se le manda -el orden del contenido, el
// estado del codigo, el perfil-, como haria el servidor: una prueba que
// reordena y recarga tiene que encontrar el orden nuevo. Sin memoria, una
// prueba de reordenar pasaria aunque la pantalla no mandara nada.
// ============================================

import { expect } from '@playwright/test';

export const TOKEN = 'token-de-pruebas-sin-valor-real';

export const USUARIO = {
  idUsuario: 7,
  nombre: 'Panadería La Espiga',
  correo: 'contacto@laespiga.co',
  rol: 'empresa',
  estado: 'activo'
};

export const ADMINISTRADOR = {
  idUsuario: 1,
  nombre: 'QR Empresarial',
  correo: 'admin@caferaices.co',
  rol: 'administrador',
  estado: 'activo'
};

export const PERFIL = {
  idPerfil: 3,
  nombreNegocio: 'Panadería La Espiga',
  slug: 'panaderia-la-espiga',
  categoria: 'Panadería',
  descripcion: 'Pan de masa madre horneado cada mañana en Chapinero.',
  telefono: '+57 300 123 4567',
  correoContacto: 'contacto@laespiga.co',
  direccion: 'Calle 53 #10-22, Bogotá',
  horario: 'Lunes a sábado, 6:00 a.m. – 7:00 p.m.',
  instagram: '@laespiga',
  tema: 'indigo',
  imagen: null
};

/**
 * Los bloques de contenido, siempre recien hechos.
 *
 * Una funcion y no una constante: cada prueba necesita su propia copia. Si
 * compartieran el arreglo, la que reordena dejaria el orden cambiado para la
 * siguiente, y eso sale como prueba intermitente.
 */
function contenidoInicial() {
  // Cada bloque lleva su categoria como objeto porque es lo que devuelve
  // GET /contenido: contenido.service.js la arma siempre, incluso para un
  // texto, con "Texto" por defecto.
  return [
    { id: 'enlace-41', tipo: 'enlace', seccion: 'menu', titulo: 'Escríbenos por WhatsApp', detalle: 'https://wa.me/573001234567', activo: true, orden: 1, categoria: { id: 1, nombre: 'WhatsApp', icono: 'whatsapp' } },
    { id: 'enlace-42', tipo: 'enlace', seccion: 'menu', titulo: 'Cómo llegar', detalle: 'https://maps.app.goo.gl/espiga', activo: true, orden: 2, categoria: { id: 2, nombre: 'Google Maps', icono: 'map' } },
    { id: 'enlace-43', tipo: 'enlace', seccion: 'menu', titulo: 'Síguenos en Instagram', detalle: 'https://instagram.com/laespiga', activo: true, orden: 3, categoria: { id: 3, nombre: 'Instagram', icono: 'instagram' } },
    { id: 'elemento-44', tipo: 'texto', seccion: 'menu', titulo: 'Horneamos cada mañana', detalle: 'Masa madre de fermentación lenta.', activo: true, orden: 4, categoria: { id: 11, nombre: 'Texto', icono: 'text' } },
    { id: 'elemento-45', tipo: 'texto', seccion: 'menu', titulo: 'Pedidos para llevar', detalle: 'Solo con un día de antelación.', activo: false, orden: 5, categoria: { id: 11, nombre: 'Texto', icono: 'text' } },
    { id: 'enlace-46', tipo: 'enlace', seccion: 'promos', titulo: 'Combo desayuno', detalle: 'https://laespiga.co/combo', activo: true, orden: 1, categoria: { id: 4, nombre: 'Sitio web', icono: 'link' } }
  ];
}

/**
 * Un bloque como lo devuelve /publico/:slug, que NO es como lo devuelve
 * /contenido.
 *
 * La diferencia es real y esta en el backend: contenido.service.js arma
 * `categoria: {id, nombre, icono}` para el panel del dueno, y
 * publico.service.js aplana la columna a `categoria: "WhatsApp"`. Por eso
 * ListaBloques lee `bloque.categoria?.nombre` y TarjetaContenido pinta
 * `{categoria}` tal cual.
 *
 * Simular las dos iguales haria pasar una prueba que en la aplicacion de
 * verdad reventaria con «Objects are not valid as a React child». Paso aqui:
 * la primera version de este archivo mandaba el objeto a la pantalla publica
 * y la dejo en blanco.
 */
function aFormaPublica(bloque) {
  return {
    id: bloque.id,
    tipo: bloque.tipo,
    seccion: bloque.seccion,
    titulo: bloque.titulo,
    detalle: bloque.detalle,
    categoria: bloque.categoria?.nombre ?? null,
    icono: bloque.categoria?.icono ?? null
  };
}

const CATEGORIAS = {
  enlaces: [
    { id: 1, nombre: 'WhatsApp' },
    { id: 2, nombre: 'Google Maps' },
    { id: 3, nombre: 'Instagram' },
    { id: 4, nombre: 'Sitio web' }
  ],
  elementos: [
    { id: 11, nombre: 'Plato' },
    { id: 12, nombre: 'Promoción' }
  ]
};

const USUARIOS_ADMIN = [
  { idUsuario: 1, nombre: 'QR Empresarial', correo: 'admin@caferaices.co', rol: 'administrador', estado: 'activo' },
  { idUsuario: 7, nombre: 'Panadería La Espiga', correo: 'contacto@laespiga.co', rol: 'empresa', estado: 'activo' },
  { idUsuario: 8, nombre: 'Fonda La Cosecha', correo: 'camila@fondalacosecha.co', rol: 'empresa', estado: 'restringido' }
];

/** Una serie de actividad como la que devuelve GET /estadisticas. */
function serieDe(dias) {
  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(Date.UTC(2026, 9, 1 + i));

    return {
      fecha: fecha.toISOString().slice(0, 10),
      etiqueta: ['Jue', 'Vie', 'Sáb', 'Dom', 'Lun', 'Mar', 'Mié'][i % 7],
      escaneos: 4 + (i % 5) * 3,
      visitas: 2 + (i % 4),
      clics: 1 + (i % 3)
    };
  });
}

// Un PNG de 1x1 y un PDF minimo, en base64. Hacen falta de verdad: la
// descarga se comprueba abriendo el archivo que guardo el navegador y
// mirando sus primeros bytes, y para eso el cuerpo tiene que ser el formato
// que dice ser.
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const SVG_QR = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#fff"/><rect x="40" y="40" width="80" height="80" fill="#111827"/></svg>';
const PDF_MINIMO = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';

/**
 * Intercepta /api/... y responde con datos fijos, con memoria.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} opciones
 * @param {boolean} [opciones.comoAdministrador] GET /usuarios/me responde el
 *   administrador. Tiene que coincidir con la sesion sembrada: si devolviera
 *   siempre la cuenta de empresa, AuthContext sobrescribiria la sesion al
 *   confirmarla contra el servidor y la barra perderia sus enlaces.
 * @param {string} [opciones.credencialesMalas] Mensaje del 401 en el login.
 * @param {boolean} [opciones.sinQr] La cuenta no ha generado su codigo.
 * @param {boolean} [opciones.perfilPublicoNoDisponible] /publico/:slug da 404.
 * @param {string} [opciones.errorAlOrdenar] Mensaje del fallo al reordenar.
 * @param {string} [opciones.errorAlDescargar] Mensaje del fallo en /qr/imagen.
 * @param {string} [opciones.tema] El color de marca del negocio (RF-12):
 *   indigo, teal o terracota. Por defecto el de PERFIL.
 * @param {boolean} [opciones.sinMenu] El negocio no publico nada en la
 *   seccion del menu. Es el caso en que no debe ofrecerse el boton que lleva
 *   a esa pantalla.
 */
export async function simularApi(page, opciones = {}) {
  const {
    comoAdministrador = false,
    credencialesMalas = null,
    sinQr = false,
    perfilPublicoNoDisponible = false,
    errorAlOrdenar = null,
    errorAlDescargar = null,
    tema = PERFIL.tema,
    sinMenu = false
  } = opciones;

  const cuenta = comoAdministrador ? ADMINISTRADOR : USUARIO;

  let contenido = contenidoInicial().filter((b) => !sinMenu || b.seccion !== 'menu');
  let perfil = { ...PERFIL, tema };
  let qr = { idQr: 9, url: `/p/${PERFIL.slug}`, activo: true, fechaCreacion: '2026-09-18' };

  // Deja de faltar en cuanto se genera: la pantalla vuelve a pedirlo despues
  // del POST, y si el simulador siguiera contestando 404 se quedaria
  // ofreciendo «Generar mi codigo» como si no hubiera pasado nada.
  let faltaElQr = sinQr;

  // Lo que la pantalla mando, para poder comprobarlo. Son el registro de los
  // eventos del RF-11 y de los reordenamientos, que es lo que no se puede
  // deducir mirando la pantalla.
  const eventos = [];
  const ordenes = [];

  page.eventos = eventos;
  page.ordenes = ordenes;

  // Red de seguridad: ninguna prueba debe salir a internet. Las tarjetas de
  // contenido llevan enlaces reales -wa.me, maps.app.goo.gl- y abrirlos
  // haria depender el resultado de la conexion, ademas de molestar a un
  // servidor ajeno en cada corrida.
  //
  // Va en el contexto y no en la pagina porque esos enlaces abren una
  // pestaña nueva (target="_blank"), y una ruta puesta en la pagina no la
  // alcanza: la pestaña nueva saldria a la red de verdad.
  await page.context().route(/^https?:\/\/(?!localhost(:|\/|$))/, (ruta) => ruta.abort());

  await page.route('**/api/**', async (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    const camino = url.pathname.replace(/^\/api/, '');
    const metodo = peticion.method();

    const json = (status, cuerpo) => ruta.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(cuerpo)
    });

    const cuerpoEnviado = () => {
      try {
        return JSON.parse(peticion.postData() ?? '{}');
      } catch {
        return {};
      }
    };

    // --- Sesion ---
    if (camino === '/auth/login') {
      if (credencialesMalas) return json(401, { message: credencialesMalas });

      return json(200, {
        message: 'Inicio de sesión correcto',
        data: { token: TOKEN, usuario: cuenta }
      });
    }

    if (camino === '/auth/logout') return json(200, { message: 'Sesión cerrada correctamente' });

    if (camino === '/auth/registro') return json(201, { message: 'Cuenta creada correctamente', data: cuenta });

    if (camino === '/auth/recuperar-contrasena') {
      return json(200, { message: 'Si el correo está registrado, recibirá un enlace' });
    }

    if (camino === '/usuarios/me' && metodo === 'GET') return json(200, { data: cuenta });

    if (camino === '/usuarios/me/preferencias') {
      return json(200, { data: { resumen: true, novedades: false } });
    }

    // --- Perfil empresarial ---
    if (camino === '/perfiles/me') {
      if (metodo === 'PUT') {
        perfil = { ...perfil, ...cuerpoEnviado() };

        return json(200, { message: 'Perfil actualizado', data: perfil });
      }

      return json(200, { data: perfil });
    }

    if (camino === '/perfiles/me/tema') {
      perfil = { ...perfil, tema: cuerpoEnviado().tema };

      return json(200, { message: 'Tema actualizado', data: perfil });
    }

    // --- Contenido ---
    if (camino === '/contenido/categorias') return json(200, { data: CATEGORIAS });

    if (camino === '/contenido/orden') {
      const { ids } = cuerpoEnviado();

      ordenes.push(ids);

      if (errorAlOrdenar) return json(409, { message: errorAlOrdenar });

      // Se reordena de verdad: la pantalla vuelve a pedir la lista despues de
      // guardar, y si el simulador devolviera el orden viejo la prueba
      // pasaria aunque la pantalla no hubiera mandado nada util.
      const porId = new Map(contenido.map((b) => [b.id, b]));

      contenido = [
        ...ids.map((id) => porId.get(id)).filter(Boolean),
        ...contenido.filter((b) => !ids.includes(b.id))
      ];

      return json(200, { message: 'Orden actualizado' });
    }

    if (camino === '/contenido' && metodo === 'GET') return json(200, { data: contenido });

    if (camino === '/contenido' && metodo === 'POST') {
      const datos = cuerpoEnviado();
      const nuevo = {
        id: `${datos.tipo === 'enlace' ? 'enlace' : 'elemento'}-${900 + contenido.length}`,
        activo: true,
        orden: contenido.length + 1,
        categoria: null,
        ...datos
      };

      contenido = [...contenido, nuevo];

      return json(201, { message: 'Bloque agregado', data: nuevo });
    }

    const bloque = camino.match(/^\/contenido\/([^/]+)(\/estado)?$/);

    if (bloque) {
      const [, id, esEstado] = bloque;

      if (metodo === 'DELETE') {
        contenido = contenido.filter((b) => b.id !== id);

        return json(200, { message: 'Bloque eliminado' });
      }

      contenido = contenido.map((b) => (b.id === id
        ? { ...b, ...(esEstado ? { activo: cuerpoEnviado().activo } : cuerpoEnviado()) }
        : b));

      return json(200, { message: esEstado ? 'Estado actualizado' : 'Bloque actualizado' });
    }

    // --- Codigo QR ---
    if (camino === '/qr/imagen') {
      if (errorAlDescargar) return json(500, { message: errorAlDescargar });

      const formato = url.searchParams.get('formato') ?? 'png';

      const archivo = {
        png: { tipo: 'image/png', cuerpo: Buffer.from(PNG_1X1, 'base64') },
        svg: { tipo: 'image/svg+xml', cuerpo: Buffer.from(SVG_QR) },
        pdf: { tipo: 'application/pdf', cuerpo: Buffer.from(PDF_MINIMO) }
      }[formato];

      return ruta.fulfill({
        status: 200,
        contentType: archivo.tipo,
        headers: { 'content-disposition': `attachment; filename="codigo-qr-${PERFIL.slug}.${formato}"` },
        body: archivo.cuerpo
      });
    }

    if (camino === '/qr/estado') {
      qr = { ...qr, activo: cuerpoEnviado().activo };

      return json(200, { message: 'Estado actualizado', data: qr });
    }

    if (camino === '/qr') {
      if (metodo === 'POST') {
        qr = { idQr: 9, url: `/p/${PERFIL.slug}`, activo: true, fechaCreacion: '2026-10-31' };
        faltaElQr = false;

        return json(201, { message: 'Código generado', data: qr });
      }

      if (faltaElQr) return json(404, { message: 'Esta cuenta todavía no tiene un código' });

      return json(200, { data: qr });
    }

    // --- Actividad ---
    if (camino === '/estadisticas') {
      const dias = Number(url.searchParams.get('dias') ?? 7);

      return json(200, {
        data: {
          totales: { escaneos: 248, visitas: 96, clics: 73, conversion: 29.4 },
          serie: serieDe(dias),
          enlacesMasPulsados: [
            { id: 41, titulo: 'Escríbenos por WhatsApp', clics: 38 },
            { id: 42, titulo: 'Cómo llegar', clics: 21 }
          ]
        }
      });
    }

    // --- Gestion de usuarios y administracion ---
    if (camino === '/usuarios' && metodo === 'GET') return json(200, { data: USUARIOS_ADMIN });

    if (camino === '/admin/resumen') {
      return json(200, {
        data: {
          cuentas: { total: 3, activas: 2, restringidas: 1 },
          perfiles: { total: 2, conQr: 2 },
          actividad: { escaneos: 248, visitas: 96, clics: 73 }
        }
      });
    }

    // Las columnas y el entrecomillado son los de admin.service.js: cada
    // celda va entre comillas porque el nombre de un negocio puede llevar
    // una coma.
    if (camino === '/admin/reportes/usuarios') {
      const COLUMNAS = ['id', 'nombre', 'correo', 'rol', 'estado', 'fecha_registro',
        'ultimo_acceso', 'negocio', 'slug', 'bloques_activos', 'codigo_qr',
        'escaneos', 'visitas', 'clics'];

      const csv = [
        COLUMNAS.map((c) => `"${c}"`).join(','),
        ...USUARIOS_ADMIN.map((u) => [u.idUsuario, u.nombre, u.correo, u.rol, u.estado,
          '2026-09-02', '2026-10-17', u.nombre, 'panaderia-la-espiga', 4, 'si', 248, 96, 73]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      return ruta.fulfill({
        status: 200,
        contentType: 'text/csv; charset=utf-8',
        headers: { 'content-disposition': 'attachment; filename="usuarios-2026-10-31.csv"' },
        body: csv
      });
    }

    // Las filas de la administracion no tienen la forma de GET /usuarios: el
    // identificador se llama `id` y no `idUsuario`, y cada fila trae su
    // perfil y su actividad. `perfil` puede ser null -una cuenta creada por
    // el administrador no tiene-, pero `actividad` NO: admin.service.js la
    // arma siempre con ceros. Mandarla en null dejo la pantalla en blanco
    // con «Cannot read properties of null» la primera vez que se simulo
    // esto, y el defecto estaba en la simulacion, no en la pantalla.
    if (camino === '/admin/usuarios') {
      const pagina = Number(url.searchParams.get('pagina') ?? 1);
      const porPagina = Number(url.searchParams.get('porPagina') ?? 10);

      const filas = USUARIOS_ADMIN.map((u) => ({
        id: u.idUsuario,
        nombre: u.nombre,
        correo: u.correo,
        rol: u.rol,
        estado: u.estado,
        fechaRegistro: '2026-09-02',
        ultimoAcceso: '2026-10-17T14:20:00.000Z',
        perfil: u.rol === 'empresa'
          ? { nombreNegocio: u.nombre, slug: 'panaderia-la-espiga', bloquesActivos: 4, qr: true }
          : null,
        actividad: { escaneos: 248, visitas: 96, clics: 73 }
      }));

      return json(200, {
        data: filas,
        paginacion: {
          pagina, porPagina, total: filas.length, paginas: 1
        }
      });
    }

    const detalleAdmin = camino.match(/^\/admin\/usuarios\/(\d+)$/);

    if (detalleAdmin) {
      const buscado = USUARIOS_ADMIN.find((u) => u.idUsuario === Number(detalleAdmin[1]));

      if (!buscado) return json(404, { message: 'El usuario no existe' });

      return json(200, {
        data: {
          id: buscado.idUsuario,
          nombre: buscado.nombre,
          correo: buscado.correo,
          rol: buscado.rol,
          estado: buscado.estado,
          fechaRegistro: '2026-09-02',
          ultimoAcceso: '2026-10-17T14:20:00.000Z',
          perfil: buscado.rol === 'empresa'
            ? { nombreNegocio: buscado.nombre, slug: 'panaderia-la-espiga', bloquesActivos: 4, qr: true }
            : null,
          actividad: { escaneos: 248, visitas: 96, clics: 73 },
          ultimosEventos: [
            { tipo: 'escaneo', fecha: '2026-10-30T18:02:00.000Z' },
            { tipo: 'clic', fecha: '2026-10-30T18:03:00.000Z' }
          ]
        }
      });
    }

    // --- Perfil publico y eventos (RF-09 y RF-11) ---
    const publico = camino.match(/^\/publico\/([^/]+)(\/eventos)?$/);

    if (publico) {
      const [, slug, esEvento] = publico;

      if (esEvento) {
        eventos.push({ slug, ...cuerpoEnviado() });

        return ruta.fulfill({ status: 204, body: '' });
      }

      if (perfilPublicoNoDisponible || slug !== PERFIL.slug) {
        return json(404, { message: 'Este perfil no está disponible' });
      }

      const visibles = contenido.filter((b) => b.activo).map(aFormaPublica);

      const porSeccion = visibles.reduce((acumulado, b) => {
        acumulado[b.seccion] = [...(acumulado[b.seccion] ?? []), b];

        return acumulado;
      }, {});

      return json(200, { data: { perfil, contenido: visibles, porSeccion } });
    }

    // Una ruta sin simular es un error de la prueba, no del frontend: se dice
    // en lugar de dejarla pasar al servidor de las pruebas, que devolveria el
    // index.html y el fallo saldria como "no se pudo convertir el JSON".
    return json(501, { message: `Ruta sin simular en ayudas.js: ${metodo} ${camino}` });
  });
}

/**
 * Deja una sesion abierta antes de que cargue la aplicacion.
 *
 * Va en addInitScript y no en una evaluacion posterior porque AuthContext
 * lee sessionStorage en su primer efecto: puesto despues, la guardia ya
 * habria mandado al login.
 */
export async function sembrarSesion(page, usuario = USUARIO) {
  await page.addInitScript(([clave, claveUsuario, valor, quien]) => {
    sessionStorage.setItem(clave, valor);
    sessionStorage.setItem(claveUsuario, JSON.stringify(quien));
  }, ['qre_token', 'qre_usuario', TOKEN, usuario]);
}

/** Lo habitual: la API simulada y una sesion de empresa abierta. */
export async function prepararSesion(page, opciones = {}) {
  await simularApi(page, opciones);
  await sembrarSesion(page, opciones.comoAdministrador ? ADMINISTRADOR : USUARIO);
}

/**
 * Entra por la pantalla de login, escribiendo y pulsando como una persona.
 *
 * No siembra la sesion: varias pruebas comprueban justo a donde lleva el
 * formulario, y para eso hay que pasar por el.
 */
export async function entrarPorElFormulario(page, { correo, contrasena } = {}) {
  await page.getByLabel('Correo electrónico').fill(correo ?? USUARIO.correo);
  await page.getByLabel('Contraseña').fill(contrasena ?? 'Clave-de-pruebas-1');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Espera a que la barra de navegacion aparezca, que es la señal de sesion. */
export async function esperarPanel(page, quien = USUARIO) {
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Contenido' })).toBeVisible();
  await expect(page.locator('.barra__quien')).toContainText(quien.nombre);
}
