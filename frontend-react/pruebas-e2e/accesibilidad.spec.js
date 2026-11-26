// ============================================
// ACCESIBILIDAD.SPEC.JS — auditoria automatica con axe-core
//
// Es el equivalente de la auditoria que ya tenia el frontend original, y no
// se puede hacer en jsdom: casi la mitad de las reglas de axe miden contraste
// de color, tamaños y orden visual, y para eso hace falta un motor de
// maquetado. En jsdom esas reglas no se evaluan o devuelven «incompleto», con
// lo que la auditoria pasaria sin haber mirado lo que importa.
//
// Lo que esto comprueba es lo que una maquina puede comprobar: etiquetas,
// nombres accesibles, contraste, estructura. No sustituye a usar la pantalla
// con el teclado ni a un lector de pantalla.
// ============================================

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { prepararSesion, simularApi } from './ayudas.js';

const REGLAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Audita la pantalla que este cargada y devuelve las faltas. */
async function auditar(page) {
  const resultado = await new AxeBuilder({ page }).withTags(REGLAS).analyze();

  return resultado.violations.map((falta) => ({
    regla: falta.id,
    impacto: falta.impact,
    donde: falta.nodes.map((n) => n.target.join(' ')).slice(0, 3)
  }));
}

// Las pantallas con sesion de empresa. Cada una se audita ya cargada: una
// auditoria sobre el «Cargando…» no mira la pantalla.
const CON_SESION = [
  { ruta: '/', listo: (page) => page.getByLabel('Dirección pública del negocio') },
  { ruta: '/perfil', listo: (page) => page.getByRole('heading', { name: 'Perfil del negocio' }) },
  { ruta: '/contenido', listo: (page) => page.getByRole('heading', { name: 'Contenido del perfil' }) },
  { ruta: '/codigo-qr', listo: (page) => page.getByRole('heading', { name: 'Tu código QR' }) },
  { ruta: '/actividad', listo: (page) => page.getByRole('heading', { name: 'Actividad' }) },
  { ruta: '/configuracion', listo: (page) => page.getByRole('heading', { name: 'Tu cuenta' }) }
];

const DE_ADMINISTRADOR = [
  { ruta: '/usuarios', listo: (page) => page.getByRole('heading', { name: 'Gestión de usuarios' }) },
  { ruta: '/administracion', listo: (page) => page.getByRole('heading', { name: 'Administración' }) }
];

const SIN_SESION = [
  { ruta: '/login', listo: (page) => page.getByRole('heading', { name: 'Iniciar sesión' }) },
  { ruta: '/registro', listo: (page) => page.getByRole('heading', { name: 'Crear una cuenta' }) },
  { ruta: '/recuperar', listo: (page) => page.getByRole('heading', { name: /contraseña/i }) },
  { ruta: '/p/panaderia-la-espiga', listo: (page) => page.getByRole('heading', { name: 'Panadería La Espiga' }) },
  { ruta: '/p/panaderia-la-espiga/menu', listo: (page) => page.getByRole('heading', { level: 1, name: 'Panadería La Espiga' }) },
  { ruta: '/esto-no-existe', listo: (page) => page.getByRole('heading', { name: 'Esta página no existe' }) }
];

for (const { ruta, listo } of CON_SESION) {
  test(`${ruta} no tiene faltas de accesibilidad`, async ({ page }) => {
    await prepararSesion(page);
    await page.goto(ruta);
    await expect(listo(page)).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });
}

for (const { ruta, listo } of DE_ADMINISTRADOR) {
  test(`${ruta} no tiene faltas de accesibilidad`, async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto(ruta);
    await expect(listo(page)).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });
}

for (const { ruta, listo } of SIN_SESION) {
  test(`${ruta} no tiene faltas de accesibilidad`, async ({ page }) => {
    await simularApi(page);
    await page.goto(ruta);
    await expect(listo(page)).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });
}

// Los estados que no se ven al cargar y tambien hay que leer: un formulario
// abierto, un mensaje de error, un dialogo.
test.describe('estados que aparecen despues', () => {
  test('el formulario de un bloque nuevo', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/contenido');

    await page.getByRole('button', { name: 'Agregar bloque' }).click();
    await expect(page.getByLabel('Título')).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });

  test('un mensaje de error en el login', async ({ page }) => {
    await simularApi(page, { credencialesMalas: 'Correo o contraseña incorrectos' });
    await page.goto('/login');

    await page.getByLabel('Correo electrónico').fill('contacto@laespiga.co');
    await page.getByLabel('Contraseña').fill('mal');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });

  // Va en un <dialog> de verdad para que el navegador se encargue del foco y
  // de Escape. En jsdom hay que ponerle un showModal de pega, asi que lo que
  // haga el dialogo real solo se ve aqui.
  test('el detalle de una cuenta, en su dialogo', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/administracion');

    await page.getByRole('button', { name: 'Ver' }).first().click();

    await expect(page.locator('dialog')).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });

  test('y Escape lo cierra', async ({ page }) => {
    await prepararSesion(page, { comoAdministrador: true });
    await page.goto('/administracion');

    await page.getByRole('button', { name: 'Ver' }).first().click();
    await expect(page.locator('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('dialog')).toBeHidden();
  });
});

