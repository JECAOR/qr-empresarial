// ============================================
// tests/ayudas.js — apoyo compartido de las pruebas
//
// Desde que el frontend habla con la API, las pantallas privadas necesitan
// una sesión y las públicas hacen peticiones al backend. Estas pruebas no
// levantan el backend a propósito: comprueban el frontend, y deben pasar
// igual en una máquina sin MySQL y sin el servidor encendido.
//
// Para eso se hacen dos cosas:
//   simularApi    responde las peticiones a /api/... sin salir del navegador
//   sembrarSesion deja un token guardado antes de que cargue la página
// ============================================

const USUARIO = {
  idUsuario: 5,
  nombre: "Fonda La Cosecha",
  correo: "camila@fondalacosecha.co",
  rol: "empresa",
  estado: "activo"
};

const ADMINISTRADOR = {
  idUsuario: 1,
  nombre: "Cafe Raices S.A.",
  correo: "admin@caferaices.co",
  rol: "administrador",
  estado: "activo"
};

const TOKEN = "token-de-prueba-sin-valor-real";

// Cuentas que devuelve la administracion simulada (RF-13).
//
// Se eligen a proposito para cubrir los casos que la pantalla trata distinto:
// una cuenta sin perfil, una que nunca entro, una restringida y el propio
// administrador, que no puede actuar sobre si mismo.
const USUARIOS_ADMIN = [
  {
    id: 5, nombre: "Fonda La Cosecha", correo: "camila@fondalacosecha.co",
    rol: "empresa", estado: "activo",
    fechaRegistro: "2026-09-02", ultimoAcceso: "2026-10-17T14:20:00.000Z",
    perfil: { nombreNegocio: "Fonda La Cosecha", slug: "fonda-la-cosecha", bloquesActivos: 7, qr: true },
    actividad: { escaneos: 248, visitas: 96, clics: 73 }
  },
  {
    id: 8, nombre: "Panaderia La Espiga", correo: "contacto@laespiga.co",
    rol: "empresa", estado: "restringido",
    fechaRegistro: "2026-08-14", ultimoAcceso: "2026-06-01T09:00:00.000Z",
    perfil: { nombreNegocio: "Panaderia La Espiga", slug: "panaderia-la-espiga", bloquesActivos: 2, qr: false },
    actividad: { escaneos: 12, visitas: 4, clics: 1 }
  },
  {
    id: 11, nombre: "Cuenta Sin Estrenar", correo: "nueva@ejemplo.co",
    rol: "empresa", estado: "activo",
    fechaRegistro: "2026-10-16", ultimoAcceso: null,
    perfil: null,
    actividad: { escaneos: 0, visitas: 0, clics: 0 }
  },
  {
    id: 1, nombre: "Cafe Raices S.A.", correo: "admin@caferaices.co",
    rol: "administrador", estado: "activo",
    fechaRegistro: "2026-07-01", ultimoAcceso: "2026-10-18T08:00:00.000Z",
    perfil: { nombreNegocio: "QR Empresarial", slug: "qr-empresarial", bloquesActivos: 0, qr: null },
    actividad: { escaneos: 0, visitas: 0, clics: 0 }
  }
];

// Los ultimos eventos que devuelve el detalle de una cuenta (RF-13)
const EVENTOS_ADMIN = [
  { tipo: "escaneo", fecha: "2026-10-17T15:40:00.000Z", enlace: null },
  { tipo: "clic", fecha: "2026-10-17T15:41:00.000Z", enlace: "Ver menu completo" },
  { tipo: "visita", fecha: "2026-10-16T09:12:00.000Z", enlace: null }
];

const RESUMEN_ADMIN = {
  total: 4, activos: 3, restringidos: 1, administradores: 1,
  nuncaEntraron: 1, inactivos30Dias: 1, nuevos30Dias: 1
};

