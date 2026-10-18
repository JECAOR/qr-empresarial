// ============================================
// tests/configuracion.spec.js — RF-12
//
// "Modificar datos personales, cambiar la contraseña y personalizar opciones
// de la plataforma". La contraseña ya se probaba en auth.spec.js, con el
// módulo 1. Aquí van las otras dos partes, que vivían solo en el navegador:
// quien entraba desde otro equipo perdía sus avisos y su tema.
// ============================================
const { test, expect } = require("@playwright/test");
const { simularApi, sembrarSesion, prepararSesion, USUARIO, PERFIL } = require("./ayudas");

test.describe("Datos personales", () => {
  test.beforeEach(async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");
  });

  test("el formulario llega con los datos de la cuenta", async ({ page }) => {
    await expect(page.locator("#acc-name")).toHaveValue(USUARIO.nombre);
    await expect(page.locator("#acc-email")).toHaveValue(USUARIO.correo);
  });

  test("cambiar solo el nombre no pide la contraseña", async ({ page }) => {
    await expect(page.locator("#acc-password-field")).toBeHidden();

    await page.fill("#acc-name", "Nombre Corregido");
    await page.click('#account-form button[type="submit"]');

    await expect(page.locator("#account-saved-toast")).toContainText("Datos actualizados");

    // La sesión guarda el nombre: si no se refresca, la barra lateral
    // seguiría mostrando el de antes
    const nombre = await page.evaluate(() => Sesion.usuario().nombre);
    expect(nombre).toBe("Nombre Corregido");
  });

  test("al escribir otro correo aparece el campo de la contraseña", async ({ page }) => {
    await expect(page.locator("#acc-password-field")).toBeHidden();

    await page.fill("#acc-email", "otro@ejemplo.co");

    // Aparece al escribir, no al enviar: así no sorprende
    await expect(page.locator("#acc-password-field")).toBeVisible();
  });

  test("si el correo vuelve a ser el mismo, el campo se esconde", async ({ page }) => {
    await page.fill("#acc-email", "otro@ejemplo.co");
    await expect(page.locator("#acc-password-field")).toBeVisible();

    await page.fill("#acc-email", USUARIO.correo);
    await expect(page.locator("#acc-password-field")).toBeHidden();
  });

  test("no manda el cambio de correo sin la contraseña", async ({ page }) => {
    await page.fill("#acc-email", "otro@ejemplo.co");
    await page.click('#account-form button[type="submit"]');

    const campo = page.locator("#acc-password")
      .locator("xpath=ancestor::div[contains(@class,'form-field')]");
    await expect(campo).toHaveClass(/has-error/);

    // Nada llegó al servidor: la sesión conserva el correo de antes
    const correo = await page.evaluate(() => Sesion.usuario().correo);
    expect(correo).toBe(USUARIO.correo);
  });

  test("con la contraseña, el correo se cambia", async ({ page }) => {
    await page.fill("#acc-email", "otro@ejemplo.co");
    await page.fill("#acc-password", "Clave123*");
    await page.click('#account-form button[type="submit"]');

    await expect(page.locator("#account-saved-toast")).toContainText("Datos actualizados");

    const correo = await page.evaluate(() => Sesion.usuario().correo);
    expect(correo).toBe("otro@ejemplo.co");

    // Y el campo vuelve a esconderse, porque ya no hay cambio pendiente
    await expect(page.locator("#acc-password-field")).toBeHidden();
  });

  test("muestra el error del servidor si el correo ya es de otra cuenta", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, {
      errorAlGuardarDatos: { status: 409, message: "Ese correo ya está registrado en otra cuenta" }
    });
    await sembrarSesion(page);
    await page.goto("/configuracion.html");

    await page.fill("#acc-email", "ocupado@ejemplo.co");
    await page.fill("#acc-password", "Clave123*");
    await page.click('#account-form button[type="submit"]');

    await expect(page.locator("#account-saved-toast")).toContainText("ya está registrado");
  });

  test("no deja guardar un nombre de una letra", async ({ page }) => {
    await page.fill("#acc-name", "A");
    await page.click('#account-form button[type="submit"]');

    const campo = page.locator("#acc-name")
      .locator("xpath=ancestor::div[contains(@class,'form-field')]");
    await expect(campo).toHaveClass(/has-error/);
  });
});

