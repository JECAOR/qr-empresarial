// ============================================
// tests/auth.spec.js
// Login, Registro (3 pasos), Recuperar contraseña y cierre de sesión
//
// El frontend habla con la API, pero estas pruebas no levantan el backend:
// las respuestas se simulan con simularApi (ver ayudas.js). Así comprueban
// lo que le toca al frontend —enviar, guardar la sesión, mostrar el error,
// navegar— y pasan en cualquier máquina. Que el backend responda lo que
// debe se comprueba aparte, con la colección de Postman.
// ============================================
const { test, expect } = require("@playwright/test");
const { simularApi, sembrarSesion, prepararSesion, USUARIO, TOKEN, TOKEN_NUEVO } = require("./ayudas");

test.describe("Login", () => {
  test("bloquea el envío con campos vacíos y muestra los errores", async ({ page }) => {
    await simularApi(page);
    await page.goto("/login.html");
    await page.click('button[type="submit"]');
    await expect(page.locator(".form-field.has-error")).toHaveCount(2);
    // No debe haber navegado
    await expect(page).toHaveURL(/login\.html/);
  });

  test("el botón de mostrar/ocultar contraseña funciona con teclado", async ({ page }) => {
    await page.goto("/login.html");
    await page.click("#email");
    await page.keyboard.press("Tab"); // -> password
    await page.keyboard.press("Tab"); // -> toggle button
    await expect(page.locator(".toggle-password")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
  });

  test("con datos válidos navega al dashboard y guarda la sesión", async ({ page }) => {
    await simularApi(page);
    await page.goto("/login.html");
    await page.fill("#email", "camila@fondalacosecha.co");
    await page.fill("#password", "Abcdefgh123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard\.html/);

    const sesion = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("qr.sesion") || localStorage.getItem("qr.sesion"))
    );
    expect(sesion.usuario.correo).toBe(USUARIO.correo);
    expect(sesion.token).toBeTruthy();
  });

  test('marcar "Mantenerme conectado" guarda la sesión de forma permanente', async ({ page }) => {
    await simularApi(page);
    await page.goto("/login.html");
    await page.fill("#email", "camila@fondalacosecha.co");
    await page.fill("#password", "Abcdefgh123");
    await page.check("#remember");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard\.html/);

    // Sin marcarlo iría a sessionStorage, que se borra al cerrar la pestaña
    const enLocal = await page.evaluate(() => Boolean(localStorage.getItem("qr.sesion")));
    expect(enLocal).toBe(true);
  });

  test("con credenciales incorrectas muestra el aviso y no navega", async ({ page }) => {
    // El backend responde el mismo 401 para correo inexistente, contraseña
    // equivocada y cuenta restringida, para no revelar qué correos existen.
    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Credenciales inválidas" })
      })
    );

    await page.goto("/login.html");
    await page.fill("#email", "camila@fondalacosecha.co");
    await page.fill("#password", "la-que-no-es");
    await page.click('button[type="submit"]');

    await expect(page.locator("#form-alert")).toBeVisible();
    await expect(page.locator("#form-alert")).toContainText("Credenciales inválidas");
    await expect(page).toHaveURL(/login\.html/);
  });

  test("si el servidor no responde lo dice en lugar de quedarse callado", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort("failed"));

    await page.goto("/login.html");
    await page.fill("#email", "camila@fondalacosecha.co");
    await page.fill("#password", "Abcdefgh123");
    await page.click('button[type="submit"]');

    await expect(page.locator("#form-alert")).toContainText("No se pudo conectar");
    await expect(page).toHaveURL(/login\.html/);
  });

  test("el enlace de olvidé mi contraseña lleva a la página correcta", async ({ page }) => {
    await page.goto("/login.html");
    await page.click("text=¿Olvidaste?");
    await expect(page).toHaveURL(/forgot-password\.html/);
  });
});