// Estadisticas que devuelve la API simulada (RF-11)
const ESTADISTICAS = {
  dias: 7,
  totales: { escaneos: 248, visitas: 96, clics: 73, conversion: 21.2 },
  serie: [
    { fecha: "2026-10-11", etiqueta: "Dom", escaneos: 20, visitas: 8, clics: 6 },
    { fecha: "2026-10-12", etiqueta: "Lun", escaneos: 31, visitas: 12, clics: 9 },
    { fecha: "2026-10-13", etiqueta: "Mar", escaneos: 28, visitas: 11, clics: 8 },
    { fecha: "2026-10-14", etiqueta: "Mié", escaneos: 44, visitas: 17, clics: 13 },
    { fecha: "2026-10-15", etiqueta: "Jue", escaneos: 52, visitas: 20, clics: 15 },
    { fecha: "2026-10-16", etiqueta: "Vie", escaneos: 40, visitas: 16, clics: 12 },
    { fecha: "2026-10-17", etiqueta: "Sáb", escaneos: 33, visitas: 12, clics: 10 }
  ],
  enlacesMasPulsados: [
    { idEnlace: 1, titulo: "Ver menú completo", categoria: "Página Web", clics: 41 },
    { idEnlace: 3, titulo: "WhatsApp directo", categoria: "WhatsApp", clics: 32 }
  ]
};

// Codigo QR que devuelve la API simulada (RF-07)
const QR = {
  idQr: 1,
  url: "http://localhost:3000/p/fonda-la-cosecha",
  slug: "fonda-la-cosecha",
  activo: true,
  fechaCreacion: "2026-10-17T12:00:00.000Z",
  fechaActualizacion: null
};

// Perfil empresarial que devuelve la API simulada (RF-04)
const PERFIL = {
  idPerfil: 7,
  nombreNegocio: "Fonda La Cosecha",
  categoria: "Restaurante colombiano",
  descripcion: "Sabores tradicionales de Antioquia.",
  direccion: "Cra. 35 #8A-45, El Poblado, Medellín",
  telefono: "+57 300 456 7890",
  correoContacto: "contacto@fondalacosecha.co",
  instagram: "@fondalacosecha",
  horario: "Mar-Dom 11:00–21:00",
  imagen: "https://ejemplo.co/logo.png",
  slug: "fonda-la-cosecha",
  urlPublica: "/p/fonda-la-cosecha",
  fechaCreacion: "2026-10-01T10:00:00.000Z",
  fechaActualizacion: null
};
const TOKEN_NUEVO = "token-de-prueba-emitido-tras-el-cambio";

// Categorías que devuelve la API simulada: las ocho de enlace del RF-05 y
// las cinco de elemento.
const CATEGORIAS = {
  enlaces: [
    { id: 1, nombre: "WhatsApp", icono: "whatsapp" },
    { id: 2, nombre: "Facebook", icono: "facebook" },
    { id: 3, nombre: "Instagram", icono: "instagram" },
    { id: 4, nombre: "Página Web", icono: "globe" },
    { id: 5, nombre: "LinkedIn", icono: "linkedin" },
    { id: 6, nombre: "YouTube", icono: "youtube" },
    { id: 7, nombre: "PDF", icono: "file-text" },
    { id: 8, nombre: "Google Maps", icono: "map-pin" }
  ],
  elementos: [
    { id: 1, nombre: "Texto", icono: "text" },
    { id: 2, nombre: "Botón", icono: "button" },
    { id: 3, nombre: "Imagen", icono: "image" },
    { id: 4, nombre: "Video", icono: "video" },
    { id: 5, nombre: "Horario", icono: "clock" }
  ]
};

