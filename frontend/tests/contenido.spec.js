// ============================================
// tests/contenido.spec.js
// ============================================
const { test, expect } = require("@playwright/test");
const { prepararSesion, simularApi } = require("./ayudas");

// El frontend ahora pide los datos a la API: se simula la respuesta y se deja
// una sesión guardada, para que estas pruebas sigan sin necesitar el backend
// encendido (ver ayudas.js). Va fuera de los describe para que valga en todos.
test.beforeEach(async ({ page }) => {
  await prepararSesion(page);
});


test.describe("Gestión de Contenido", () => {
  test("las pestañas filtran datos reales y distintos", async ({ page }) => {
    await page.goto("/contenido.html");
    const menuPrincipal = await page.locator(".item-card").count();
    expect(menuPrincipal).toBeGreaterThan(0);

    await page.click('.content-tab[data-tab="promos"]');
    await expect(page.locator("text=Menú del día")).toBeVisible();

    await page.click('.content-tab[data-tab="reservas"]');
    await expect(page.locator("text=Reservar mesa hoy")).toBeVisible();
    await expect(page.locator("text=Menú del día")).not.toBeVisible();
  });

  test("agregar, editar y eliminar un elemento", async ({ page }) => {
    await page.goto("/contenido.html");
    const antes = await page.locator(".item-card").count();

    // Agregar
    await page.click("#btn-open-add");
    await page.fill("#etiqueta", "Elemento de prueba");
    await page.fill("#subtitulo", "Subtítulo de prueba");
    await page.click('#add-item-form button[type="submit"]');
    await expect(page.locator(".item-card")).toHaveCount(antes + 1);
    await expect(page.locator("text=Elemento de prueba")).toBeVisible();

    // Eliminar el que se acaba de agregar
    const nuevaTarjeta = page.locator(".item-card", { hasText: "Elemento de prueba" });
    await nuevaTarjeta.locator('[data-action="delete"]').click();
    await expect(page.locator(".item-card")).toHaveCount(antes);
  });

  test("activar/desactivar cambia el estado visual", async ({ page }) => {
    await page.goto("/contenido.html");
    const primeraTarjeta = page.locator(".item-card").first();
    const toggle = primeraTarjeta.locator('[data-action="toggle"]');

    const estabaActiva = !(await primeraTarjeta.evaluate((el) => el.classList.contains("is-inactive")));

    await toggle.click();

    // Se usa expect, que reintenta, en lugar de leer la clase justo después
    // del clic: el cambio ya no es inmediato, viaja al servidor y vuelve. Con
    // una lectura directa la prueba pasaba solo porque la API simulada
    // responde rápido, y fallaba de vez en cuando.
    if (estabaActiva) {
      await expect(primeraTarjeta).toHaveClass(/is-inactive/);
    } else {
      await expect(primeraTarjeta).not.toHaveClass(/is-inactive/);
    }
  });

  test("vaciar completamente una pestaña muestra el mensaje de estado vacío", async ({ page }) => {
    await page.goto("/contenido.html");
    await page.click('.content-tab[data-tab="promos"]');
    const cards = page.locator(".item-card");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await page.locator(".item-card").first().locator('[data-action="delete"]').click();
    }
    await expect(page.locator("text=Aún no hay elementos en esta sección.")).toBeVisible();
  });

  // --- Prueba de regresión de seguridad ---
  // Antes de una corrección real, escribir HTML en estos campos se ejecutaba
  // como código en vez de mostrarse como texto (XSS). Esta prueba falla si
  // alguien vuelve a quitar el escape sin darse cuenta.
  test("[seguridad] el nombre y subtítulo de un elemento no ejecutan HTML/JS", async ({ page }) => {
    const dialogs = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      d.accept();
    });

    await page.goto("/contenido.html");
    await page.click("#btn-open-add");
    await page.fill("#etiqueta", '"><img src=x onerror=alert(1)>');
    await page.fill("#subtitulo", "<script>alert(2)</script>");
    await page.click('#add-item-form button[type="submit"]');
    await page.waitForTimeout(300);

    expect(dialogs).toHaveLength(0);
    const html = await page.locator("#item-list").innerHTML();
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain("<script>alert(2)</script>");
  });
});