// Recorrer la pantalla con el tabulador: el orden tiene que seguir lo que se
// ve, y el foco tiene que verse. jsdom tiene foco, pero no sabe donde esta
// cada cosa ni si el contorno se dibuja.
test.describe('el teclado', () => {
  test('el tabulador recorre el formulario de login en orden', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Correo electrónico')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Contraseña')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeFocused();
  });

  test('lo que tiene el foco se distingue', async ({ page }) => {
    await simularApi(page);
    await page.goto('/login');

    const campo = page.getByLabel('Correo electrónico');

    await campo.focus();

    const contorno = await campo.evaluate((el) => {
      const estilo = getComputedStyle(el);

      return {
        outline: estilo.outlineStyle,
        ancho: estilo.outlineWidth,
        sombra: estilo.boxShadow,
        borde: estilo.borderColor
      };
    });

    // Vale cualquiera de las tres formas de marcarlo; lo que no vale es
    // ninguna, que es lo que pasa cuando alguien pone outline: none.
    const seDistingue = (contorno.outline !== 'none' && contorno.ancho !== '0px')
      || contorno.sombra !== 'none';

    expect(seDistingue).toBe(true);
  });
});

// --- Los otros dos colores de marca (RF-12) ---
//
// Las auditorias de arriba corren con el tema de defecto, que es el unico
// que habia cuando se midio el contraste de la barra. Desde que el color de
// marca del negocio pinta esa barra hay tres fondos distintos, y lo que pasa
// el contraste sobre uno no lo pasa sobre los tres: la etiqueta del rol
// estaba al 85% de opacidad y daba 5,00:1 sobre el indigo, 4,09:1 sobre el
// esmeralda y 4,15:1 sobre el terracota, con el minimo en 4,5:1.
//
// Se audita en las dos pantallas que mas color llevan: la barra con la
// sesion y la pagina que ve quien escanea el codigo.
for (const tema of ['teal', 'terracota']) {
  test(`el panel con el tema ${tema} no tiene faltas de accesibilidad`, async ({ page }) => {
    await prepararSesion(page, { tema });
    await page.goto('/contenido');
    await expect(page.getByRole('heading', { name: 'Contenido del perfil' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', tema);

    expect(await auditar(page)).toEqual([]);
  });

  test(`la pagina publica con el tema ${tema} tampoco`, async ({ page }) => {
    await simularApi(page, { tema });
    await page.goto('/p/panaderia-la-espiga');
    await expect(page.getByRole('heading', { name: 'Panadería La Espiga' })).toBeVisible();

    expect(await auditar(page)).toEqual([]);
  });
}

// ============================================
// El zoom y el texto grande
//
// La decima vara de medir, y la que axe NO puede aplicar: ninguna de sus
// reglas mide reflujo ni escalado de texto. Son tres criterios de la WCAG
// que hasta ahora nadie habia comprobado, y se comprueban igual: forzando la
// condicion y mirando si la pagina se puede arrastrar de lado.
//
//   - 1.4.10 Reflujo. A 320 px de ancho no debe haber desplazamiento
//     horizontal. 320 px NO es un telefono pequeño: es el ancho equivalente
//     a un zoom del 400 % en una pantalla de 1280, que es como navega quien
//     necesita el texto grande. movil.spec.js prueba 375, que es mas ancho.
//   - 1.4.4 Redimensionar texto. El texto tiene que poder llegar al 200 %
//     sin perder contenido. Se sube la raiz de 16 a 32 px, que es lo que
//     hace el ajuste de «tamaño de letra» del navegador.
//   - 1.4.12 Espaciado del texto. Con interlineado 1,5, separacion entre
//     letras 0,12em y entre palabras 0,16em no se puede perder nada.
//
// Volvio casi limpia: lo unico que encontro fueron 3 px en la pantalla del
// codigo, y aun asi valio la pena, porque eran 3 px que nadie habria visto
// nunca y que incumplian el criterio.
// ============================================

const TODAS = [
  '/', '/perfil', '/contenido', '/codigo-qr', '/actividad', '/configuracion',
  '/p/panaderia-la-espiga', '/p/panaderia-la-espiga/menu', '/login', '/registro'
];

/** Una direccion pegada, lo unico que de verdad no se puede partir. */
const URL_PEGADA = 'https://www.google.com/maps/place/Panader%C3%ADa+La+Espiga/@4.6486259,'
  + '-74.0629936,17z/data=!3m1!4b1!4m6!3m5!1s0x8e3f9a5e5f5e5f5e:0x1234567890abcdef'
  + '!8m2!3d4.6486259!4d-74.0604187';

const CON_DATOS_LARGOS = {
  perfil: {
    nombreNegocio: 'Panadería y Repostería Artesanal La Espiga de Oro de Chapinero Alto S.A.S.',
    descripcion: 'Pan de masa madre horneado cada mañana en Chapinero. '.repeat(30),
    direccion: 'Carrera 7 # 53 - 22, Local 3, Edificio Torres del Parque, Chapinero Alto, Bogotá',
    correoContacto: 'contacto.panaderia.la.espiga.de.oro.chapinero@miempresa.com.co',
    instagram: '@panaderialaespigadeorochapinero'
  },
  contenido: [{
    id: 'elemento-1',
    tipo: 'texto',
    titulo: 'Cómo llegar',
    detalle: 'Estamos a media cuadra del parque. ' + URL_PEGADA,
    seccion: 'menu',
    categoria: 'Texto',
    icono: 'texto',
    activo: true,
    orden: 1,
    clics: 0
  }]
};

/** Si la pagina se puede arrastrar de lado. Es el sintoma de los tres. */
async function seArrastraDeLado(page) {
  return page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: document.documentElement.clientWidth
  }));
}

