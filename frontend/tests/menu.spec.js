// ============================================
// tests/menu.spec.js — vista detallada de la sección "menu" (RF-09)
//
// Es la pantalla del botón "Ver menú completo" de la vista pública. Antes
// mostraba un menú de restaurante escrito a mano, con los platos y precios de
// un negocio de ejemplo: cualquiera que llegara escaneando un código veía la
// carta de otro. Estas pruebas son, en buena parte, la regresión de eso.
//
// Como la vista pública, no se siembra sesión: quien escanea no tiene cuenta.
// ============================================
const { test, expect } = require("@playwright/test");

const PERFIL = {
  nombreNegocio: "Panadería de Prueba",
  categoria: "Panadería artesanal",
  descripcion: "Pan de masa madre.",
  direccion: "Calle 12 #3-45, Bogotá",
  telefono: "+57 301 222 3344",
  correoContacto: "hola@panaderiadeprueba.co",
  instagram: "@panaderiadeprueba",
  horario: "Lun-Sáb 6:00–19:00",
  imagen: null,
  slug: "panaderia-de-prueba",
  actualizadoEn: null
};

const BLOQUES_MENU = [
  {
    id: "enlace-1",
    tipo: "enlace",
    seccion: "menu",
    titulo: "Carta de panes",
    detalle: "https://panaderiadeprueba.co/panes",
    categoria: "PDF",
    icono: "file-text"
  },
  {
    id: "elemento-1",
    tipo: "texto",
    seccion: "menu",
    titulo: "Horneado del día",
    detalle: "Pan de masa madre a las 6:00 y a las 16:00",
    categoria: "Texto",
    icono: "text"
  }
];

async function simularPerfil(page, opciones = {}) {
  const { noDisponible = false, porSeccion = { menu: BLOQUES_MENU } } = opciones;

  await page.route("**/api/publico/**", (route) => {
    if (noDisponible) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Este perfil no está disponible" })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { perfil: PERFIL, contenido: Object.values(porSeccion).flat(), porSeccion }
      })
    });
  });
}

const DIRECCION = `/menu.html?slug=${PERFIL.slug}`;

test.describe("Vista del menú", () => {
  test("muestra el negocio y los bloques de su sección menu", async ({ page }) => {
    await simularPerfil(page);
    await page.goto(DIRECCION);

    await expect(page.locator("#menu-biz-name")).toHaveText(PERFIL.nombreNegocio);
    await expect(page).toHaveTitle(new RegExp(PERFIL.nombreNegocio));

    const titulos = page.locator(".menu-item-info h3");
    await expect(titulos).toHaveCount(2);
    await expect(titulos.nth(0)).toHaveText("Carta de panes");
    await expect(titulos.nth(1)).toHaveText("Horneado del día");
  });

  test("ya no muestra los platos escritos a mano [regresión]", async ({ page }) => {
    await simularPerfil(page);
    await page.goto(DIRECCION);

    // Eran los del negocio de ejemplo, visibles para cualquier visitante
    await expect(page.locator("text=Bandeja paisa completa")).toHaveCount(0);
    await expect(page.locator("text=$32.000")).toHaveCount(0);
    await expect(page.locator("text=Fonda La Cosecha")).toHaveCount(0);
  });

  test("volver al perfil lleva al perfil de este negocio", async ({ page }) => {
    await simularPerfil(page);
    await page.goto(DIRECCION);

    // Sin el slug, desde un teléfono sin nada en caché, volver mostraría
    // "perfil no disponible"
    await expect(page.locator("#menu-back")).toHaveAttribute("href", `/p/${PERFIL.slug}`);
  });

  test("los enlaces se abren y los textos no son enlaces", async ({ page }) => {
    await simularPerfil(page);
    await page.goto(DIRECCION);

    const enlace = page.locator("a.menu-item", { hasText: "Carta de panes" });
    await expect(enlace).toHaveAttribute("href", BLOQUES_MENU[0].detalle);
    await expect(enlace).toHaveAttribute("rel", /noopener/);

    const texto = page.locator(".menu-item", { hasText: "Horneado del día" });
    expect(await texto.evaluate((el) => el.tagName)).toBe("DIV");
  });

  test("si la sección está vacía, lo dice", async ({ page }) => {
    await simularPerfil(page, { porSeccion: {} });
    await page.goto(DIRECCION);

    await expect(page.locator("#menu-empty")).toBeVisible();
    await expect(page.locator(".menu-item")).toHaveCount(0);
  });

  test("si el perfil no está disponible, lo explica", async ({ page }) => {
    await simularPerfil(page, { noDisponible: true });
    await page.goto(DIRECCION);

    await expect(page.locator("#menu-empty")).toContainText("no está disponible");
    await expect(page.locator("#menu-biz-name")).toHaveText("Menú no disponible");
  });

  test("sin slug en la dirección, lo explica en lugar de mostrar otro negocio", async ({ page }) => {
    await simularPerfil(page);
    await page.goto("/menu.html");

    await expect(page.locator("#menu-empty")).toContainText("No se indicó");
  });

  test("[seguridad] lo que escribió el negocio no ejecuta HTML ni JS", async ({ page }) => {
    const dialogos = [];
    page.on("dialog", (d) => {
      dialogos.push(d.message());
      d.accept();
    });

    await simularPerfil(page, {
      porSeccion: {
        menu: [{
          id: "elemento-9",
          tipo: "texto",
          seccion: "menu",
          titulo: "<script>alert(1)</script>",
          detalle: '<img src=x onerror="alert(2)">',
          categoria: "Texto",
          icono: "text"
        }]
      }
    });

    await page.goto(DIRECCION);
    await page.waitForTimeout(400);

    expect(dialogos).toEqual([]);

    const html = await page.locator("#menu-items").innerHTML();
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

test.describe("Enlace al menú desde la vista pública", () => {
  test("lleva el slug, para saber de qué negocio es", async ({ page }) => {
    await simularPerfil(page);
    await page.goto(`/public.html?slug=${PERFIL.slug}`);

    await expect(page.locator("#link-menu")).toHaveAttribute(
      "href",
      `/menu.html?slug=${PERFIL.slug}`
    );
  });

  test("se oculta cuando el negocio no publicó nada en esa sección", async ({ page }) => {
    // No tiene sentido ofrecer un botón que lleva a una pantalla sin nada
    await simularPerfil(page, { porSeccion: { promos: [] } });
    await page.goto(`/public.html?slug=${PERFIL.slug}`);

    await expect(page.locator("#link-menu")).toBeHidden();
  });
});
