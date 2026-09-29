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
  rating: "4.6",
  reviews: "215",
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

function getQrUrl(biz) {
  return `https://qr.${slugify(biz.name)}.co/menu`;
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