test.describe('1.4.10 reflujo: a 320 px no se arrastra de lado', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const ruta of TODAS) {
    test(ruta, async ({ page }) => {
      await prepararSesion(page);
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');

      const d = await seArrastraDeLado(page);

      expect(d.documento).toBeLessThanOrEqual(d.ventana);
    });
  }

  // Y con lo que escribe un negocio, no con los datos de muestra
  test('ni con una direccion pegada y un nombre largo', async ({ page }) => {
    await prepararSesion(page, CON_DATOS_LARGOS);

    for (const ruta of ['/', '/p/panaderia-la-espiga', '/p/panaderia-la-espiga/menu']) {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');

      const d = await seArrastraDeLado(page);

      expect(d.documento, `se arrastra en ${ruta}`).toBeLessThanOrEqual(d.ventana);
    }
  });

  // REGRESION. La vista previa medía 240 px fijos y, con los 18 px de
  // relleno del marco a cada lado, pedia 278 donde la rejilla le daba 238:
  // tres pixeles de desplazamiento horizontal, invisibles y suficientes para
  // incumplir el criterio. El arreglo fue dejarla encogerse.
  //
  // El desbordamiento en si lo comprueba la prueba de /codigo-qr de arriba.
  // Aqui se cuida lo OTRO, que es lo que el arreglo puede estropear: un
  // max-width sin height: auto encoge el ancho y deja la altura quieta, y
  // entonces el codigo sale rectangular. Un codigo QR deformado no lo lee
  // ningun telefono.
  test('la vista previa se encoge sin deformar el codigo', async ({ page }) => {
    await prepararSesion(page);
    await page.goto('/codigo-qr');
    await page.waitForLoadState('networkidle');

    const imagen = page.getByAltText('Vista previa del código QR');

    await expect(imagen).toBeVisible();

    const forma = await imagen.evaluate((el) => {
      const r = el.getBoundingClientRect();

      return { ancho: Math.round(r.width), alto: Math.round(r.height) };
    });

    expect(forma.ancho).toBe(forma.alto);
  });
});

test.describe('1.4.4 el texto al 200 %', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const ruta of TODAS) {
    test(ruta, async ({ page }) => {
      await prepararSesion(page);
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');

      await page.addStyleTag({ content: 'html { font-size: 32px !important; }' });

      const d = await seArrastraDeLado(page);

      expect(d.documento).toBeLessThanOrEqual(d.ventana);
    });
  }
});

test.describe('1.4.12 el espaciado del texto', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const ruta of TODAS) {
    test(ruta, async ({ page }) => {
      await prepararSesion(page);
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');

      await page.addStyleTag({
        content: `* {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p { margin-bottom: 2em !important; }`
      });

      const d = await seArrastraDeLado(page);

      expect(d.documento).toBeLessThanOrEqual(d.ventana);
    });
  }
});