test.describe("Pantallas privadas", () => {
  test("sin sesión, el dashboard devuelve al login", async ({ page }) => {
    // Sin sembrar sesión: la guardia debe actuar antes de mostrar nada
    await page.goto("/dashboard.html");
    await expect(page).toHaveURL(/login\.html/);
  });

  test("con sesión, el dashboard se abre y muestra con qué cuenta se entró", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/dashboard.html");

    await expect(page).toHaveURL(/dashboard\.html/);
    // El nombre grande es el del negocio, que se edita en Configuración.
    // De la sesión vienen el rol y el correo del tooltip.
    await expect(page.locator(".sidebar-user-plan")).toHaveText("Empresa");
    await expect(page.locator(".sidebar-user")).toHaveAttribute("title", USUARIO.correo);
  });

  test("cerrar sesión desde Configuración borra el token y vuelve al login", async ({ page }) => {
    // Se prueba aquí y no en el sidebar porque este botón existe en los dos
    // tamaños: en móvil el sidebar se oculta y no hay otro.
    await prepararSesion(page);
    await page.goto("/configuracion.html");

    await expect(page.locator("#session-email")).toHaveText(USUARIO.correo);
    await page.click("#btn-logout");

    await expect(page).toHaveURL(/login\.html/);

    const quedaAlgo = await page.evaluate(() =>
      Boolean(localStorage.getItem("qr.sesion") || sessionStorage.getItem("qr.sesion"))
    );
    expect(quedaAlgo).toBe(false);
  });

  test("si el token dejó de servir, avisa al volver al login", async ({ page }) => {
    await sembrarSesion(page);

    // El token está guardado, pero el servidor ya no lo acepta: es lo que
    // pasa tras cerrar sesión en otro dispositivo o al restringir la cuenta.
    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "La sesión fue cerrada" })
      })
    );

    await page.goto("/dashboard.html");

    await expect(page).toHaveURL(/login\.html\?motivo=sesion-expirada/);
    await expect(page.locator("#form-alert")).toContainText("Su sesión terminó");
  });
});

test.describe("Registro (3 pasos)", () => {
  test("completa el flujo completo y conserva los datos al ir y volver", async ({ page }) => {
    await simularApi(page);
    await page.goto("/register.html");

    // Paso 1 — no debe avanzar si falta algo
    await page.click('[data-next="2"]');
    await expect(page.locator(".step-item.active .step-label")).toHaveText("Cuenta");

    await page.fill("#fullname", "Camila Restrepo");
    await page.fill("#reg-email", "camila@fondalacosecha.co");
    await page.fill("#password", "Abcdefgh123!");
    await page.fill("#confirm-password", "Abcdefgh123!");
    await page.check("#terms");
    await page.click('[data-next="2"]');

    await expect(page.locator("#step-title")).toHaveText("Cuéntanos de tu negocio");

    // Paso 2
    await page.fill("#reg-biz-name", "Fonda La Cosecha");
    await page.fill("#reg-biz-address", "Cra. 35 #8A-45, El Poblado, Medellín");
    await page.fill("#reg-biz-phone", "+57 300 456 7890");
    await page.click('[data-next="3"]');

    await expect(page.locator("#step-title")).toHaveText("Elige tu plan");
    // El plan Pro debe venir preseleccionado
    await expect(page.locator("#plan-pro")).toBeChecked();

    // Volver atrás no debe perder lo que ya se llenó
    await page.click('[data-back="2"]');
    await expect(page.locator("#reg-biz-name")).toHaveValue("Fonda La Cosecha");

    // Terminar el flujo
    await page.click('[data-next="3"]');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard\.html/);

    // Queda con la sesión iniciada, sin pedir los datos otra vez
    const sesion = await page.evaluate(() => JSON.parse(localStorage.getItem("qr.sesion")));
    expect(sesion.usuario.correo).toBe(USUARIO.correo);
  });

  test("avisa cuando el correo ya está registrado", async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ message: "El correo ya está registrado" })
      })
    );

    await page.goto("/register.html");
    await page.fill("#fullname", "Camila Restrepo");
    await page.fill("#reg-email", "camila@fondalacosecha.co");
    await page.fill("#password", "Abcdefgh123!");
    await page.fill("#confirm-password", "Abcdefgh123!");
    await page.check("#terms");
    await page.click('[data-next="2"]');
    await page.fill("#reg-biz-name", "Fonda La Cosecha");
    await page.fill("#reg-biz-address", "Cra. 35 #8A-45, El Poblado, Medellín");
    await page.fill("#reg-biz-phone", "+57 300 456 7890");
    await page.click('[data-next="3"]');
    await page.click('button[type="submit"]');

    await expect(page.locator("#form-alert")).toContainText("ya está registrado");
    await expect(page).toHaveURL(/register\.html/);
  });

  test("el medidor de fuerza de contraseña reacciona a lo que se escribe", async ({ page }) => {
    await page.goto("/register.html");
    await page.fill("#password", "abc");
    await expect(page.locator("#password-strength-label")).toHaveText("Débil");
    await page.fill("#password", "Abcdefghij123!");
    await expect(page.locator("#password-strength-label")).toHaveText("Fuerte");
  });
});

