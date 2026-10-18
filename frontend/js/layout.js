// ============================================
// LAYOUT.JS — sidebar, topbar y nav móvil compartidos
// Se genera con JS (sin fetch) para que las páginas
// funcionen abriéndolas directamente con file://
// ============================================

const NAV_ITEMS = [
  { page: "dashboard.html", icon: "layout-dashboard", label: "Dashboard" },
  { page: "contenido.html", icon: "file-text", label: "Contenido" },
  { page: "qr.html", icon: "qr-code", label: "Código QR" },
  { page: "public.html", icon: "globe", label: "Vista Pública" },
  { page: "configuracion.html", icon: "settings", label: "Configuración" },
];

const MOBILE_NAV_ITEMS = [
  { page: "dashboard.html", icon: "layout-dashboard", label: "Inicio" },
  { page: "contenido.html", icon: "file-text", label: "Contenido" },
  { page: "qr.html", icon: "qr-code", label: "QR" },
  { page: "public.html", icon: "globe", label: "Perfil" },
  { page: "configuracion.html", icon: "settings", label: "Ajustes" },
];

// Set mínimo de íconos (estilo lucide) usados en el layout.
const ICONS = {
  "layout-dashboard": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  "file-text": '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
  "qr-code": '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
};

function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

function currentPage() {
  const path = window.location.pathname.split("/").pop();
  return path === "" ? "dashboard.html" : path;
}