// El contenido ya no vive en el navegador: lo guarda el servidor (RF-05 y
// RF-06). Estas pruebas comprobaban localStorage; ahora comprueban lo que
// importa igual de bien y con el mismo rigor: que el cambio sobreviva a
// recargar la página, porque quedó del otro lado de la API. El simulador
// recuerda lo que se le manda, como haría el servidor (ver ayudas.js).
test.describe("Persistencia en el servidor", () => {
  test("crear un elemento lo manda al servidor y sobrevive a recargar la página", async ({ page }) => {
    await page.goto("/contenido.html");
    await page.click("#btn-open-add");
    await page.fill("#etiqueta", "Elemento persistente");
    await page.fill("#subtitulo", "https://ejemplo.co/persistente");
    await page.click('#add-item-form button[type="submit"]');

    await expect(page.locator("text=Elemento persistente")).toBeVisible();

    // Nada de esto se guarda en el navegador
    const enElNavegador = await page.evaluate(() => localStorage.getItem("qre-content-items"));
    expect(enElNavegador).toBeNull();

    // Y sigue ahí tras una recarga real, porque quedó del otro lado de la API
    await page.reload();
    await expect(page.locator("text=Elemento persistente")).toBeVisible();
  });

  test("editar un elemento persiste el cambio tras recargar", async ({ page }) => {
    await page.goto("/contenido.html");
    const original = page.locator(".item-card").first();
    await original.locator('[data-action="edit"]').click();
    await page.fill("#etiqueta", "Nombre editado y persistido");
    await page.click('#add-item-form button[type="submit"]');

    await page.reload();
    await expect(page.locator("text=Nombre editado y persistido")).toBeVisible();
  });

  test("eliminar un elemento lo quita de forma permanente", async ({ page }) => {
    await page.goto("/contenido.html");
    const primerNombre = await page.locator(".item-card").first().locator(".item-label").textContent();
    await page.locator(".item-card").first().locator('[data-action="delete"]').click();

    await page.reload();
    await expect(page.locator(".item-card", { hasText: primerNombre })).toHaveCount(0);
  });

  test("activar/desactivar un elemento persiste tras recargar", async ({ page }) => {
    await page.goto("/contenido.html");
    const primera = page.locator(".item-card").first();
    const estabaInactiva = await primera.evaluate((el) => el.classList.contains("is-inactive"));

    await primera.locator('[data-action="toggle"]').click();
    await page.reload();

    const inactivaAhora = await page.locator(".item-card").first().evaluate((el) => el.classList.contains("is-inactive"));
    expect(inactivaAhora).toBe(!estabaInactiva);
  });
});

// El asa de seis puntos de cada tarjeta estuvo ahí desde el diseño, pero era
// decorativa. Ahora reordena de verdad contra PUT /api/contenido/orden.
//
// Se prueban las dos formas porque se ofrecen las dos a propósito: arrastrar
// es cómodo con el ratón e imposible con el teclado.
test.describe("Reordenar los bloques", () => {
  const etiquetas = (page) => page.locator(".item-card .item-label").allTextContents();

  test("el asa es un botón enfocable y dice cómo usarse", async ({ page }) => {
    await page.goto("/contenido.html");

    const asa = page.locator('.item-card [data-action="mover"]').first();

    await expect(asa).toHaveAttribute("aria-label", /flechas arriba y abajo/);

    await asa.focus();
    await expect(asa).toBeFocused();
  });

  test("la flecha arriba sube el bloque y el cambio persiste", async ({ page }) => {
    await page.goto("/contenido.html");

    const antes = await etiquetas(page);

    // Se mueve el segundo hacia arriba: debe quedar primero
    await page.locator('.item-card [data-action="mover"]').nth(1).focus();
    await page.keyboard.press("ArrowUp");

    await expect(page.locator(".item-card .item-label").first()).toHaveText(antes[1]);

    // Y sigue así tras recargar, porque quedó guardado en el servidor
    await page.reload();
    await expect(page.locator(".item-card .item-label").first()).toHaveText(antes[1]);
  });

  test("la flecha abajo baja el bloque", async ({ page }) => {
    await page.goto("/contenido.html");

    const antes = await etiquetas(page);

    await page.locator('.item-card [data-action="mover"]').first().focus();
    await page.keyboard.press("ArrowDown");

    await expect(page.locator(".item-card .item-label").nth(1)).toHaveText(antes[0]);
  });

  test("el foco se queda en el asa para poder mover varias veces", async ({ page }) => {
    await page.goto("/contenido.html");

    const antes = await etiquetas(page);

    const asa = page.locator('.item-card [data-action="mover"]').nth(2);
    await asa.focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");

    // Dos flechas seguidas sin volver a enfocar: el tercero quedó primero
    await expect(page.locator(".item-card .item-label").first()).toHaveText(antes[2]);
  });

  test("el primer bloque no sube más allá del principio", async ({ page }) => {
    await page.goto("/contenido.html");

    const antes = await etiquetas(page);

    await page.locator('.item-card [data-action="mover"]').first().focus();
    await page.keyboard.press("ArrowUp");

    expect(await etiquetas(page)).toEqual(antes);
  });

  test("arrastrar un bloque cambia el orden y lo guarda", async ({ page }) => {
    await page.goto("/contenido.html");

    const antes = await etiquetas(page);

    const tercera = page.locator(".item-card").nth(2);
    const primera = page.locator(".item-card").first();

    await tercera.dragTo(primera, { targetPosition: { x: 10, y: 2 } });

    await expect(page.locator(".item-card .item-label").first()).toHaveText(antes[2]);

    await page.reload();
    await expect(page.locator(".item-card .item-label").first()).toHaveText(antes[2]);
  });

  test("si el servidor rechaza el orden, se avisa y se recupera el real", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, { errorAlOrdenar: "No se pudo guardar el orden" });

    await page.goto("/contenido.html");

    const antes = await etiquetas(page);

    await page.locator('.item-card [data-action="mover"]').nth(1).focus();
    await page.keyboard.press("ArrowUp");

    await expect(page.locator(".form-alert")).toContainText("No se pudo guardar el orden");

    // La lista vuelve a lo que dice el servidor, para no mostrar un orden
    // que en realidad no se guardó
    await expect
      .poll(async () => (await etiquetas(page)).join("|"))
      .toBe(antes.join("|"));
  });
});

