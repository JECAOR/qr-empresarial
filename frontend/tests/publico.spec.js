// ============================================
// tests/publico.spec.js — vista pública del perfil (RF-09)
//
// Es la pantalla a la que lleva el código QR, y la única que se usa sin
// sesión: quien escanea no tiene cuenta. Por eso aquí NO se siembra sesión,
// a diferencia del resto de la suite.
//
// Los datos de prueba son deliberadamente distintos de los que trae escritos
// el HTML de la pantalla. Si coincidieran, una prueba podría pasar sin que la
// API se llegara a consultar —y eso ya ocurrió mientras se escribía este
// archivo—, de modo que no demostraría nada.
// ============================================
const { test, expect } = require("@playwright/test");

const PERFIL_PUBLICO = {
  nombreNegocio: "Panadería de Prueba",
  categoria: "Panadería artesanal",
  descripcion: "Pan de masa madre horneado cada mañana.",
  direccion: "Calle 12 #3-45, Bogotá",
  telefono: "+57 301 222 3344",
  correoContacto: "hola@panaderiadeprueba.co",
  instagram: "@panaderiadeprueba",
  horario: "Lun-Sáb 6:00–19:00",
  imagen: null,
  slug: "panaderia-de-prueba",
  actualizadoEn: null
};

const BLOQUES = {
  menu: [
    {
      id: "enlace-1",
      tipo: "enlace",
      seccion: "menu",
      titulo: "Ver la carta",
      detalle: "https://panaderiadeprueba.co/carta",
      categoria: "Página Web",
      icono: "globe"
    },
    {
      id: "elemento-1",
      tipo: "texto",
      seccion: "menu",
      titulo: "Hora de hornada",
      detalle: "Pan recién salido a las 6:00 y a las 16:00",
      categoria: "Texto",
      icono: "text"
    }
  ],
  promos: [
    {
      id: "enlace-2",
      tipo: "enlace",
      seccion: "promos",
      titulo: "Promo del martes",
      detalle: "https://panaderiadeprueba.co/promo",
      categoria: "Página Web",
      icono: "globe"
    }
  ]
};

/** Responde la vista pública con los datos de arriba. */
async function simularPerfilPublico(page, opciones = {}) {
  const { noDisponible = false, perfil = PERFIL_PUBLICO, porSeccion = BLOQUES } = opciones;

  await page.route("**/api/publico/**", (route) => {
    if (noDisponible) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Este perfil no está disponible" })
      });
    }

    const contenido = Object.values(porSeccion).flat();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { perfil, contenido, porSeccion } })
    });
  });
}

// La pantalla acepta ?slug= además de la ruta /p/<slug>, que es la que sirve
// el backend. Las pruebas usan el parámetro porque aquí el frontend se
// publica con un servidor de archivos, sin esa ruta.
const DIRECCION = `/public.html?slug=${PERFIL_PUBLICO.slug}`;

