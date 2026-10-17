// ============================================
// CONTENIDO.JS — pestañas, activar/desactivar, editar y agregar (RF-05, RF-06)
//
// Los bloques viven en el servidor: esta pantalla consume /api/contenido. Lo
// que antes se guardaba en localStorage ahora se pide al cargar y cada cambio
// viaja en su propia petición.
//
// La API maneja tres tipos —enlace, texto y boton— y una categoría por bloque
// (WhatsApp, Instagram, Página Web... las ocho del RF-05). La pantalla usaba
// cuatro tipos, entre ellos "contacto", que aquí es un enlace con la
// categoría WhatsApp: el tipo dice qué es el bloque y la categoría, de qué.
// ============================================

// Colores por tipo de bloque
const TYPE_STYLES = {
  enlace: { color: "var(--color-primary)", bg: "var(--color-primary-light)" },
  boton: { color: "#7d52dd", bg: "rgba(139,92,246,.10)" },
  texto: { color: "var(--slate-700)", bg: "var(--slate-100)" },
  contacto: { color: "#047c57", bg: "#D1FAE5" }
};

const TYPE_ICONS = {
  enlace: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  boton: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2"/><path d="M12 19v2"/>',
  texto: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  contacto: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'
};

// Etiqueta visible de cada tipo
const TYPE_LABELS = { enlace: "enlace", boton: "botón", texto: "texto", contacto: "contacto" };

const TABS = [
  { id: "menu", label: "Menú Principal" },
  { id: "promos", label: "Promociones" },
  { id: "reservas", label: "Reservaciones" }
];

let itemsByTab = { menu: [], promos: [], reservas: [] };
let categorias = { enlaces: [], elementos: [] };
let currentTab = "menu";

/**
 * Cómo se pinta un bloque.
 *
 * El WhatsApp se muestra como "contacto" porque es lo que significa para
 * quien administra su negocio, aunque para la API sea un enlace más.
 */
function estiloDe(item) {
  if (item.tipo === "enlace" && item.categoria.nombre === "WhatsApp") return "contacto";

  return item.tipo;
}

/** Agrupa la respuesta de la API en las pestañas de la pantalla. */
function agruparPorPestana(porSeccion) {
  const agrupado = { menu: [], promos: [], reservas: [] };

  for (const tab of TABS) {
    agrupado[tab.id] = porSeccion[tab.id] || [];
  }

  return agrupado;
}

function iconSvg(name, size = 17, color = "currentColor") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TYPE_ICONS[name] || ""}</svg>`;
}

function renderTabs() {
  const wrap = document.getElementById("content-tabs");
  wrap.innerHTML = TABS.map(
    (tab) => `<button class="content-tab ${tab.id === currentTab ? "active" : ""}" data-tab="${tab.id}">${tab.label}</button>`
  ).join("");
  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;
      renderTabs();
      renderItems();
    });
  });
}

function renderItems() {
  const list = document.getElementById("item-list");
  const items = itemsByTab[currentTab];

  if (items.length === 0) {
    list.innerHTML = `<p style="color:var(--slate-400);font-size:12px;text-align:center;padding:20px;">Aún no hay elementos en esta sección.</p>`;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const clave = estiloDe(item);
      const style = TYPE_STYLES[clave];
      const label = escapeHtml(item.titulo);
      const sub = escapeHtml(item.detalle);
      // Cuando el elemento está inactivo, la "pill" usa un gris neutro
      // en vez del color de marca del tipo, para que el texto siga
      // siendo legible (en vez de solo bajar la opacidad).
      const pillColor = item.activo ? style.color : "var(--slate-500)";
      const pillBg = item.activo ? style.bg : "var(--slate-100)";
      return `
      <div class="item-card ${item.activo ? "" : "is-inactive"}" data-id="${item.id}">
        <span class="item-grip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
        </span>
        <div class="item-icon" style="background:${style.bg}">
          ${iconSvg(clave, 17, style.color)}
        </div>
        <div class="item-body">
          <div class="item-title-row">
            <span class="item-label">${label}</span>
            <span class="item-pill" style="color:${pillColor};background:${pillBg}">${TYPE_LABELS[clave]}</span>
          </div>
          <div class="item-sub">${sub}</div>
        </div>
        <div class="item-actions">
          <button class="item-toggle ${item.activo ? "on" : ""}" data-action="toggle" title="Activar/desactivar" aria-label="${item.activo ? "Desactivar" : "Activar"} ${label}" aria-pressed="${item.activo}">
            <span class="knob"></span>
          </button>
          <button class="icon-btn" data-action="edit" title="Editar" aria-label="Editar ${label}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="icon-btn danger" data-action="delete" title="Eliminar" aria-label="Eliminar ${label}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
    })
    .join("");
}

