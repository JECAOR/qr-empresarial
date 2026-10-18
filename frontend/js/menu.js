// ============================================
// MENU.JS — vista detallada de la sección "menu" del perfil (RF-09)
//
// Es la pantalla a la que lleva el botón "Ver menú completo" de la vista
// pública. Antes mostraba un menú de restaurante escrito a mano —platos y
// precios de un negocio de ejemplo—, así que cualquiera que llegara
// escaneando un código veía la carta de otro.
//
// Ahora muestra los bloques que el negocio publicó en la sección "menu" de su
// panel, que es lo que devuelve GET /api/publico/:slug. No hay precios: el
// contenido del RF-05 son títulos y detalles, no artículos con tarifa.
// ============================================

const SECCION = "menu";

/**
 * El slug llega en la dirección: /menu.html?slug=panaderia-dona-luz.
 *
 * Lo pone la vista pública al armar el enlace. Si falta, se cae al perfil
 * que haya en caché, que es el caso de abrir la pantalla desde el panel.
 */
function slugDelMenu() {
  const enLaConsulta = new URLSearchParams(window.location.search).get("slug");

  if (enLaConsulta) return enLaConsulta;

  return getBusinessData().slug || null;
}

function mostrarVacio(mensaje) {
  const vacio = document.getElementById("menu-empty");

  if (mensaje) vacio.querySelector("p").textContent = mensaje;

  vacio.hidden = false;
  document.getElementById("menu-items").innerHTML = "";
}

/**
 * Pinta los bloques.
 *
 * Los enlaces se pintan como <a> y los textos como <div>, igual que en la
 * vista pública: un bloque de texto no lleva a ninguna parte y no debe
 * anunciarse como enlace.
 */
function pintarBloques(bloques) {
  const contenedor = document.getElementById("menu-items");

  contenedor.innerHTML = bloques.map((item) => {
    const titulo = escapeHtml(item.titulo);
    const detalle = escapeHtml(item.detalle);
    const categoria = escapeHtml(item.categoria);

    if (item.tipo === "enlace") {
      return `
        <a class="menu-item" href="${escapeHtml(item.detalle)}" target="_blank" rel="noopener noreferrer">
          <div class="menu-item-info">
            <h3>${titulo}</h3>
            <p>${categoria}</p>
          </div>
          <span class="menu-item-arrow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>`;
    }

    return `
      <div class="menu-item">
        <div class="menu-item-info">
          <h3>${titulo}</h3>
          <p>${detalle}</p>
        </div>
      </div>`;
  }).join("");
}

async function cargarMenu() {
  const slug = slugDelMenu();

  if (!slug) {
    document.getElementById("menu-subtitle").textContent = "";
    mostrarVacio("No se indicó de qué negocio mostrar el menú.");
    return;
  }

  // Volver debe llevar al perfil de este negocio, no a una dirección sin
  // slug: desde un teléfono sin nada en caché, eso mostraría "no disponible"
  document.getElementById("menu-back").href = `/p/${encodeURIComponent(slug)}`;

  try {
    const { data } = await Api.perfilPublico(slug);

    document.title = `Menú · ${data.perfil.nombreNegocio}`;
    document.getElementById("menu-biz-name").textContent = data.perfil.nombreNegocio;

    const bloques = data.porSeccion[SECCION] || [];

    if (bloques.length === 0) {
      document.getElementById("menu-subtitle").textContent = "";
      mostrarVacio();
      return;
    }

    document.getElementById("menu-subtitle").textContent =
      data.perfil.horario || "Información publicada por el negocio";

    pintarBloques(bloques);
  } catch (error) {
    document.getElementById("menu-biz-name").textContent = "Menú no disponible";
    document.getElementById("menu-subtitle").textContent = "";

    if (error.status === 404) {
      mostrarVacio("Este perfil no está disponible.");
      return;
    }

    mostrarVacio("No se pudo cargar el menú. Inténtelo de nuevo en un momento.");
  }
}

cargarMenu();
