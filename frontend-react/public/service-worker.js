// ============================================
// SERVICE-WORKER.JS
//
// Hace dos cosas: deja la aplicacion instalable como PWA y la deja abrir sin
// conexion, una vez visitada.
//
// Estrategia: red primero, cache de respaldo. Asi quien tiene internet ve
// siempre la version recien publicada, y la aplicacion sigue abriendo cuando
// se queda sin senal. Lo contrario -cache primero- es mas rapido y bastante
// peor: dejaria viendo una version vieja hasta que el service worker se
// actualizara, y en el panel de un negocio eso significa no ver el contenido
// que acaba de guardar.
//
// Lo registra src/main.jsx, y solo en el paquete compilado.
//
// A diferencia del frontend original, aqui no hay una lista de pantallas que
// precargar: con React hay un solo index.html y los demas archivos llevan un
// hash en el nombre que cambia en cada compilacion, asi que una lista
// escrita a mano quedaria desactualizada al siguiente build. Se precarga lo
// que no cambia de nombre y el resto entra en la cache al pedirlo.
// ============================================

const CACHE = "qr-empresarial-react-v1";

const MINIMO = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/assets/favicon-32.png",
  "/assets/apple-touch-icon.png",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(MINIMO)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;

  // Solo GET del propio origen. Lo demas -las tipografias de Google, un
  // POST- sigue su curso normal.
  if (peticion.method !== "GET" || !peticion.url.startsWith(self.location.origin)) {
    return;
  }

  // La API no se guarda nunca. Dos motivos:
  //
  //   - Son datos de una cuenta. En un equipo compartido y sin conexion, la
  //     cache devolveria lo de quien uso el navegador antes.
  //   - El cache.put de abajo se hace a mano y pasa por encima del
  //     Cache-Control que la propia API envia: la descarga del codigo QR
  //     viaja con "private, no-store" justamente para que no se guarde.
  //
  // Lo que si conviene guardar son las pantallas: con ellas la aplicacion
  // abre sin conexion y es la peticion de datos la que falla, que es un
  // estado que cada pantalla ya sabe explicar.
  if (new URL(peticion.url).pathname.startsWith("/api/")) return;

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        const copia = respuesta.clone();

        caches.open(CACHE).then((cache) => cache.put(peticion, copia));

        return respuesta;
      })
      .catch(async () => {
        const guardada = await caches.match(peticion);

        if (guardada) return guardada;

        // Una direccion del enrutador que no se habia visitado -/contenido,
        // /actividad- no esta en la cache con su nombre, porque el servidor
        // entrega el mismo index.html para todas. Sin esto, abrir la
        // aplicacion sin conexion por un enlace guardado daria un error de
        // red en lugar de la aplicacion.
        if (peticion.mode === "navigate") return caches.match("/");

        return Response.error();
      })
  );
});