test.describe("Recuperar contraseña", () => {
  test("muestra confirmación con el correo ingresado", async ({ page }) => {
    await simularApi(page);
    await page.goto("/forgot-password.html");
    await page.fill("#forgot-email", "camila@fondalacosecha.co");
    await page.click('#forgot-form button[type="submit"]');
    await expect(page.locator("#sent-step")).toBeVisible();
    await expect(page.locator("#sent-message")).toContainText("camila@fondalacosecha.co");
  });

  test("con un enlace válido pide la contraseña nueva", async ({ page }) => {
    await simularApi(page);
    await page.goto("/restablecer.html?token=" + "a".repeat(64));

    await expect(page.locator("#form-step")).toBeVisible();
    await expect(page.locator("#invalid-step")).toBeHidden();
  });

  test("con un enlace vencido o ya usado lo explica", async ({ page }) => {
    await simularApi(page, { enlaceInvalido: true });
    await page.goto("/restablecer.html?token=" + "b".repeat(64));

    await expect(page.locator("#invalid-step")).toBeVisible();
    await expect(page.locator("#form-step")).toBeHidden();
  });

  test("sin token en la dirección no muestra el formulario", async ({ page }) => {
    await simularApi(page);
    await page.goto("/restablecer.html");

    await expect(page.locator("#invalid-step")).toBeVisible();
    await expect(page.locator("#invalid-message")).toContainText("incompleto");
  });

  test("guardar la contraseña nueva lleva a la confirmación", async ({ page }) => {
    await simularApi(page);
    await page.goto("/restablecer.html?token=" + "c".repeat(64));

    await page.fill("#password", "ClaveNueva1*");
    await page.fill("#confirm-password", "ClaveNueva1*");
    await page.click('#reset-form button[type="submit"]');

    await expect(page.locator("#done-step")).toBeVisible();
  });

  test("no deja guardar si las contraseñas no coinciden", async ({ page }) => {
    await simularApi(page);
    await page.goto("/restablecer.html?token=" + "d".repeat(64));

    await page.fill("#password", "ClaveNueva1*");
    await page.fill("#confirm-password", "OtraDistinta1*");
    await page.click('#reset-form button[type="submit"]');

    await expect(page.locator("#done-step")).toBeHidden();
    await expect(page.locator("#confirm-password").locator("xpath=ancestor::div[contains(@class,'form-field')]"))
      .toHaveClass(/has-error/);
  });
});

test.describe("Cambio de contraseña desde Configuración", () => {
  const llenarFormulario = async (page, actual, nueva, confirmacion = nueva) => {
    await page.fill("#current-password", actual);
    await page.fill("#new-password", nueva);
    await page.fill("#confirm-new-password", confirmacion);
    await page.click('#password-form button[type="submit"]');
  };

  test("cambia la contraseña y guarda el token nuevo", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");

    await llenarFormulario(page, "Clave123*", "ClaveNueva1*");

    await expect(page.locator("#password-saved-toast")).toContainText("Contraseña actualizada");

    // El cambio cierra todas las sesiones de la cuenta, incluida esta: si no
    // se guardara el token nuevo, la siguiente petición daría 401
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("qr.sesion")).token);
    expect(token).toBe(TOKEN_NUEVO);

    // Y no se va de la pantalla
    await expect(page).toHaveURL(/configuracion\.html/);
  });

  test("con la contraseña actual equivocada lo señala sin cerrar la sesión", async ({ page }) => {
    // Prueba de regresión: el 401 de este endpoint significa "la contraseña
    // actual no es correcta", no "su sesión venció". El cliente de la API
    // cerraba la sesión con cualquier 401 y echaba al login a quien
    // simplemente se equivocó al escribir.
    await simularApi(page, { contrasenaActualIncorrecta: true });
    await sembrarSesion(page);
    await page.goto("/configuracion.html");

    await llenarFormulario(page, "la-que-no-es", "ClaveNueva1*");

    await expect(page.locator("#password-saved-toast")).toContainText("actual no es correcta");
    await expect(page).toHaveURL(/configuracion\.html/);

    const sigueLaSesion = await page.evaluate(() => Boolean(localStorage.getItem("qr.sesion")));
    expect(sigueLaSesion).toBe(true);
  });

  test("no envía nada si la confirmación no coincide", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");

    await llenarFormulario(page, "Clave123*", "ClaveNueva1*", "OtraDistinta1*");

    const campoConfirmacion = page.locator("#confirm-new-password")
      .locator("xpath=ancestor::div[contains(@class,'form-field')]");
    await expect(campoConfirmacion).toHaveClass(/has-error/);

    // El token sigue siendo el de antes: no hubo petición
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("qr.sesion")).token);
    expect(token).toBe(TOKEN);
  });

  test("no envía nada si falta la contraseña actual", async ({ page }) => {
    await prepararSesion(page);
    await page.goto("/configuracion.html");

    await page.fill("#new-password", "ClaveNueva1*");
    await page.fill("#confirm-new-password", "ClaveNueva1*");
    await page.click('#password-form button[type="submit"]');

    const campoActual = page.locator("#current-password")
      .locator("xpath=ancestor::div[contains(@class,'form-field')]");
    await expect(campoActual).toHaveClass(/has-error/);

    const token = await page.evaluate(() => JSON.parse(localStorage.getItem("qr.sesion")).token);
    expect(token).toBe(TOKEN);
  });
});

