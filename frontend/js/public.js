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

  // El color de marca del negocio (RF-12). Antes esta pantalla aplicaba el
  // tema guardado en el navegador del visitante, de modo que el color que
  // elegia el negocio no llegaba nunca a quien escaneaba el codigo.
  if (perfil.tema && perfil.tema !== "indigo") {
    document.documentElement.setAttribute("data-theme", perfil.tema);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  texto("profile-name", perfil.nombreNegocio);
  texto("profile-description", perfil.descripcion || perfil.categoria || "");
  texto("profile-address", perfil.direccion || "");
  texto("profile-phone", perfil.telefono || "");

  const horario = document.getElementById("profile-hours");
  if (horario) horario.textContent = perfil.horario || "";

  pintarLogo(perfil);

  pintarEnlacesDeContacto(perfil);
}

/**
 * El logo del negocio, si lo publicó (RF-04).
 *
 * Hasta ahora la imagen se pedía en Configuración, se validaba y se guardaba,
 * y no se mostraba en ninguna parte. Aquí es donde más falta hacía: es lo
 * primero que ve quien escanea el código.
 *
 * Si no hay logo, o si la dirección falla, se queda el dibujo genérico que
 * ya estaba en la pantalla.
 */
function pintarLogo(perfil) {
  const hueco = document.querySelector(".profile-avatar");
  const dibujo = document.querySelector(".profile-avatar-logo");

  if (!hueco) return;

  if (dibujo) {
    dibujo.setAttribute("aria-label", `Logo de ${perfil.nombreNegocio}`);
  }

  if (!perfil.imagen) return;

  const img = document.createElement("img");
  img.className = "profile-avatar-img";
  img.src = perfil.imagen;
  // El nombre del negocio ya está escrito al lado, así que repetirlo aquí
  // solo haría que un lector de pantalla lo dijera dos veces
  img.alt = "";

  // Si la dirección ya no sirve, se deja el dibujo en su lugar
  img.addEventListener("error", () => img.remove());
  img.addEventListener("load", () => {
    if (dibujo) dibujo.hidden = true;
  });

  hueco.appendChild(img);
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
        // El identificador va en el elemento para poder contar el clic
        // (RF-11). Es de la forma "enlace-12"; al servidor se le manda solo
        // el número.
        return `
          <a class="profile-block" href="${escapeHtml(item.detalle)}" target="_blank" rel="noopener noreferrer"
             data-id="${escapeHtml(item.id)}">
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

/**
 * Informa la visita, distinguiendo si llegó escaneando el código (RF-11).
 *
 * La imagen del QR lleva ?qr=1; el enlace que se comparte por WhatsApp o se
 * copia, no. Son las dos primeras medidas que pide el requisito: "escaneos
 * del QR" y "visitas al perfil".
 */
function informarVisita(slug) {
  const vinoDelCodigo = new URLSearchParams(window.location.search).get("qr") === "1";

  informarEvento(slug, { tipo: vinoDelCodigo ? "escaneo" : "visita" });
}

/**
 * Cuenta los clics en los enlaces (RF-11).
 *
 * Se usa delegación sobre el contenedor porque los bloques se dibujan después
 * de que llegue la respuesta. Y no se impide la navegación: el evento se
 * manda con sendBeacon, que el navegador entrega aunque la página se vaya.
 */
function prepararConteoDeClics(slug) {
  const contenedor = document.getElementById("public-content");

  if (!contenedor) return;

  contenedor.addEventListener("click", (e) => {
    const bloque = e.target.closest("a.profile-block[data-id]");

    if (!bloque) return;

    const idEnlace = Number(String(bloque.dataset.id).split("-")[1]);

    if (!Number.isInteger(idEnlace)) return;

    informarEvento(slug, { tipo: "clic", idEnlace });
  });
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

    // Se informa después de pintar: si el registro falla, la pantalla ya está
    // en su sitio. Lo que importa es que la persona vea el perfil.
    informarVisita(slug);
    prepararConteoDeClics(slug);
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