// Contenido de partida. Repite las etiquetas del contenido de demostración
// que antes vivía en el navegador, porque varias pruebas las buscan por
// texto ("Menú del día", "Reservar mesa hoy").
function contenidoInicial() {
  const bloque = (id, tipo, seccion, titulo, detalle, categoria, orden, activo = true) => ({
    id, tipo, seccion, titulo, detalle,
    categoria: { id: categoria.id, nombre: categoria.nombre, icono: categoria.icono },
    orden, activo
  });

  const web = CATEGORIAS.enlaces[3];
  const insta = CATEGORIAS.enlaces[2];
  const wa = CATEGORIAS.enlaces[0];
  const texto = CATEGORIAS.elementos[0];
  const boton = CATEGORIAS.elementos[1];

  return [
    bloque("enlace-1", "enlace", "menu", "Ver menú completo", "https://fondalacosecha.co/menu", web, 1),
    bloque("elemento-1", "boton", "menu", "Reservar mesa", "/reservar", boton, 2),
    bloque("elemento-2", "texto", "menu", "Descripción del negocio", "Sabor casero de Antioquia desde 2015", texto, 3),
    bloque("enlace-2", "enlace", "menu", "Instagram", "https://instagram.com/fondalacosecha", insta, 4, false),
    bloque("enlace-3", "enlace", "menu", "WhatsApp directo", "https://wa.me/573004567890", wa, 5),

    bloque("enlace-4", "enlace", "promos", "Menú del día", "https://fondalacosecha.co/dia", web, 1),
    bloque("elemento-3", "boton", "promos", "2x1 en jugos naturales", "Martes y jueves", boton, 2),
    bloque("elemento-4", "texto", "promos", "Promo especial", "Bandeja paisa + bebida $28.000", texto, 3),

    bloque("elemento-5", "boton", "reservas", "Reservar mesa hoy", "/reservar", boton, 1),
    bloque("elemento-6", "boton", "reservas", "Reservas grupos grandes (+10 personas)", "/reservas-grupos", boton, 2),
    bloque("elemento-7", "texto", "reservas", "Política de cancelación", "Cancela hasta 2 horas antes sin costo", texto, 3)
  ];
}

/**
 * Intercepta todas las peticiones a la API y las responde con datos fijos.
 *
 * El patrón no lleva host: api.js apunta al puerto 3000 cuando las páginas
 * se sirven desde otro sitio, y así se atrapa igual.
 */
