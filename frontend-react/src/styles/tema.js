// ============================================
// TEMA.JS — el color de marca del negocio (RF-12)
//
// Es del negocio, no de quien mira: se guarda en el perfil empresarial y la
// pagina publica lo aplica, de modo que quien escanea el codigo ve los
// colores que eligio el negocio.
//
// Lo unico que hace es poner data-theme en <html>. Los colores viven en
// global.css, en bloques html[data-theme="..."], asi que cambiar el atributo
// repinta la aplicacion entera sin volver a dibujar nada: la barra, los
// botones y la grafica de actividad -que pinta sus barras con
// var(--color-primary)- cambian de color solos.
//
// El frontend original recargaba la pagina al cambiar de color, porque
// generaba el QR y las graficas en un <canvas> y habia que volver a
// pintarlos. Aqui no hace falta: la grafica es SVG con variables CSS, y el
// QR es una imagen que genera el servidor con el color que se elige en su
// propia pantalla, que no es el de marca.
// ============================================

// Los tres que acepta el validador del backend. Cualquier otro da 400.
//
// El color es el de la muestra del selector, y coincide a proposito con el
// --color-primary del bloque correspondiente de global.css: la muestra tiene
// que ensenar el color que se va a aplicar.
export const TEMAS = [
  { valor: "indigo", nombre: "Índigo", color: "#4F46E5" },
  { valor: "teal", nombre: "Esmeralda", color: "#0B7D73" },
  { valor: "terracota", nombre: "Terracota", color: "#C2410C" }
];

export const TEMA_POR_DEFECTO = "indigo";

const CLAVE_TEMA = "qre_tema";

const ES_CONOCIDO = (tema) => TEMAS.some((t) => t.valor === tema);

/**
 * El tema que quedo guardado de la ultima sesion en este navegador.
 *
 * Es una cache, no la verdad: la verdad esta en el perfil y la trae
 * useTemaPropio(). Sirve para aplicar el color antes de que llegue esa
 * respuesta, que es lo que evita ver un parpadeo de colores al recargar.
 *
 * El acceso va protegido aunque el resto del proyecto lea sessionStorage a
 * pelo: esto se ejecuta antes de pintar nada, y en un navegador que no deje
 * guardar -modo privado con el almacenamiento bloqueado- una excepcion aqui
 * dejaria la pantalla en blanco. Quedarse con el color por defecto es mejor.
 */
export function temaGuardado() {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);

    return ES_CONOCIDO(guardado) ? guardado : TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

/**
 * Aplica un tema.
 *
 * @param {string} tema - indigo, teal o terracota. Otra cosa deja el de
 *   defecto: el tema llega de la API, y un valor raro no deberia poder
 *   escribir un atributo cualquiera en el <html>.
 * @param {{recordar?: boolean}} opciones - recordar guarda el tema como
 *   cache para el proximo arranque. Es false al mirar el perfil publico de
 *   OTRO negocio: sus colores son suyos, y guardarlos pintaria el panel
 *   propio con ellos la siguiente vez.
 */
export function aplicarTema(tema, { recordar = true } = {}) {
  const elegido = ES_CONOCIDO(tema) ? tema : TEMA_POR_DEFECTO;

  // El de defecto no pone atributo: asi el :root de global.css es el indigo
  // y no hay que repetir sus valores en un bloque aparte.
  if (elegido === TEMA_POR_DEFECTO) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", elegido);
  }

  if (recordar) {
    try {
      localStorage.setItem(CLAVE_TEMA, elegido);
    } catch {
      // Sin cache se vera un parpadeo al recargar, y nada mas
    }
  }

  return elegido;
}

/**
 * Olvida el tema y vuelve al de defecto.
 *
 * Se llama al cerrar sesion: en un equipo compartido, el color de marca de
 * un negocio no tiene que seguir pintando la pantalla de quien entre
 * despues.
 */
export function olvidarTema() {
  try {
    localStorage.removeItem(CLAVE_TEMA);
  } catch {
    // No se pudo guardar, asi que tampoco hay nada que borrar
  }

  aplicarTema(TEMA_POR_DEFECTO, { recordar: false });
}