test.describe("Preferencias de avisos", () => {
  test("los interruptores llegan como están en el servidor", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page);
    await sembrarSesion(page);

    // Antes se leían de localStorage, que es de ese navegador y de nadie más
    await page.goto("/configuracion.html");

    // Los valores por defecto que responde el servidor: resumen y reseñas sí,
    // novedades no
    await expect.poll(async () => page.evaluate(() =>
      [...document.querySelectorAll(".settings-notif-toggle")]
        .map((b) => b.classList.contains("on")).join(",")
    )).toBe("true,true,false");
  });

  test("al pulsar un interruptor se guarda en el servidor", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");

    const novedades = page.locator('[data-notif-key="updates"]');
    await expect(novedades).not.toHaveClass(/on/);

    await novedades.click();
    await expect(novedades).toHaveClass(/on/);

    // Se comprueba contra el servidor, no contra la pantalla
    await expect.poll(async () => page.evaluate(async () =>
      (await Api.misPreferencias()).data.novedades
    )).toBe(true);
  });

  test("si el servidor rechaza el cambio, el interruptor vuelve atrás", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, { errorAlGuardarPreferencias: "No se pudo guardar" });
    await sembrarSesion(page);
    await page.goto("/configuracion.html");

    const novedades = page.locator('[data-notif-key="updates"]');
    await novedades.click();

    // Dejarlo encendido en la pantalla y apagado en el servidor sería peor
    await expect(novedades).not.toHaveClass(/on/);
    await expect(page.locator("#notif-saved-toast")).toContainText("No se pudo guardar");
  });
});

test.describe("Tema del negocio", () => {
  test("la vista pública usa el tema del negocio, no el del visitante", async ({ page }) => {
    // Es la razón de que el tema viva en el perfil: antes esta pantalla
    // aplicaba el tema guardado en el navegador de quien la abría, así que el
    // color que elegía el negocio no llegaba nunca a quien escaneaba
    await page.route("**/api/publico/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            perfil: { ...PERFIL, tema: "terracota", urlPublica: "/p/" + PERFIL.slug },
            contenido: [],
            porSeccion: {}
          }
        })
      })
    );

    // El visitante llega con el tema por defecto en su navegador
    await page.goto(`/public.html?slug=${PERFIL.slug}`);

    await expect.poll(async () => page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    )).toBe("terracota");
  });

  test("un negocio con el tema por defecto no fuerza ningún color", async ({ page }) => {
    await page.route("**/api/publico/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            perfil: { ...PERFIL, tema: "indigo", urlPublica: "/p/" + PERFIL.slug },
            contenido: [],
            porSeccion: {}
          }
        })
      })
    );

    await page.goto(`/public.html?slug=${PERFIL.slug}`);

    await expect.poll(async () => page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    )).toBe(null);
  });
});

// Prueba de regresión de un fallo destructivo: el selector de color guardaba
// el perfil COMPLETO tomándolo de la caché del navegador. Si esa caché aún no
// se había sincronizado —al entrar y pulsar un color antes de que llegara el
// perfil—, el negocio real quedaba reemplazado por los datos de ejemplo.
//
// Se comprobó de verdad: "Panadería La Espiga" se convirtió en "Fonda La
// Cosecha", con su categoría, su dirección y su teléfono, solo por elegir un
// color. Ahora el tema tiene su propio endpoint, que toca una sola columna.
test.describe("Cambiar el tema no toca el resto del perfil", () => {
  test("usa el endpoint del tema, no el que reemplaza el perfil", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/dashboard.html");

    // Se vacía la caché para reproducir el instante en que la guardia aún no
    // ha traído el perfil
    await page.evaluate(() => localStorage.removeItem("qre-business"));

    // Al terminar, la función recarga la página para repintar los <canvas>
    // con el color nuevo. Aquí se neutraliza: una recarga destruiría el
    // contexto y la prueba no podría comprobar nada.
    await page.evaluate(() => {
      window.__recargas = 0;
      recargarParaRepintar = () => { window.__recargas += 1; };
    });

    await page.evaluate(() => guardarTemaEnElPerfil("teal"));

    await expect
      .poll(() => page.peticionesPerfil.filter((p) => p.url === "/perfiles/me/tema").length)
      .toBeGreaterThan(0);

    // Lo que no debe haber ocurrido: un PUT del perfil entero
    const reemplazos = page.peticionesPerfil.filter(
      (p) => p.url === "/perfiles/me" && p.metodo === "PUT"
    );
    expect(reemplazos).toHaveLength(0);
  });

  test("el negocio sigue siendo el mismo después de cambiar el color", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/dashboard.html");

    await page.evaluate(() => localStorage.removeItem("qre-business"));

    await page.evaluate(() => {
      window.__recargas = 0;
      recargarParaRepintar = () => { window.__recargas += 1; };
    });

    await page.evaluate(() => guardarTemaEnElPerfil("terracota"));

    const perfil = await page.evaluate(async () => (await Api.miPerfilEmpresarial()).data);

    // Lo que importa: el negocio quedó intacto y solo cambió el color
    expect(perfil.nombreNegocio).toBe(PERFIL.nombreNegocio);
    expect(perfil.direccion).toBe(PERFIL.direccion);
    expect(perfil.tema).toBe("terracota");

    // Y sí se pidió repintar: los <canvas> ya dibujados necesitan el color nuevo
    expect(await page.evaluate(() => window.__recargas)).toBe(1);
  });
});