function renderSidebar() {
  const el = document.getElementById("sidebar");
  if (!el) return;
  const active = currentPage();

  el.className = "sidebar";
  el.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">${icon("qr-code", 16)}</div>
      <div>
        <div class="brand-name">QR Empresarial</div>
        <div class="brand-sub">Panel de gestión</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      ${NAV_ITEMS.map(
        (item) => `
        <a href="${item.page}" class="sidebar-item ${item.page === active ? "active" : ""}">
          ${icon(item.icon)}
          <span>${item.label}</span>
        </a>`
      ).join("")}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-theme-row" title="Cambiar tema de color">
        ${THEMES_LIST.map(
          (t) => `<button class="sidebar-theme-dot ${getStoredTheme() === t.id ? "active" : ""}" style="background:${t.color}" data-theme-id="${t.id}" title="${t.label}" aria-label="Cambiar a tema ${t.label}" aria-pressed="${getStoredTheme() === t.id}"></button>`
        ).join("")}
        <span class="sidebar-theme-label">${THEMES_LIST.find((t) => t.id === getStoredTheme()).label}</span>
      </div>
      <div class="sidebar-user" title="${escapeHtml(correoDeLaCuenta())}">
        <div class="sidebar-avatar">${avatarDelNegocio()}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${escapeHtml(getBusinessData().name)}</div>
          <div class="sidebar-user-plan">${escapeHtml(rolDeLaCuenta())}</div>
        </div>
        <button type="button" id="sidebar-logout" class="sidebar-logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon("log-out", 13)}</button>
      </div>
    </div>
  `;

  el.querySelectorAll(".sidebar-theme-dot").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeId));
  });

  // Cierre de sesión real (RF-02): avisa al servidor y borra el token.
  // Antes era un enlace a login.html, que no cerraba nada.
  const botonSalir = el.querySelector("#sidebar-logout");

  if (botonSalir) {
    botonSalir.addEventListener("click", () => {
      if (typeof cerrarSesionYSalir === "function") {
        cerrarSesionYSalir();
      } else {
        window.location.href = "login.html";
      }
    });
  }
}

/**
 * Avatar del negocio: su logo si lo tiene, o sus iniciales (RF-04).
 *
 * El logo es una dirección que escribió la persona, así que puede estar mal
 * o haber dejado de existir. Con onerror se vuelve a las iniciales en lugar
 * de dejar el icono de imagen rota: el avatar es decoración, y una decoración
 * no debería verse estropeada por una URL que caducó.
 */
function avatarDelNegocio() {
  const negocio = getBusinessData();
  const iniciales = escapeHtml(getBusinessInitials(negocio.name));

  if (!negocio.image) return iniciales;

  return `<img class="sidebar-avatar-img" src="${escapeHtml(negocio.image)}"
               alt="" onerror="this.closest('.sidebar-avatar').textContent = '${iniciales}'">`;
}

/**
 * Datos de la cuenta con la que se inició sesión.
 *
 * El nombre grande de la barra es el del negocio, que se edita en
 * Configuración y se comparte con el resto de las pantallas. Lo que aporta la
 * sesión es con qué cuenta se entró: el rol debajo y el correo en el tooltip.
 *
 * Puede no haber sesión —al abrir la pantalla con file://, por ejemplo—, y
 * entonces se deja un texto neutro en lugar de nada.
 */
function cuentaActual() {
  return typeof Sesion !== "undefined" ? Sesion.usuario() : null;
}

function correoDeLaCuenta() {
  const cuenta = cuentaActual();

  return cuenta && cuenta.correo ? cuenta.correo : "Sin sesión activa";
}

function rolDeLaCuenta() {
  const cuenta = cuentaActual();

  if (!cuenta || !cuenta.rol) return "Cuenta";

  return cuenta.rol.charAt(0).toUpperCase() + cuenta.rol.slice(1);
}

function renderTopBar(title, subtitle, actionHtml = "") {
  const el = document.getElementById("topbar");
  if (!el) return;

  el.className = "topbar";
  el.innerHTML = `
    <div class="topbar-info">
      <h1 class="topbar-title">${escapeHtml(title)}</h1>
      <div class="topbar-subtitle">${escapeHtml(subtitle)}</div>
    </div>
    <div class="topbar-actions">
      ${actionHtml}
      <div class="notif-wrap" id="notif-wrap">
        <button class="topbar-bell" id="notif-bell" title="Notificaciones" aria-label="Ver notificaciones" aria-haspopup="true">
          ${icon("bell", 17)}<div class="topbar-bell-dot" id="notif-dot"></div>
        </button>
        <div class="notif-panel" id="notif-panel" hidden>
          <div class="notif-panel-header">
            <span>Notificaciones</span>
            <button id="notif-mark-read" class="notif-mark-read">Marcar todas como leídas</button>
          </div>
          <div class="notif-item">
            <div class="notif-item-icon" style="background:#D1FAE5;color:#059669;">${icon("qr-code", 14)}</div>
            <div>
              <div class="notif-item-title">¡Alcanzaste 500 escaneos este mes!</div>
              <div class="notif-item-time">Hace 2 horas</div>
            </div>
          </div>
          <div class="notif-item">
            <div class="notif-item-icon" style="background:var(--color-primary-light);color:var(--color-primary);">★</div>
            <div>
              <div class="notif-item-title">Nueva reseña de 5 estrellas</div>
              <div class="notif-item-time">Ayer</div>
            </div>
          </div>
          <div class="notif-item">
            <div class="notif-item-icon" style="background:#FEF3C7;color:#D97706;">${icon("layout-dashboard", 14)}</div>
            <div>
              <div class="notif-item-title">Tu resumen semanal ya está listo</div>
              <div class="notif-item-time">Hace 3 días</div>
            </div>
          </div>
        </div>
      </div>
      <div class="topbar-avatar">${escapeHtml(getBusinessInitials(getBusinessData().name))}</div>
    </div>
  `;

  const notifWrap = document.getElementById("notif-wrap");
  const notifPanel = document.getElementById("notif-panel");
  const notifDot = document.getElementById("notif-dot");

  document.getElementById("notif-bell").addEventListener("click", (e) => {
    e.stopPropagation();
    notifPanel.hidden = !notifPanel.hidden;
  });

  document.getElementById("notif-mark-read").addEventListener("click", () => {
    notifDot.style.display = "none";
    notifWrap.querySelectorAll(".notif-item").forEach((item) => item.classList.add("is-read"));
  });

  // Cerrar el panel al hacer clic fuera de él
  document.addEventListener("click", (e) => {
    if (!notifWrap.contains(e.target)) notifPanel.hidden = true;
  });
}

function renderMobileNav() {
  const el = document.getElementById("mobile-nav");
  if (!el) return;
  const active = currentPage();

  el.className = "mobile-nav";
  el.innerHTML = MOBILE_NAV_ITEMS.map(
    (item) => `
      <a href="${item.page}" class="mobile-nav-item ${item.page === active ? "active" : ""}">
        ${icon(item.icon, 18)}
        <span>${item.label}</span>
      </a>`
  ).join("");
}

/**
 * Inicializa el layout compartido de las pantallas internas.
 * Uso en cada página: initLayout({ title: "Dashboard", subtitle: "..." });
 */
function initLayout({ title, subtitle, actionHtml }) {
  renderSidebar();
  renderTopBar(title, subtitle, actionHtml);
  renderMobileNav();
}

// La guardia trae el perfil del servidor después de que la página ya se dibujó
// con lo que había en caché (RF-04), así que el nombre del negocio puede haber
// cambiado y hay que repintarlo.
//
// Solo se repinta la barra lateral. La superior no se toca a propósito: su
// `actionHtml` lo define cada pantalla y es donde cuelgan botones con sus
// propios listeners —el de agregar contenido, por ejemplo—. Reconstruirla
// borraría esos listeners y dejaría botones que no responden.
window.addEventListener("perfil:sincronizado", () => {
  renderSidebar();
});