async function simularApi(page, opciones = {}) {
  const {
    enlaceInvalido = false,
    contrasenaActualIncorrecta = false,
    contrasenaIncorrectaAlBorrar = false,
    sinPerfil = false,
    errorAlGuardarPerfil = null,
    errorAlOrdenar = null,
    sinQr = false,
    // El codigo existe pero el dueno retiro su pagina (RF-09)
    qrRetirado = false,
    errorAlGenerarQr = null,
    perfilPublicoNoDisponible = false,
    sinEstadisticas = false,
    sinClics = false,
    errorAlGuardarDatos = null,
    errorAlGuardarPreferencias = null,
    errorAlAdministrar = null,
    comoAdministrador = false,
    // Para probar que no se enciende un codigo sobre un perfil vacio
    sinContenidoActivo = false
  } = opciones;

  // El simulador recuerda el perfil y el contenido, como haría el servidor:
  // si una prueba guarda y luego abre otra pantalla o recarga, debe
  // encontrar lo que guardó.
  let perfilActual = { ...PERFIL };
  let contenidoActual = sinContenidoActivo ? [] : contenidoInicial();
  let siguienteId = 100;

  // Una COPIA del codigo, no el objeto del modulo. Las pruebas que lo
  // retiran escribian sobre QR, que se comparte entre todas las de un mismo
  // trabajador: la siguiente que abriera la pantalla encontraba la pagina
  // retirada sin haberla tocado. Salia como prueba intermitente y costo
  // encontrarlo, porque en solitario pasaban siempre.
  let qrActual = { ...QR, activo: !qrRetirado };

  // Los eventos que informó la pantalla, para poder comprobarlos (RF-11)
  const eventosInformados = [];
  page.eventosInformados = eventosInformados;

  // Lo que se pidio sobre el perfil, para poder comprobar como se guarda el
  // tema (RF-12)
  const peticionesPerfil = [];
  page.peticionesPerfil = peticionesPerfil;

  // Datos de la cuenta y preferencias de avisos (RF-12), con memoria
  // GET /usuarios/me tiene que devolver la MISMA cuenta que se sembro en la
  // sesion. Si devolviera siempre la de empresa, la guardia sobrescribiria la
  // sesion de administrador en cuanto confirmara contra el servidor, y la
  // pantalla de administracion se quedaria sin su enlace en el menu y
  // tratando al administrador como si fuera otra cuenta.
  let cuentaActual = { ...(comoAdministrador ? ADMINISTRADOR : USUARIO) };
  let preferenciasActuales = { resumen: true, novedades: false, guardadas: false };

  // La administracion tambien recuerda: restringir una cuenta y volver a
  // listar tiene que devolverla restringida, como haria el servidor
  const usuariosAdmin = USUARIOS_ADMIN.map((u) => ({ ...u }));
  const resumenAdmin = { ...RESUMEN_ADMIN };
  const eliminadosAdmin = [];

  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const metodo = route.request().method();

    const responder = (status, cuerpo) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(cuerpo)
      });

    if (url.includes("/auth/login")) {
      return responder(200, {
        message: "Inicio de sesión correcto",
        data: { token: TOKEN, usuario: USUARIO }
      });
    }

    if (url.includes("/auth/registro")) {
      return responder(201, { message: "Cuenta creada correctamente", data: USUARIO });
    }

    if (url.includes("/auth/logout")) {
      return responder(200, { message: "Sesión cerrada correctamente" });
    }

    if (url.includes("/auth/recuperar-contrasena")) {
      return responder(200, {
        message: "Si el correo está registrado, recibirá un enlace para restablecer su contrasena"
      });
    }

    if (url.includes("/auth/restablecer")) {
      if (enlaceInvalido) {
        return responder(400, { message: "El enlace de recuperación no es válido o ya expiró" });
      }

      return responder(200, { message: "El enlace es válido" });
    }

    if (url.includes("/estadisticas")) {
      if (sinEstadisticas) {
        return responder(404, { message: "Esta cuenta todavía no tiene un perfil empresarial" });
      }

      if (sinClics) {
        return responder(200, {
          data: {
            ...ESTADISTICAS,
            totales: { ...ESTADISTICAS.totales, clics: 0, conversion: 0 },
            enlacesMasPulsados: []
          }
        });
      }

      return responder(200, { data: ESTADISTICAS });
    }

    if (url.includes("/eventos")) {
      // El registro de eventos responde 204 y sin cuerpo
      eventosInformados.push(JSON.parse(route.request().postData() || "{}"));

      return route.fulfill({ status: 204, body: "" });
    }

    if (url.includes("/publico/")) {
      if (perfilPublicoNoDisponible) {
        return responder(404, { message: "Este perfil no está disponible" });
      }

      // Solo el contenido activo: es lo que hace la consulta del servidor
      const visible = contenidoActual.filter((i) => i.activo);
      const porSeccion = {};

      for (const item of visible) {
        if (!porSeccion[item.seccion]) porSeccion[item.seccion] = [];
        porSeccion[item.seccion].push({
          id: item.id,
          tipo: item.tipo,
          seccion: item.seccion,
          titulo: item.titulo,
          detalle: item.detalle,
          categoria: item.categoria.nombre,
          icono: item.categoria.icono
        });
      }

      return responder(200, {
        data: {
          perfil: {
            nombreNegocio: perfilActual.nombreNegocio,
            categoria: perfilActual.categoria,
            descripcion: perfilActual.descripcion,
            direccion: perfilActual.direccion,
            telefono: perfilActual.telefono,
            correoContacto: perfilActual.correoContacto,
            instagram: perfilActual.instagram,
            horario: perfilActual.horario,
            imagen: perfilActual.imagen,
            slug: perfilActual.slug,
            actualizadoEn: null
          },
          contenido: visible,
          porSeccion
        }
      });
    }

    if (url.includes("/qr/imagen")) {
      // La descarga responde un archivo, no JSON. Basta un cuerpo minimo con
      // la firma del formato: las pruebas comprueban el tipo y el nombre.
      const formato = (url.match(/formato=(\w+)/) || [])[1] || "png";

      // El cuerpo no necesita ser una imagen de verdad: estas pruebas
      // comprueban el tipo de archivo y el nombre, no los pixeles.
      const cuerpos = {
        png: "imagen-png-de-prueba",
        svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        pdf: "%PDF-1.3 documento de prueba"
      };

      const tipos = {
        png: "image/png",
        svg: "image/svg+xml",
        pdf: "application/pdf"
      };

      return route.fulfill({
        status: 200,
        contentType: tipos[formato] || "application/octet-stream",
        headers: {
          "Content-Disposition": `attachment; filename="qr-${qrActual.slug}.${formato}"`,
          // Igual que el servidor: sin esto el navegador no deja leerla
          // desde otro origen y el archivo se guardaria con nombre generico
          "Access-Control-Expose-Headers": "Content-Disposition"
        },
        body: cuerpos[formato] || ""
      });
    }

    if (url.includes("/qr")) {
      if (metodo === "PATCH") {
        const cuerpo = JSON.parse(route.request().postData() || "{}");

        // La misma regla que el servidor: no se enciende un codigo sobre un
        // perfil vacio, porque quien lo escanee no encontraria nada
        if (cuerpo.activo === true && contenidoActual.filter((i) => i.activo).length === 0) {
          return responder(409, {
            message: "Agregue al menos un bloque de contenido activo antes de encender el código QR"
          });
        }

        qrActual = { ...qrActual, activo: cuerpo.activo };

        return responder(200, {
          message: qrActual.activo ? "Código QR activado" : "Código QR desactivado",
          data: qrActual
        });
      }

      if (metodo === "POST") {
        if (errorAlGenerarQr) {
          return responder(409, { message: errorAlGenerarQr });
        }

        return responder(201, { message: "Código QR generado correctamente", data: qrActual });
      }

      if (sinQr) {
        return responder(404, { message: "Este perfil todavía no tiene un código QR generado" });
      }

      return responder(200, { data: qrActual });
    }

    if (url.includes("/contenido/categorias")) {
      return responder(200, { data: CATEGORIAS });
    }

    if (url.includes("/contenido")) {
      const idEnLaUrl = (url.match(/\/contenido\/((?:enlace|elemento)-\d+)/) || [])[1];
      const cuerpo = route.request().postData() ? JSON.parse(route.request().postData()) : {};

      if (metodo === "POST") {
        const lista = cuerpo.tipo === "enlace" ? CATEGORIAS.enlaces : CATEGORIAS.elementos;
        const categoria = lista.find((c) => c.id === cuerpo.idCategoria) || lista[0];
        const clase = cuerpo.tipo === "enlace" ? "enlace" : "elemento";

        siguienteId += 1;

        const nuevo = {
          id: `${clase}-${siguienteId}`,
          tipo: cuerpo.tipo,
          seccion: cuerpo.seccion || "menu",
          titulo: cuerpo.titulo,
          detalle: cuerpo.detalle,
          categoria,
          orden: contenidoActual.filter((i) => i.seccion === (cuerpo.seccion || "menu")).length + 1,
          activo: true
        };

        contenidoActual.push(nuevo);

        return responder(201, { message: "Contenido agregado correctamente", data: nuevo });
      }

      if (metodo === "PUT" && url.includes("/contenido/orden")) {
        if (errorAlOrdenar) {
          return responder(400, { message: errorAlOrdenar });
        }

        cuerpo.ids.forEach((id, indice) => {
          const item = contenidoActual.find((i) => i.id === id);
          if (item) item.orden = indice + 1;
        });

        return responder(200, { message: "Orden actualizado correctamente" });
      }

      if (metodo === "PUT" && idEnLaUrl) {
        const item = contenidoActual.find((i) => i.id === idEnLaUrl);

        if (!item) return responder(404, { message: "El contenido no existe" });

        Object.assign(item, {
          titulo: cuerpo.titulo,
          detalle: cuerpo.detalle,
          seccion: cuerpo.seccion || item.seccion
        });

        return responder(200, { message: "Contenido actualizado correctamente", data: item });
      }

      // La misma regla que el servidor (contenido.service, RN del último
      // bloque activo). El simulador tiene que ser igual de estricto: si
      // dejara borrar lo que el servidor rechaza, la prueba pasaría aquí y
      // la pantalla fallaría de verdad.
      const dejariaElPerfilVacio = (item) =>
        !sinQr && item && item.activo &&
        contenidoActual.filter((i) => i.activo).length === 1;

      const ultimoBloque = {
        message:
          "Es el último bloque activo y el perfil ya tiene un código QR. " +
          "Agregue otro antes de quitarlo, o quien escanee el código no encontrará nada"
      };

      if (metodo === "PATCH" && idEnLaUrl) {
        const item = contenidoActual.find((i) => i.id === idEnLaUrl);

        if (!item) return responder(404, { message: "El contenido no existe" });

        if (cuerpo.activo === false && dejariaElPerfilVacio(item)) {
          return responder(409, ultimoBloque);
        }

        item.activo = cuerpo.activo;

        return responder(200, {
          message: item.activo ? "Contenido activado" : "Contenido desactivado",
          data: item
        });
      }

      if (metodo === "DELETE" && idEnLaUrl) {
        if (dejariaElPerfilVacio(contenidoActual.find((i) => i.id === idEnLaUrl))) {
          return responder(409, ultimoBloque);
        }

        contenidoActual = contenidoActual.filter((i) => i.id !== idEnLaUrl);

        return responder(200, { message: "Contenido eliminado correctamente" });
      }

      // GET: lista completa, plana y agrupada por sección
      const porSeccion = {};

      for (const item of contenidoActual) {
        if (!porSeccion[item.seccion]) porSeccion[item.seccion] = [];
        porSeccion[item.seccion].push(item);
      }

      for (const seccion of Object.keys(porSeccion)) {
        porSeccion[seccion].sort((a, b) => a.orden - b.orden);
      }

      return responder(200, { data: contenidoActual, porSeccion });
    }

    if (url.includes("/perfiles/me/tema")) {
      peticionesPerfil.push({ metodo, url: "/perfiles/me/tema" });

      const cuerpo = JSON.parse(route.request().postData() || "{}");
      perfilActual = { ...perfilActual, tema: cuerpo.tema };

      return responder(200, {
        message: "Tema actualizado correctamente",
        data: perfilActual
      });
    }

    if (url.includes("/perfiles/me")) {
      peticionesPerfil.push({ metodo, url: "/perfiles/me" });

      if (metodo === "PUT") {
        if (errorAlGuardarPerfil) {
          return responder(400, { message: errorAlGuardarPerfil });
        }

        // El servidor devuelve el perfil como queda guardado: el slug lo
        // decide él y no cambia aunque se edite el nombre
        const enviado = JSON.parse(route.request().postData() || "{}");

        perfilActual = {
          ...perfilActual,
          ...enviado,
          // El slug lo decide el servidor y no cambia al renombrar (RF-09)
          slug: PERFIL.slug,
          urlPublica: PERFIL.urlPublica
        };

        return responder(200, {
          message: "Perfil empresarial guardado correctamente",
          data: perfilActual
        });
      }

      if (sinPerfil) {
        return responder(404, { message: "Esta cuenta todavía no tiene un perfil empresarial" });
      }

      return responder(200, { data: perfilActual });
    }

    // --- Administracion (RF-13, RF-14 y RF-15) ---
    // Va antes que /usuarios porque "/admin/usuarios" tambien lo contiene

    if (url.includes("/admin/resumen")) {
      return responder(200, { data: resumenAdmin });
    }

    if (url.includes("/admin/reportes/usuarios")) {
      const lineas = ["id,nombre,correo,rol,estado"];

      for (const u of usuariosAdmin) {
        lineas.push([u.id, u.nombre, u.correo, u.rol, u.estado].map((v) => JSON.stringify(String(v))).join(","));
      }

      return route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="usuarios-2026-10-18.csv"',
          "Access-Control-Expose-Headers": "Content-Disposition"
        },
        body: "\uFEFF" + lineas.join("\r\n")
      });
    }

    // El detalle va antes que la lista: "/admin/usuarios/5" tambien
    // contiene "/admin/usuarios", y con el orden al reves nunca se llegaria
    if (/\/admin\/usuarios\/\d+$/.test(url)) {
      const id = Number(url.match(/\/admin\/usuarios\/(\d+)$/)[1]);
      const usuario = usuariosAdmin.find((u) => u.id === id);

      if (!usuario) return responder(404, { message: "El usuario no existe" });

      return responder(200, {
        data: { ...usuario, ultimosEventos: usuario.perfil ? EVENTOS_ADMIN : [] }
      });
    }

    if (url.includes("/admin/usuarios")) {
      const parametros = new URL(url).searchParams;

      let visibles = usuariosAdmin.filter((u) => !eliminadosAdmin.includes(u.id));

      const busqueda = (parametros.get("busqueda") || "").toLowerCase();

      if (busqueda) {
        visibles = visibles.filter((u) =>
          [u.nombre, u.correo, u.perfil ? u.perfil.nombreNegocio : ""]
            .join(" ").toLowerCase().includes(busqueda)
        );
      }

      const estado = parametros.get("estado");

      if (estado) visibles = visibles.filter((u) => u.estado === estado);

      if (parametros.get("orden") === "nombre") {
        visibles = [...visibles].sort((a, b) => a.nombre.localeCompare(b.nombre));
      }

      return responder(200, {
        data: visibles,
        paginacion: { pagina: 1, porPagina: 20, total: visibles.length, paginas: 1 }
      });
    }

    // RF-14 no tiene endpoints propios: usa los del modulo de usuarios
    if (/\/usuarios\/\d+\/estado$/.test(url) && metodo === "PATCH") {
      if (errorAlAdministrar) {
        return responder(errorAlAdministrar.status || 400, { message: errorAlAdministrar.message });
      }

      const id = Number(url.match(/\/usuarios\/(\d+)\/estado/)[1]);
      const cuerpo = JSON.parse(route.request().postData() || "{}");
      const usuario = usuariosAdmin.find((u) => u.id === id);

      if (!usuario) return responder(404, { message: "El usuario no existe" });

      usuario.estado = cuerpo.estado;
      resumenAdmin.activos = usuariosAdmin.filter((u) => u.estado === "activo").length;
      resumenAdmin.restringidos = usuariosAdmin.filter((u) => u.estado === "restringido").length;

      return responder(200, { message: "Estado del usuario actualizado correctamente", data: usuario });
    }

    if (/\/usuarios\/\d+$/.test(url) && metodo === "DELETE") {
      if (errorAlAdministrar) {
        return responder(errorAlAdministrar.status || 400, { message: errorAlAdministrar.message });
      }

      eliminadosAdmin.push(Number(url.match(/\/usuarios\/(\d+)$/)[1]));
      resumenAdmin.total -= 1;

      return responder(200, { message: "Usuario eliminado correctamente" });
    }

    if (url.includes("/usuarios/me") && metodo === "DELETE") {
      if (contrasenaIncorrectaAlBorrar) {
        return responder(401, { message: "La contraseña no es correcta" });
      }

      return responder(200, { message: "Cuenta eliminada correctamente" });
    }

    if (url.includes("/usuarios/me/preferencias")) {
      if (metodo === "PUT") {
        if (errorAlGuardarPreferencias) {
          return responder(400, { message: errorAlGuardarPreferencias });
        }

        const cuerpo = JSON.parse(route.request().postData() || "{}");
        preferenciasActuales = { ...cuerpo, guardadas: true };

        return responder(200, {
          message: "Preferencias guardadas correctamente",
          data: preferenciasActuales
        });
      }

      return responder(200, { data: preferenciasActuales });
    }

    if (url.includes("/usuarios/me/contrasena")) {
      if (contrasenaActualIncorrecta) {
        // Un 401 aquí no significa que la sesión venció, sino que la
        // contraseña actual está mal escrita
        return responder(401, { message: "La contraseña actual no es correcta" });
      }

      // El cambio cierra todas las sesiones y devuelve un token nuevo
      return responder(200, {
        message: "Contraseña actualizada correctamente. Se cerraron las demás sesiones",
        data: { token: TOKEN_NUEVO }
      });
    }

    if (url.includes("/usuarios/me") && metodo === "PUT") {
      if (errorAlGuardarDatos) {
        return responder(errorAlGuardarDatos.status || 400, {
          message: errorAlGuardarDatos.message || "No se pudo guardar"
        });
      }

      const cuerpo = JSON.parse(route.request().postData() || "{}");

      // El servidor exige la contraseña solo si el correo cambia
      if (cuerpo.correo !== cuentaActual.correo && !cuerpo.contrasena) {
        return responder(401, { message: "Confirme su contraseña para cambiar el correo" });
      }

      cuentaActual = { ...cuentaActual, nombre: cuerpo.nombre, correo: cuerpo.correo };

      return responder(200, {
        message: "Datos actualizados correctamente",
        data: cuentaActual
      });
    }

    if (url.includes("/usuarios/me")) {
      return responder(200, { data: cuentaActual });
    }

    return responder(404, { message: "Recurso no encontrado" });
  });
}

