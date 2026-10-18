// ============================================
// tests/admin.spec.js — RF-13, RF-14 y RF-15
//
// Es la primera pantalla del proyecto que depende del rol, así que la mitad
// de estas pruebas no miran lo que la pantalla muestra sino quién puede
// verla. La otra mitad comprueba que las acciones del RF-14 afectan de
// verdad al servidor, no solo a la fila dibujada.
// ============================================
const { test, expect } = require("@playwright/test");
const {
  prepararSesion, prepararSesionAdmin, USUARIOS_ADMIN, RESUMEN_ADMIN
} = require("./ayudas");

test.describe("Solo entra el administrador (RN-22)", () => {
  test("una cuenta de empresa es devuelta al dashboard", async ({ page }) => {
    await prepararSesion(page);

    await page.goto("/admin.html");

    // El servidor responde 403 de todas formas; esto evita que vea una
    // pantalla vacía sin entender por qué
    await expect(page).toHaveURL(/dashboard\.html/);
  });

  test("y no le aparece el enlace en el menú", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/dashboard.html");

    await expect(page.locator('.sidebar-item[href="admin.html"]')).toHaveCount(0);
  });

  test("al administrador sí le aparece", async ({ page }) => {
    await prepararSesionAdmin(page);
    await page.goto("/dashboard.html");

    await expect(page.locator('.sidebar-item[href="admin.html"]')).toHaveCount(1);
  });
});

test.describe("Consulta de usuarios (RF-13)", () => {
  test.beforeEach(async ({ page }) => {
    await prepararSesionAdmin(page);
    await page.goto("/admin.html");
  });

  test("el resumen dice cuántas cuentas hay", async ({ page }) => {
    const tarjetas = page.locator(".admin-kpi");

    await expect(tarjetas).toHaveCount(6);
    await expect(tarjetas.nth(0)).toContainText("Cuentas registradas");
    await expect(tarjetas.nth(0).locator(".admin-kpi-valor"))
      .toHaveText(String(RESUMEN_ADMIN.total));
    await expect(tarjetas.nth(2).locator(".admin-kpi-valor"))
      .toHaveText(String(RESUMEN_ADMIN.restringidos));
  });

  test("destaca las cuentas que nunca entraron", async ({ page }) => {
    // Son las candidatas del RF-14: "eliminar usuarios inactivos"
    const aviso = page.locator(".admin-kpi--aviso");

    await expect(aviso.first()).toContainText("Nunca entraron");
  });

  test("lista cada cuenta con su negocio y su actividad", async ({ page }) => {
    const filas = page.locator(".admin-tabla tbody tr");

    await expect(filas).toHaveCount(USUARIOS_ADMIN.length);

    const primera = filas.first();

    await expect(primera).toContainText("Fonda La Cosecha");
    await expect(primera).toContainText("camila@fondalacosecha.co");
    await expect(primera).toContainText("7 bloques");

    // 248 + 96 + 73
    await expect(primera.locator(".admin-actividad")).toHaveText("417");
  });

  test("una cuenta sin perfil se muestra, no se esconde", async ({ page }) => {
    // Son justo las que el administrador quiere ver: registradas y sin usar
    const fila = page.locator(".admin-tabla tbody tr", { hasText: "Cuenta Sin Estrenar" });

    await expect(fila).toContainText("Sin perfil");
    await expect(fila).toContainText("Nunca entró");
  });

  test("el estado se ve de un vistazo", async ({ page }) => {
    const restringida = page.locator(".admin-tabla tbody tr", { hasText: "Panaderia La Espiga" });

    await expect(restringida.locator(".admin-chip--restringido")).toHaveText("Restringido");
  });

  test("el buscador filtra contra el servidor", async ({ page }) => {
    await page.fill("#admin-busqueda", "Espiga");

    await expect(page.locator(".admin-tabla tbody tr")).toHaveCount(1);
    await expect(page.locator(".admin-tabla tbody tr")).toContainText("Panaderia La Espiga");
  });

  test("el filtro de estado también", async ({ page }) => {
    await page.selectOption("#admin-estado", "restringido");

    await expect(page.locator(".admin-tabla tbody tr")).toHaveCount(1);
  });

  test("si nada coincide, lo explica en lugar de dejar la tabla vacía", async ({ page }) => {
    await page.fill("#admin-busqueda", "no-existe-esta-cuenta");

    await expect(page.locator("#admin-vacio")).toBeVisible();
    await expect(page.locator(".admin-tabla tbody tr")).toHaveCount(0);
  });
});