/** Aviso de error. La pantalla no tiene un sitio fijo, así que se usa la lista. */
function avisarError(mensaje) {
  const list = document.getElementById("item-list");

  const aviso = document.createElement("p");
  aviso.className = "form-alert form-alert--error";
  aviso.setAttribute("role", "alert");
  aviso.textContent = mensaje;

  list.prepend(aviso);

  setTimeout(() => aviso.remove(), 5000);
}

// --- Carga inicial ---

async function cargarContenido() {
  try {
    const respuesta = await Api.listarContenido();

    itemsByTab = agruparPorPestana(respuesta.porSeccion || {});
    renderItems();
  } catch (error) {
    // 404: la cuenta no tiene perfil todavía, así que no puede tener
    // contenido colgando de él
    if (error.status === 404) {
      avisarError("Complete primero el perfil del negocio en Configuración.");
      return;
    }

    avisarError(error.message);
  }
}

async function cargarCategorias() {
  try {
    const respuesta = await Api.listarCategoriasContenido();

    categorias = respuesta.data;
  } catch (error) {
    console.warn("No se pudieron traer las categorías:", error.message);
  }
}

// --- Delegación de eventos sobre la lista (toggle / editar / eliminar) ---
document.getElementById("item-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const card = btn.closest(".item-card");
  const id = card.dataset.id;
  const action = btn.dataset.action;
  const item = itemsByTab[currentTab].find((i) => i.id === id);

  if (!item) return;

  // Se bloquea el botón mientras se espera: dos clics seguidos mandarían
  // dos peticiones contradictorias
  btn.disabled = true;

  try {
    if (action === "toggle") {
      const actualizado = await Api.cambiarEstadoContenido(id, !item.activo);
      Object.assign(item, actualizado.data);
      renderItems();
    }

    if (action === "delete") {
      await Api.eliminarContenido(id);
      itemsByTab[currentTab] = itemsByTab[currentTab].filter((i) => i.id !== id);
      renderItems();
    }

    if (action === "edit") {
      openDialog(item);
    }
  } catch (error) {
    avisarError(error.message);
  } finally {
    btn.disabled = false;
  }
});

// --- Modal de agregar / editar elemento ---
const dialog = document.getElementById("add-item-dialog");
const dialogForm = document.getElementById("add-item-form");
const selectTipo = document.getElementById("tipo");
const selectCategoria = document.getElementById("categoria");
let editingId = null;

/**
 * Llena el desplegable de categorías según el tipo elegido.
 * Un enlace ofrece las ocho del RF-05; un texto o un botón, las de elemento.
 */
function renderCategorias(tipo, seleccionada = null) {
  const lista = tipo === "enlace" ? categorias.enlaces : categorias.elementos;

  selectCategoria.innerHTML = lista
    .map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`)
    .join("");

  if (seleccionada) selectCategoria.value = String(seleccionada);
}

selectTipo.addEventListener("change", () => renderCategorias(selectTipo.value));

function openDialog(existingItem = null) {
  editingId = existingItem ? existingItem.id : null;
  document.getElementById("dialog-title").textContent = existingItem ? "Editar elemento" : "Agregar elemento";

  const tipo = existingItem ? existingItem.tipo : "enlace";

  selectTipo.value = tipo;
  // El tipo no se puede cambiar al editar: cada tipo vive en una tabla
  // distinta, así que cambiarlo sería borrar el bloque y crear otro
  selectTipo.disabled = Boolean(existingItem);

  renderCategorias(tipo, existingItem ? existingItem.categoria.id : null);

  dialogForm.etiqueta.value = existingItem ? existingItem.titulo : "";
  dialogForm.subtitulo.value = existingItem ? existingItem.detalle : "";
  dialog.showModal();
}

document.getElementById("btn-open-add").addEventListener("click", () => openDialog());
document.getElementById("item-add-btn-bottom").addEventListener("click", () => openDialog());
document.getElementById("dialog-cancel").addEventListener("click", () => dialog.close());

dialogForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const etiqueta = dialogForm.etiqueta.value.trim();
  const subtitulo = dialogForm.subtitulo.value.trim();

  if (!etiqueta) return;

  const datos = {
    tipo: selectTipo.value,
    titulo: etiqueta,
    detalle: subtitulo,
    idCategoria: Number(selectCategoria.value),
    seccion: currentTab
  };

  const boton = dialogForm.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    if (editingId) {
      const respuesta = await Api.actualizarContenido(editingId, datos);
      const item = itemsByTab[currentTab].find((i) => i.id === editingId);
      Object.assign(item, respuesta.data);
    } else {
      const respuesta = await Api.crearContenido(datos);
      itemsByTab[currentTab].push(respuesta.data);
    }

    renderItems();
    dialog.close();
  } catch (error) {
    // El diálogo se queda abierto para corregir sin volver a escribirlo todo
    avisarError(error.message);
    dialog.close();
  } finally {
    boton.disabled = false;
  }
});

renderTabs();
renderItems();

// La guardia ya comprobó la sesión; aquí solo se piden los datos
cargarCategorias().then(cargarContenido);
