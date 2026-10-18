// ============================================
// PUBLIC.JS — vista pública del perfil (RF-09)
//
// Es la pantalla a la que lleva el código QR. No hay sesión: quien escanea no
// tiene cuenta, así que los datos vienen de /api/publico/:slug, el único
// endpoint abierto del proyecto.
//
// "Mostrar la información actualizada sin generar un nuevo código": el código
// siempre apunta aquí y lo que se pinta es el estado de ahora. Editar el
// perfil o el contenido se ve en el siguiente escaneo, con el mismo código.
// ============================================

const TITULOS_DE_SECCION = {
  menu: "Menú principal",
  promos: "Promociones",
  reservas: "Reservaciones"
};

/**
 * De dónde sale el slug, en orden de preferencia.
 *
 *   1. La ruta /p/panaderia-la-espiga, que es la que lleva el código QR.
 *   2. El parámetro ?slug=, para abrir el perfil de un negocio concreto sin
 *      pasar por esa ruta. Sirve para compartir una previsualización y para
 *      ver la pantalla cuando el frontend se sirve aparte, sin el backend
 *      que atiende /p/.
 *   3. El slug del perfil que hay en caché, que es el de quien tiene la
 *      sesión abierta: es el caso de abrir "Vista Pública" desde el panel.
 */
