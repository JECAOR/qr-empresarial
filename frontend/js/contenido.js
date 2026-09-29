// ============================================
// CONTENIDO.JS — pestañas con filtrado real, toggle,
// eliminar y agregar elementos
// ============================================

// Colores por tipo de elemento
const TYPE_STYLES = {
  enlace: { color: "var(--color-primary)", bg: "var(--color-primary-light)" },
  botón: { color: "#7d52dd", bg: "rgba(139,92,246,.10)" },
  texto: { color: "var(--slate-700)", bg: "var(--slate-100)" },
  contacto: { color: "#047c57", bg: "#D1FAE5" },
};

const TYPE_ICONS = {
  enlace: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  botón: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2"/><path d="M12 19v2"/>',
  texto: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  contacto: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
};

// --- Datos por defecto (solo se usan la primera vez, o si el usuario
// nunca ha guardado nada en localStorage todavía) ---
const TABS = [
  { id: "menu", label: "Menú Principal" },
  { id: "promos", label: "Promociones" },
  { id: "reservas", label: "Reservaciones" },
];

const DEFAULT_ITEMS = {
  menu: [
    { id: 1, type: "enlace", label: "Ver menú completo", sub: "fondalacosecha.co/menu", active: true },
    { id: 2, type: "botón", label: "Reservar mesa", sub: "/reservar", active: true },
    { id: 3, type: "texto", label: "Descripción del negocio", sub: "Sabor casero de Antioquia desde 2015", active: true },
    { id: 4, type: "enlace", label: "Instagram", sub: "@fondalacosecha", active: false },
    { id: 5, type: "contacto", label: "WhatsApp directo", sub: "+57 300 456 7890", active: true },
  ],
  promos: [
    { id: 6, type: "enlace", label: "Menú del día", sub: "Almuerzo ejecutivo $18.000", active: true },
    { id: 7, type: "botón", label: "2x1 en jugos naturales", sub: "Martes y jueves", active: true },
    { id: 8, type: "texto", label: "Promo especial", sub: "Bandeja paisa + bebida $28.000", active: true },
    { id: 9, type: "contacto", label: "Pregunta por el combo familiar", sub: "+57 300 456 7890", active: false },
  ],
  reservas: [
    { id: 10, type: "botón", label: "Reservar mesa hoy", sub: "/reservar", active: true },
    { id: 11, type: "botón", label: "Reservas grupos grandes (+10 personas)", sub: "/reservas-grupos", active: true },
    { id: 12, type: "texto", label: "Política de cancelación", sub: "Cancela hasta 2 horas antes sin costo", active: true },
    { id: 13, type: "contacto", label: "Confirmar por WhatsApp", sub: "+57 300 456 7890", active: true },
  ],
};

// --- Persistencia real en localStorage ---
const CONTENT_KEY = "qre-content-items";

function loadItems() {
  try {
    const stored = localStorage.getItem(CONTENT_KEY);
    return stored ? JSON.parse(stored) : structuredClone(DEFAULT_ITEMS);
  } catch {
    return structuredClone(DEFAULT_ITEMS);
  }
}

function saveItems() {
  localStorage.setItem(CONTENT_KEY, JSON.stringify(itemsByTab));
}

// El próximo id disponible se calcula a partir de lo que ya existe
// (evita tener que guardar un contador aparte en localStorage).
function getNextId() {
  const todos = [...itemsByTab.menu, ...itemsByTab.promos, ...itemsByTab.reservas];
  return todos.length ? Math.max(...todos.map((i) => i.id)) + 1 : 1;
}

let itemsByTab = loadItems();
let currentTab = "menu";

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
      const style = TYPE_STYLES[item.type];
      const label = escapeHtml(item.label);
      const sub = escapeHtml(item.sub);
      // Cuando el elemento está inactivo, la "pill" usa un gris neutro
      // en vez del color de marca del tipo, para que el texto siga
      // siendo legible (en vez de solo bajar la opacidad).
      const pillColor = item.active ? style.color : "var(--slate-500)";
      const pillBg = item.active ? style.bg : "var(--slate-100)";
      return `
      <div class="item-card ${item.active ? "" : "is-inactive"}" data-id="${item.id}">
        <span class="item-grip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
        </span>
        <div class="item-icon" style="background:${style.bg}">
          ${iconSvg(item.type, 17, style.color)}
        </div>
        <div class="item-body">
          <div class="item-title-row">
            <span class="item-label">${label}</span>
            <span class="item-pill" style="color:${pillColor};background:${pillBg}">${item.type}</span>
          </div>
          <div class="item-sub">${sub}</div>
        </div>
        <div class="item-actions">
          <button class="item-toggle ${item.active ? "on" : ""}" data-action="toggle" title="Activar/desactivar" aria-label="${item.active ? "Desactivar" : "Activar"} ${label}" aria-pressed="${item.active}">
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

// --- Delegación de eventos sobre la lista (toggle / editar / eliminar) ---
document.getElementById("item-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = btn.closest(".item-card");
  const id = Number(card.dataset.id);
  const action = btn.dataset.action;
  const items = itemsByTab[currentTab];

  if (action === "toggle") {
    const item = items.find((i) => i.id === id);
    item.active = !item.active;
    saveItems();
    renderItems();
  }

  if (action === "delete") {
    itemsByTab[currentTab] = items.filter((i) => i.id !== id);
    saveItems();
    renderItems();
  }

  if (action === "edit") {
    openDialog(items.find((i) => i.id === id));
  }
});

// --- Modal de agregar / editar elemento ---
const dialog = document.getElementById("add-item-dialog");
const dialogForm = document.getElementById("add-item-form");
let editingId = null;

function openDialog(existingItem = null) {
  editingId = existingItem ? existingItem.id : null;
  document.getElementById("dialog-title").textContent = existingItem ? "Editar elemento" : "Agregar elemento";
  dialogForm.tipo.value = existingItem ? existingItem.type : "enlace";
  dialogForm.etiqueta.value = existingItem ? existingItem.label : "";
  dialogForm.subtitulo.value = existingItem ? existingItem.sub : "";
  dialog.showModal();
}

document.getElementById("btn-open-add").addEventListener("click", () => openDialog());
document.getElementById("item-add-btn-bottom").addEventListener("click", () => openDialog());
document.getElementById("dialog-cancel").addEventListener("click", () => dialog.close());

dialogForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const tipo = dialogForm.tipo.value;
  const etiqueta = dialogForm.etiqueta.value.trim();
  const subtitulo = dialogForm.subtitulo.value.trim();
  if (!etiqueta) return;

  if (editingId) {
    const item = itemsByTab[currentTab].find((i) => i.id === editingId);
    item.type = tipo;
    item.label = etiqueta;
    item.sub = subtitulo;
  } else {
    itemsByTab[currentTab].push({ id: getNextId(), type: tipo, label: etiqueta, sub: subtitulo, active: true });
  }

  saveItems();
  renderItems();
  dialog.close();
});

renderTabs();
renderItems();