/**
 * Deja una sesión guardada antes de que corra cualquier script de la página.
 * Hace falta en las pantallas privadas: sin token, la guardia redirige al
 * login antes de que haya algo que comprobar.
 */
async function sembrarSesion(page, usuario = USUARIO) {
  await page.addInitScript((datos) => {
    // addInitScript corre en cada navegación, no solo en la primera. Sin esta
    // marca, una prueba que cierre sesión se encontraría con la sesión puesta
    // otra vez al llegar al login, y no podría comprobar que se borró.
    if (window.sessionStorage.getItem(datos.marca)) return;

    window.sessionStorage.setItem(datos.marca, "1");
    window.localStorage.setItem(datos.clave, datos.valor);
  }, {
    clave: "qr.sesion",
    marca: "qr.sesion.sembrada",
    valor: JSON.stringify({ token: TOKEN, usuario })
  });
}

/**
 * Como prepararSesion, pero con una cuenta de administrador.
 *
 * La pantalla de administracion se mira a si misma antes de dibujar nada: si
 * la sesion no es de administrador, redirige al dashboard (RN-22). Sin esto,
 * una prueba de esa pantalla no llegaria a ver la tabla.
 */
async function prepararSesionAdmin(page, opciones = {}) {
  await simularApi(page, { ...opciones, comoAdministrador: true });
  await sembrarSesion(page, ADMINISTRADOR);
}

/**
 * Responde las imágenes externas con un SVG mínimo.
 *
 * Hace falta para probar el logo del negocio: la dirección del perfil tiene
 * que ser absoluta y con https para pasar la validación del RF-10, así que no
 * puede apuntar a un archivo del proyecto. Y si el navegador no la carga, el
 * código la retira a propósito —para no dejar una imagen rota—, de modo que
 * sin esto no habría nada que comprobar.
 */
async function simularImagenes(page) {
  await page.route("https://ejemplo.co/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>'
    })
  );
}

/** Lo habitual en una pantalla privada: sesión guardada y API simulada. */
async function prepararSesion(page) {
  await simularApi(page);
  await sembrarSesion(page);
}

module.exports = {
  USUARIO, ADMINISTRADOR, TOKEN, TOKEN_NUEVO, PERFIL, CATEGORIAS, QR,
  ESTADISTICAS, USUARIOS_ADMIN, RESUMEN_ADMIN, EVENTOS_ADMIN,
  simularApi, sembrarSesion, prepararSesion, prepararSesionAdmin, simularImagenes
};
