// ============================================
// BUSINESS-DATA.JS — datos del negocio compartidos
// entre todas las pantallas, persistidos en localStorage.
// Esto simula lo que en producción vendría de una base
// de datos: un solo lugar de verdad que todas las
// pantallas leen, sin necesitar backend todavía.
// ============================================

const BUSINESS_KEY = "qre-business";

const DEFAULT_BUSINESS = {
  name: "Fonda La Cosecha",
  category: "Restaurante colombiano",
  description: "Sabores tradicionales de Antioquia en un ambiente cálido y familiar. Bandeja paisa, sancocho y mucho más, desde 2015.",
  address: "Cra. 35 #8A-45, El Poblado, Medellín",
  phone: "+57 300 456 7890",
  email: "contacto@fondalacosecha.co",
  instagram: "@fondalacosecha",
  hours: "Mar-Dom 11:00–21:00",
};

function getBusinessData() {
  try {
    const stored = localStorage.getItem(BUSINESS_KEY);
    return stored ? { ...DEFAULT_BUSINESS, ...JSON.parse(stored) } : { ...DEFAULT_BUSINESS };
  } catch {
    return { ...DEFAULT_BUSINESS };
  }
}

function saveBusinessData(data) {
  localStorage.setItem(BUSINESS_KEY, JSON.stringify(data));
}

// Iniciales para los avatares (ej. "Fonda La Cosecha" -> "FL")
function getBusinessInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "??";
}

// Convierte el nombre del negocio en un "dominio" simulado
// (ej. "Fonda La Cosecha" -> "fondalacosecha")
function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Dirección pública del perfil, la que codifica el QR.
 *
 * Se usa el slug que asignó el servidor, no uno derivado del nombre: el slug
 * no cambia aunque el negocio se renombre, y de eso depende el RF-09 —un QR
 * ya impreso tiene que seguir llevando al mismo perfil—. Solo se recurre al
 * nombre mientras no haya slug, como en la vista pública de demostración.
 *
 * Antes se devolvía `https://qr.<slug>.co/menu`, un dominio que no existe.
 * Ahora apunta a donde está publicada la aplicación de verdad, que es lo que
 * responderá la vista pública del módulo 5.
 */
function getQrUrl(biz) {
  const identificador = biz.slug || slugify(biz.name);

  // origenDelBackend lo define api.js, que no está cargado en las pantallas
  // públicas (la vista pública y el menú): ahí se cae al origen de la página.
  const origen = typeof origenDelBackend === "function"
    ? origenDelBackend()
    : window.location.origin;

  return `${origen}/p/${identificador}`;
}

// Deja solo dígitos y el "+" inicial, para enlaces tel:/wa.me
function phoneDigits(phone) {
  return phone.replace(/[^\d+]/g, "");
}

// Convierte texto a HTML seguro para insertar con innerHTML,
// incluso dentro de atributos como aria-label="...". Sin esto,
// un nombre como <img src=x onerror=...> o unas comillas sueltas
// (" onmouseover="...) se ejecutarían como código en vez de
// mostrarse como texto.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Puente con la API (RF-04) ---
//
// Las pantallas siguen leyendo getBusinessData(), que ahora funciona como
// caché de lo que hay en el servidor: la guardia lo sincroniza al cargar
// cualquier pantalla privada. Así el dashboard, el código QR y la barra
// lateral no tuvieron que cambiar.
//
// Las claves del negocio en el navegador y en la API no se llaman igual: el
// frontend ya existía con nombres en inglés y la API sigue el español del
// esquema. Estas dos funciones son el único punto donde se traducen.

function perfilApiADatosLocales(perfil) {
  return {
    name: perfil.nombreNegocio || "",
    category: perfil.categoria || "",
    description: perfil.descripcion || "",
    address: perfil.direccion || "",
    phone: perfil.telefono || "",
    email: perfil.correoContacto || "",
    instagram: perfil.instagram || "",
    hours: perfil.horario || "",
    image: perfil.imagen || "",
    // El tema es el color de marca del negocio (RF-12)
    tema: perfil.tema || "indigo",
    // El slug lo decide el servidor y no cambia aunque se edite el nombre:
    // los códigos QR ya impresos deben seguir funcionando (RF-09).
    slug: perfil.slug || ""
  };
}

function datosLocalesAPerfilApi(datos) {
  return {
    nombreNegocio: datos.name || "",
    categoria: datos.category || "",
    descripcion: datos.description || "",
    direccion: datos.address || "",
    telefono: datos.phone || "",
    correoContacto: datos.email || "",
    instagram: datos.instagram || "",
    horario: datos.hours || "",
    imagen: datos.image || "",
    tema: datos.tema || "indigo"
  };
}