test.describe("Restringir y eliminar (RF-14)", () => {
  test.beforeEach(async ({ page }) => {
    await prepararSesionAdmin(page);
    await page.goto("/admin.html");
  });

  /** La fila de una cuenta, por su nombre. */
  const filaDe = (page, nombre) =>
    page.locator(".admin-tabla tbody tr", { hasText: nombre });

  test("restringir pide confirmación antes de actuar", async ({ page }) => {
    const fila = filaDe(page, "Fonda La Cosecha");

    await fila.locator('[data-accion="estado"]').click();

    // Afecta a otra persona: no se ejecuta de un solo clic
    await expect(page.locator("#admin-confirmar")).toBeVisible();
    await expect(page.locator("#admin-confirmar-texto")).toContainText("dejará de poder iniciar sesión");

    // Y mientras no se confirme, no ha pasado nada
    await expect(fila.locator(".admin-chip--activo")).toBeVisible();
  });

  test("cancelar no cambia nada", async ({ page }) => {
    const fila = filaDe(page, "Fonda La Cosecha");

    await fila.locator('[data-accion="estado"]').click();
    await page.click("#admin-cancelar");

    await expect(page.locator("#admin-confirmar")).toBeHidden();
    await expect(filaDe(page, "Fonda La Cosecha").locator(".admin-chip--activo")).toBeVisible();
  });

  test("al confirmar, la cuenta queda restringida en el servidor", async ({ page }) => {
    await filaDe(page, "Fonda La Cosecha").locator('[data-accion="estado"]').click();
    await page.click("#admin-aceptar");

    await expect(filaDe(page, "Fonda La Cosecha").locator(".admin-chip--restringido")).toBeVisible();

    // Se comprueba contra el servidor, no contra la fila que se repintó
    await expect
      .poll(async () => page.evaluate(async () => {
        const { data } = await Api.listarUsuariosAdmin({ busqueda: "Fonda" });
        return data[0].estado;
      }))
      .toBe("restringido");
  });

  test("una cuenta restringida se puede reactivar", async ({ page }) => {
    const fila = filaDe(page, "Panaderia La Espiga");

    await expect(fila.locator('[data-accion="estado"]')).toHaveText("Reactivar");

    await fila.locator('[data-accion="estado"]').click();
    await expect(page.locator("#admin-confirmar-texto")).toContainText("podrá volver a iniciar sesión");
    await page.click("#admin-aceptar");

    await expect(filaDe(page, "Panaderia La Espiga").locator(".admin-chip--activo")).toBeVisible();
  });

  test("eliminar avisa de que no se deshace y quita la cuenta", async ({ page }) => {
    await filaDe(page, "Cuenta Sin Estrenar").locator('[data-accion="eliminar"]').click();

    await expect(page.locator("#admin-confirmar-texto")).toContainText("no se puede deshacer");

    await page.click("#admin-aceptar");

    await expect(filaDe(page, "Cuenta Sin Estrenar")).toHaveCount(0);
    await expect(page.locator(".admin-tabla tbody tr")).toHaveCount(USUARIOS_ADMIN.length - 1);
  });

  test("el administrador no puede actuar sobre su propia cuenta", async ({ page }) => {
    const propia = filaDe(page, "Cafe Raices S.A.");

    // El servidor lo rechaza con 400; aquí no se ofrece el botón, para no
    // prometer algo que va a fallar. Si fuera el único administrador, nadie
    // podría volver a administrar el sistema.
    await expect(propia.locator("[data-accion]")).toHaveCount(0);
    await expect(propia).toContainText("Tu cuenta");
  });

  test("si el servidor rechaza la acción, se avisa y la fila no cambia", async ({ page }) => {
    await page.unroute("**/api/**");
    await prepararSesionAdmin(page, {
      errorAlAdministrar: { status: 400, message: "Un administrador no puede restringir su propia cuenta" }
    });
    await page.goto("/admin.html");

    await filaDe(page, "Fonda La Cosecha").locator('[data-accion="estado"]').click();
    await page.click("#admin-aceptar");

    await expect(page.locator("#admin-toast")).toContainText("no puede restringir");
    await expect(filaDe(page, "Fonda La Cosecha").locator(".admin-chip--activo")).toBeVisible();
  });
});

test.describe("Descarga del reporte (RF-15)", () => {
  test("se descarga como archivo, con el nombre que da el servidor", async ({ page }) => {
    await prepararSesionAdmin(page);
    await page.goto("/admin.html");

    const descarga = page.waitForEvent("download");

    await page.click("#admin-descargar");

    const archivo = await descarga;

    // Lo que pide el requisito es DESCARGAR el reporte, no mostrarlo
    expect(archivo.suggestedFilename()).toBe("usuarios-2026-10-18.csv");
  });

  test("el reporte respeta los filtros de la pantalla", async ({ page }) => {
    await prepararSesionAdmin(page);
    await page.goto("/admin.html");

    const peticiones = [];

    page.on("request", (peticion) => {
      if (peticion.url().includes("/admin/reportes/")) peticiones.push(peticion.url());
    });

    await page.fill("#admin-busqueda", "Espiga");
    await expect(page.locator(".admin-tabla tbody tr")).toHaveCount(1);

    const descarga = page.waitForEvent("download");
    await page.click("#admin-descargar");
    await descarga;

    // Un reporte que no coincide con lo que se está viendo desconcierta
    expect(peticiones[0]).toContain("busqueda=Espiga");
  });
});
