// ============================================
// SERVICE-WORKER.JS
// Permite que la app cargue sin conexión (una vez visitada
// al menos una vez) y que sea instalable como PWA.
//
// Estrategia: "red primero, caché como respaldo" — así el
// usuario siempre ve la versión más reciente cuando hay
// internet, y la app sigue abriendo si se queda sin señal.
// ============================================

const CACHE_NAME = "qr-empresarial-v9";

// El "app shell": lo mínimo para que el sitio abra sin conexión.
const APP_SHELL = [
  "login.html",
  "register.html",
  "forgot-password.html",
  "restablecer.html",
  "dashboard.html",
  "contenido.html",
  "qr.html",
  "configuracion.html",
  "public.html",
  "menu.html",
  "404.html",
  "css/theme.css",
  "css/components.css",
  "css/layout.css",
  "css/polish.css",
  "css/auth.css",
  "css/public.css",
  "css/contenido.css",
  "css/qr.css",
  "css/dashboard.css",
  "css/configuracion.css",
  "css/menu.css",
  "css/404.css",
  "js/theme.js",
  "js/business-data.js",
  "js/api.js",
  "js/guardia.js",
  "js/layout.js",
  "js/auth.js",
  "js/register-steps.js",
  "js/forgot-password.js",
  "js/restablecer.js",
  "js/contenido.js",
  "js/qr.js",
  "js/dashboard.js",
  "js/configuracion.js",
  "js/public.js",
  "js/menu.js",
  "js/vendor/chart.umd.min.js",
  "js/vendor/qrcode.min.js",
  "assets/favicon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "manifest.json",
];

// --- Instalación: precargar el app shell ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// --- Activación: borrar cachés de versiones viejas ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// --- Peticiones: red primero, caché de respaldo si no hay conexión ---
self.addEventListener("fetch", (event) => {
  // Solo intervenir en peticiones GET del propio origen (no Google Fonts,
  // no otros dominios externos — esos siguen su comportamiento normal).
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // La API nunca se guarda. El backend sirve las pantallas y la API en el
  // mismo origen, así que sin esto entraban también /api/contenido,
  // /api/usuarios/me y la descarga del código QR. Dos motivos para no
  // hacerlo:
  //
  //   - Son datos de una cuenta concreta. En un equipo compartido, estando
  //     sin conexión, la caché devolvería lo de quien usó el navegador antes.
  //   - El cache.put de abajo se hace a mano, así que pasa por encima del
  //     Cache-Control que la propia API envía (la descarga del QR viaja con
  //     "private, no-store" justamente para que no se guarde).
  //
  // Lo que sí conviene guardar son las pantallas: con ellas, la aplicación
  // abre sin conexión y es la petición de datos la que falla, que es un
  // estado que cada pantalla ya sabe explicar.
  if (new URL(event.request.url).pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