function slugDeLaDireccion() {
  const enLaRuta = window.location.pathname.match(/\/p\/([^/?#]+)/);

  if (enLaRuta) return decodeURIComponent(enLaRuta[1]);

  const enLaConsulta = new URLSearchParams(window.location.search).get("slug");

  if (enLaConsulta) return enLaConsulta;

  const enCache = getBusinessData().slug;

  return enCache || null;
}

function mostrarNoDisponible() {
  document.getElementById("public-card").hidden = true;
  document.getElementById("public-unavailable").hidden = false;
  document.title = "Perfil no disponible · QR Empresarial";
}

/** Pinta los datos del negocio en la cabecera de la tarjeta. */
function pintarPerfil(perfil) {
  const texto = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  document.title = `${perfil.nombreNegocio} · QR Empresarial`;

  texto("profile-name", perfil.nombreNegocio);
  texto("profile-description", perfil.descripcion || perfil.categoria || "");
  texto("profile-address", perfil.direccion || "");
  texto("profile-phone", perfil.telefono || "");

  // La calificación y las reseñas no están en la base: vendrían de reseñas
  // reales de clientes, que este proyecto no tiene. Se oculta la fila en
  // lugar de inventar un número.
  const fila = document.querySelector(".profile-rating");
  if (fila) fila.hidden = true;

  const horario = document.getElementById("profile-hours");
  if (horario) horario.textContent = perfil.horario || "";

  const avatar = document.querySelector(".profile-avatar-logo");
  if (avatar) avatar.setAttribute("aria-label", `Logo de ${perfil.nombreNegocio}`);

  pintarEnlacesDeContacto(perfil);
}

/**
 * Los enlaces fijos de contacto salen de los datos del perfil.
 *
 * Si un dato no está, se oculta su botón: un "mailto:" vacío o un WhatsApp
 * sin número solo sirven para que alguien los pulse y no pase nada.
 */
function pintarEnlacesDeContacto(perfil) {
  const ocultar = (id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  };

  const digitos = perfil.telefono ? phoneDigits(perfil.telefono).replace("+", "") : "";

  if (digitos) {
    document.getElementById("link-reserve").href = `tel:+${digitos}`;
    document.getElementById("link-whatsapp").href = `https://wa.me/${digitos}`;
    document.getElementById("link-whatsapp-text").textContent = `WhatsApp: ${perfil.telefono}`;
  } else {
    ocultar("link-reserve");
    ocultar("link-whatsapp");
  }

  if (perfil.direccion) {
    document.getElementById("link-maps").href =
      `https://maps.google.com/?q=${encodeURIComponent(perfil.direccion)}`;
  } else {
    ocultar("link-maps");
  }

  if (perfil.instagram) {
    const usuario = perfil.instagram.replace("@", "");
    document.getElementById("link-instagram").href = `https://instagram.com/${usuario}`;
    document.getElementById("link-instagram-text").textContent = perfil.instagram;
  } else {
    ocultar("link-instagram");
  }

  if (perfil.correoContacto) {
    document.getElementById("link-email").href = `mailto:${perfil.correoContacto}`;
    document.getElementById("link-email-text").textContent = perfil.correoContacto;
  } else {
    ocultar("link-email");
  }
}

/**
 * Pinta el contenido que armó la empresa, por secciones (RF-05).
 *
 * Los enlaces se pintan como <a> y los textos como <div>: un bloque de texto
 * no lleva a ninguna parte, así que no debe anunciarse como enlace ni recibir
 * el foco al tabular.
 */
function pintarContenido(porSeccion) {
  const contenedor = document.getElementById("public-content");

  const secciones = Object.keys(porSeccion);

  if (secciones.length === 0) {
    contenedor.innerHTML = "";
    return;
  }

  // Primero las secciones conocidas, en el orden de la pantalla del panel, y
  // después las que la empresa haya creado por su cuenta
  const orden = Object.keys(TITULOS_DE_SECCION);
  secciones.sort((a, b) => {
    const posA = orden.indexOf(a);
    const posB = orden.indexOf(b);

    return (posA === -1 ? 99 : posA) - (posB === -1 ? 99 : posB);
  });

  contenedor.innerHTML = secciones.map((seccion) => {
    const bloques = porSeccion[seccion].map((item) => {
      const titulo = escapeHtml(item.titulo);
      const detalle = escapeHtml(item.detalle);

      if (item.tipo === "enlace") {
        return `
          <a class="profile-block" href="${escapeHtml(item.detalle)}" target="_blank" rel="noopener noreferrer">
            <span class="profile-block-title">${titulo}</span>
            <span class="profile-block-detail">${escapeHtml(item.categoria)}</span>
          </a>`;
      }

      return `
        <div class="profile-block">
          <span class="profile-block-title">${titulo}</span>
          <span class="profile-block-detail">${detalle}</span>
        </div>`;
    }).join("");

    const titulo = escapeHtml(TITULOS_DE_SECCION[seccion] || seccion);

    return `
      <section>
        <h2 class="profile-section-title">${titulo}</h2>
        <div class="profile-links">${bloques}</div>
      </section>`;
  }).join("");
}

/**
 * Prepara el botón "Ver menú completo".
 *
 * Le pasa el slug, porque menu.html se sirve en la raíz y sin él no sabría
 * de qué negocio mostrar el menú. Y se oculta cuando la sección está vacía:
 * no tiene sentido ofrecer un botón que lleva a una pantalla sin nada.
 */
function prepararEnlaceDelMenu(slug, porSeccion) {
  const boton = document.getElementById("link-menu");

  if (!boton) return;

  const bloques = porSeccion.menu || [];

  if (bloques.length === 0) {
    boton.hidden = true;
    return;
  }

  boton.href = `/menu.html?slug=${encodeURIComponent(slug)}`;
}

async function cargarPerfilPublico() {
  const slug = slugDeLaDireccion();

  if (!slug) {
    mostrarNoDisponible();
    return;
  }

  try {
    const { data } = await Api.perfilPublico(slug);

    pintarPerfil(data.perfil);
    pintarContenido(data.porSeccion);
    prepararEnlaceDelMenu(slug, data.porSeccion);
  } catch (error) {
    // 404: no existe, la cuenta está restringida o el código fue desactivado.
    // El servidor responde lo mismo en los tres casos, a propósito.
    if (error.status === 404) {
      mostrarNoDisponible();
      return;
    }

    // Sin conexión no se vacía la pantalla: la caché del navegador puede
    // tener el perfil de una visita anterior, que es mejor que nada.
    console.warn("No se pudo cargar el perfil:", error.message);
  }
}

cargarPerfilPublico();