test.describe("Vista pública", () => {
  test("muestra los datos del negocio sin necesidad de sesión", async ({ page }) => {
    await simularPerfilPublico(page);
    await page.goto(DIRECCION);

    await expect(page.locator("#profile-name")).toHaveText(PERFIL_PUBLICO.nombreNegocio);
    await expect(page.locator("#profile-address")).toHaveText(PERFIL_PUBLICO.direccion);
    await expect(page.locator("#profile-phone")).toHaveText(PERFIL_PUBLICO.telefono);
    await expect(page).toHaveTitle(new RegExp(PERFIL_PUBLICO.nombreNegocio));

    const haySesion = await page.evaluate(() => Boolean(localStorage.getItem("qr.sesion")));
    expect(haySesion).toBe(false);
  });

  test("los enlaces de contacto se arman con los datos del perfil", async ({ page }) => {
    await simularPerfilPublico(page);
    await page.goto(DIRECCION);

    const digitos = PERFIL_PUBLICO.telefono.replace(/[^\d]/g, "");

    await expect(page.locator("#link-whatsapp")).toHaveAttribute("href", `https://wa.me/${digitos}`);
    await expect(page.locator("#link-reserve")).toHaveAttribute("href", `tel:+${digitos}`);
    await expect(page.locator("#link-email")).toHaveAttribute("href", `mailto:${PERFIL_PUBLICO.correoContacto}`);
    await expect(page.locator("#link-maps")).toHaveAttribute("href", new RegExp(encodeURIComponent("Bogot")));
  });

  test("oculta el contacto que el negocio no haya llenado", async ({ page }) => {
    // Un "mailto:" vacío o un WhatsApp sin número solo sirven para que
    // alguien los pulse y no pase nada
    await simularPerfilPublico(page, {
      perfil: { ...PERFIL_PUBLICO, telefono: null, correoContacto: null, instagram: null }
    });
    await page.goto(DIRECCION);

    await expect(page.locator("#link-whatsapp")).toBeHidden();
    await expect(page.locator("#link-reserve")).toBeHidden();
    await expect(page.locator("#link-email")).toBeHidden();
    await expect(page.locator("#link-instagram")).toBeHidden();

    // La dirección sí está, así que ese sigue visible
    await expect(page.locator("#link-maps")).toBeVisible();
  });

  test("muestra el contenido que armó la empresa, por secciones", async ({ page }) => {
    await simularPerfilPublico(page);
    await page.goto(DIRECCION);

    const titulos = page.locator(".profile-section-title");
    await expect(titulos).toHaveCount(2);
    await expect(titulos.nth(0)).toHaveText("Menú principal");
    await expect(titulos.nth(1)).toHaveText("Promociones");

    await expect(page.locator(".profile-block-title", { hasText: "Ver la carta" })).toBeVisible();
    await expect(page.locator(".profile-block-title", { hasText: "Hora de hornada" })).toBeVisible();
    await expect(page.locator(".profile-block-title", { hasText: "Promo del martes" })).toBeVisible();
  });

  test("los enlaces se pintan como enlaces y los textos no", async ({ page }) => {
    await simularPerfilPublico(page);
    await page.goto(DIRECCION);

    const enlace = page.locator("a.profile-block", { hasText: "Ver la carta" });
    await expect(enlace).toHaveAttribute("href", BLOQUES.menu[0].detalle);
    await expect(enlace).toHaveAttribute("target", "_blank");
    await expect(enlace).toHaveAttribute("rel", /noopener/);

    // Un bloque de texto no lleva a ninguna parte: no debe anunciarse como
    // enlace ni recibir el foco al tabular
    const texto = page.locator(".profile-block", { hasText: "Hora de hornada" });
    expect(await texto.evaluate((el) => el.tagName)).toBe("DIV");
  });

  test("sin contenido, la pantalla se queda solo con el perfil", async ({ page }) => {
    await simularPerfilPublico(page, { porSeccion: {} });
    await page.goto(DIRECCION);

    await expect(page.locator("#profile-name")).toHaveText(PERFIL_PUBLICO.nombreNegocio);
    await expect(page.locator(".profile-section-title")).toHaveCount(0);
  });

  test("si el perfil no está disponible, lo explica en lugar de quedarse vacío", async ({ page }) => {
    await simularPerfilPublico(page, { noDisponible: true });
    await page.goto(DIRECCION);

    await expect(page.locator("#public-unavailable")).toBeVisible();
    await expect(page.locator("#public-card")).toBeHidden();
    await expect(page).toHaveTitle(/no disponible/);
  });

  test("[seguridad] lo que escribió el negocio no ejecuta HTML ni JS", async ({ page }) => {
    // Lo que se pinta aquí viene del panel de otra persona y lo lee cualquiera
    // que escanee el código: es el sitio del proyecto donde un escape que
    // falte tiene más alcance
    const dialogos = [];
    page.on("dialog", (d) => {
      dialogos.push(d.message());
      d.accept();
    });

    await simularPerfilPublico(page, {
      perfil: { ...PERFIL_PUBLICO, nombreNegocio: '<img src=x onerror="alert(1)">' },
      porSeccion: {
        menu: [{
          id: "elemento-9",
          tipo: "texto",
          seccion: "menu",
          titulo: "<script>alert(2)</script>",
          detalle: "cuerpo",
          categoria: "Texto",
          icono: "text"
        }]
      }
    });

    await page.goto(DIRECCION);
    await page.waitForTimeout(400);

    expect(dialogos).toEqual([]);

    const html = await page.locator("#public-content").innerHTML();
    expect(html).not.toContain("<script>alert(2)</script>");
  });
});
