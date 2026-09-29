// ============================================
// PUBLIC.JS — puebla la página pública con los
// datos reales del negocio (guardados en localStorage
// desde Configuración), en vez de texto fijo.
// ============================================

const biz = getBusinessData();

document.title = `${biz.name} · QR Empresarial`;
document.getElementById("profile-name").textContent = biz.name;
document.getElementById("profile-rating-text").textContent = `${biz.rating} · ${biz.reviews} reseñas`;
document.getElementById("profile-description").textContent = biz.description;
document.getElementById("profile-address").textContent = biz.address;
document.getElementById("profile-hours").textContent = `${biz.hours} · Abierto ahora`;
document.getElementById("profile-phone").textContent = biz.phone;

const digits = phoneDigits(biz.phone); // ej. "+573004567890"
const digitsNoPlus = digits.replace("+", "");

document.getElementById("link-reserve").href = `tel:${digits}`;
document.getElementById("link-maps").href = `https://maps.google.com/?q=${encodeURIComponent(biz.address)}`;
document.getElementById("link-whatsapp").href = `https://wa.me/${digitsNoPlus}`;
document.getElementById("link-whatsapp-text").textContent = `WhatsApp: ${biz.phone}`;
document.getElementById("link-instagram").href = `https://instagram.com/${biz.instagram.replace("@", "")}`;
document.getElementById("link-instagram-text").textContent = biz.instagram;
document.getElementById("link-email").href = `mailto:${biz.email}`;
document.getElementById("link-email-text").textContent = biz.email;

document.querySelector(".profile-avatar-logo").setAttribute("aria-label", `Logo de ${biz.name}`);