test.describe("Eliminar la cuenta propia", () => {
  const abrirDialogo = async (page) => {
    await page.goto("/configuracion.html");
    await page.click("#open-delete-dialog");
    await expect(page.locator("#delete-account-dialog")).toBeVisible();
  };

  test("el aviso nombra el negocio de quien lo lee", async ({ page }) => {
    await prepararSesion(page);
    await abrirDialogo(page);

    // Antes el nombre estaba fijo en el HTML
    await expect(page.locator("#delete-biz-name")).not.toHaveText("tu negocio");
  });

  test("no borra nada si no se confirma la contraseña", async ({ page }) => {
    await prepararSesion(page);
    await abrirDialogo(page);

    await page.click("#confirm-delete");

    const campo = page.locator("#delete-password")
      .locator("xpath=ancestor::div[contains(@class,'form-field')]");
    await expect(campo).toHaveClass(/has-error/);

    // Sigue en la pantalla y con la sesión puesta
    await expect(page).toHaveURL(/configuracion\.html/);
    const sigueLaSesion = await page.evaluate(() => Boolean(localStorage.getItem("qr.sesion")));
    expect(sigueLaSesion).toBe(true);
  });

  test("con la contraseña equivocada lo dice y no cierra la sesión", async ({ page }) => {
    await simularApi(page, { contrasenaIncorrectaAlBorrar: true });
    await sembrarSesion(page);
    await abrirDialogo(page);

    await page.fill("#delete-password", "la-que-no-es");
    await page.click("#confirm-delete");

    await expect(page.locator("#delete-alert")).toContainText("no es correcta");
    await expect(page).toHaveURL(/configuracion\.html/);

    const sigueLaSesion = await page.evaluate(() => Boolean(localStorage.getItem("qr.sesion")));
    expect(sigueLaSesion).toBe(true);
  });

  test("al eliminarla borra la sesión y lo explica en el login", async ({ page }) => {
    await prepararSesion(page);
    await abrirDialogo(page);

    await page.fill("#delete-password", "Clave123*");
    await page.click("#confirm-delete");

    await expect(page).toHaveURL(/login\.html\?motivo=cuenta-eliminada/);
    await expect(page.locator("#form-alert")).toContainText("Su cuenta fue eliminada");

    const quedaAlgo = await page.evaluate(() =>
      Boolean(localStorage.getItem("qr.sesion") || sessionStorage.getItem("qr.sesion"))
    );
    expect(quedaAlgo).toBe(false);
  });
});

// La pantalla de inicio de sesión es la primera que ve cualquiera, incluido
// quien evalúa el proyecto. Traía tres cifras escritas a mano —«1,200+
// empresas activas», «4.8M escaneos este mes», «99.9% tiempo en línea»— que
// nada calculaba, y un testimonio firmado por una persona que no existe.
// Es la misma clase de invención que el aggregateRating que se quitó de la
// vista pública en v2.0.2, solo que sobre el producto en vez de sobre el
// negocio del usuario.
test.describe("La portada no afirma cosas inventadas [regresión]", () => {
  test("no hay cifras de adopción ni de disponibilidad", async ({ page }) => {
    await page.goto("/login.html");

    const texto = await page.locator("body").innerText();

    for (const invento of ["1,200+", "4.8M", "99.9%", "Empresas activas", "Escaneos este mes"]) {
      expect(texto).not.toContain(invento);
    }
  });

  test("no hay un testimonio de un cliente que no existe", async ({ page }) => {
    await page.goto("/login.html");

    const texto = await page.locator("body").innerText();

    expect(texto).not.toContain("Camila Restrepo");
    expect(texto).not.toContain("subieron un 35%");
  });

  test("en su lugar dice lo que el sistema sí hace", async ({ page }) => {
    await page.goto("/login.html");

    const panel = page.locator(".auth-stats");

    await expect(panel).toContainText("Un código, mil cambios");
    await expect(panel).toContainText("Mide lo que pasa");

    // Las tres son capacidades reales: QR dinámico (RF-07), edición del
    // contenido (RF-05 y RF-06) y estadísticas (RF-11)
    await expect(panel.locator(".auth-stat-row")).toHaveCount(3);
  });
});
