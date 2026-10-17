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

const TOKEN = "token-de-prueba-sin-valor-real";

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
    errorAlOrdenar = null
  } = opciones;

  // El simulador recuerda el perfil y el contenido, como haría el servidor:
  // si una prueba guarda y luego abre otra pantalla o recarga, debe
  // encontrar lo que guardó.
  let perfilActual = { ...PERFIL };
  let contenidoActual = contenidoInicial();
  let siguienteId = 100;

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

      if (metodo === "PATCH" && idEnLaUrl) {
        const item = contenidoActual.find((i) => i.id === idEnLaUrl);

        if (!item) return responder(404, { message: "El contenido no existe" });

        item.activo = cuerpo.activo;

        return responder(200, {
          message: item.activo ? "Contenido activado" : "Contenido desactivado",
          data: item
        });
      }

      if (metodo === "DELETE" && idEnLaUrl) {
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

    if (url.includes("/perfiles/me")) {
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

    if (url.includes("/usuarios/me") && metodo === "DELETE") {
      if (contrasenaIncorrectaAlBorrar) {
        return responder(401, { message: "La contraseña no es correcta" });
      }

      return responder(200, { message: "Cuenta eliminada correctamente" });
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

    if (url.includes("/usuarios/me")) {
      return responder(200, { data: USUARIO });
    }

    return responder(404, { message: "Recurso no encontrado" });
  });
}

/**
 * Deja una sesión guardada antes de que corra cualquier script de la página.
 * Hace falta en las pantallas privadas: sin token, la guardia redirige al
 * login antes de que haya algo que comprobar.
 */
async function sembrarSesion(page) {
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
    valor: JSON.stringify({ token: TOKEN, usuario: USUARIO })
  });
}

/** Lo habitual en una pantalla privada: sesión guardada y API simulada. */
async function prepararSesion(page) {
  await simularApi(page);
  await sembrarSesion(page);
}

module.exports = {
  USUARIO, TOKEN, TOKEN_NUEVO, PERFIL, CATEGORIAS,
  simularApi, sembrarSesion, prepararSesion
};