// Regla de negocio del módulo 3, que figuraba en el README como «prevista» y
// no estaba en el código. El módulo 4 no genera un código QR para un perfil
// vacío, porque quien lo escanee no encontraría nada; sin esta comprobación,
// esa garantía duraba lo que tardara el dueño en quitar su último bloque, y
// el código ya impreso y pegado en la vitrina seguía llevando a un perfil en
// blanco. Se vigilaba la puerta de entrada y no la de salida.
test.describe("No se puede dejar el perfil vacío si ya tiene código QR", () => {
  /**
   * Deja un único bloque activo en todo el perfil y devuelve su título.
   *
   * Se vacía por la API y no pulsando las papeleras de la pantalla porque la
   * lista muestra solo la pestaña abierta: borrando lo visible quedarían los
   * bloques de «Promociones» y «Reservas», y la regla no llegaría a saltar.
   */
  async function dejarUnSoloBloque(page) {
    await page.goto("/contenido.html");

    const titulo = await page.evaluate(async () => {
      const { data } = await Api.listarContenido();
      const conservar = data.find((i) => i.seccion === "menu" && i.activo);

      for (const item of data) {
        if (item.id !== conservar.id) await Api.eliminarContenido(item.id);
      }

      return conservar.titulo;
    });

    await page.reload();
    await expect(page.locator(".item-card")).toHaveCount(1);

    return titulo;
  }

  test("no deja borrar el último bloque activo", async ({ page }) => {
    const titulo = await dejarUnSoloBloque(page);

    await page.locator('.item-card [data-action="delete"]').click();

    await expect(page.locator("#content-alert")).toContainText("último bloque activo");

    // Y sigue ahí: el aviso no serviría de nada si el bloque se hubiera ido
    await expect(page.locator(".item-card")).toHaveCount(1);
    await expect(page.locator(".item-card .item-label")).toHaveText(titulo);
  });

  test("tampoco deja desactivarlo, que deja el perfil igual de vacío", async ({ page }) => {
    await dejarUnSoloBloque(page);

    // Comprobar solo el borrado se esquivaría por aquí
    await page.locator('.item-card [data-action="toggle"]').click();

    await expect(page.locator("#content-alert")).toContainText("último bloque activo");

    // Se comprueba contra el servidor, no contra la pantalla
    await expect
      .poll(async () => page.evaluate(async () =>
        (await Api.listarContenido()).data.filter((i) => i.activo).length
      ))
      .toBe(1);
  });

  test("con otro bloque activo, se puede quitar sin problema", async ({ page }) => {
    await dejarUnSoloBloque(page);

    await page.evaluate(() => Api.crearContenido({
      tipo: "texto", titulo: "Un segundo bloque", detalle: "Hola",
      idCategoria: 1, seccion: "menu"
    }));
    await page.reload();
    await expect(page.locator(".item-card")).toHaveCount(2);

    await page.locator('.item-card [data-action="delete"]').first().click();

    await expect(page.locator(".item-card")).toHaveCount(1);
    await expect(page.locator("#content-alert")).toBeHidden();
  });

  // La regla protege un código ya emitido. Mientras el perfil se está
  // armando no hay nada que proteger, y bloquearlo atraparía a quien se
  // equivocó al escribir su primer enlace y quiere corregirlo.
  test("sin código QR todavía, el perfil sí puede quedarse vacío", async ({ page }) => {
    await page.unroute("**/api/**");
    await simularApi(page, { sinQr: true });

    await dejarUnSoloBloque(page);

    await page.locator('.item-card [data-action="delete"]').click();

    await expect(page.locator(".item-card")).toHaveCount(0);
    await expect(page.locator("#content-alert")).toBeHidden();
  });
});
