// ============================================
// TEMA — el color de marca del negocio (RF-12)
//
// Lo que se prueba no es que escriba un atributo, sino las tres decisiones
// que toma: que el color de defecto no ponga atributo, que un valor que no
// conoce no pueda escribir cualquier cosa en el <html>, y que recordar sea
// opcional, porque mirar el perfil de otro negocio no debe cambiar el color
// del propio.
//
// Que el atributo PINTE de verdad -que haya un bloque html[data-theme] en
// global.css con esos colores- no se puede ver aqui: Vitest corre con
// css: false. Lo comprueba pruebas-e2e/tema.spec.js en un navegador.
// ============================================

import { describe, expect, it } from "vitest";

import { aplicarTema, olvidarTema, TEMAS, temaGuardado } from "./tema";

const html = () => document.documentElement;

describe("la lista de temas", () => {
  // El validador del backend acepta estos tres; cualquier otro da 400.
  it("son los tres que acepta el servidor", () => {
    expect(TEMAS.map((t) => t.valor)).toEqual(["indigo", "teal", "terracota"]);
  });

  it("cada uno trae nombre y color para la muestra", () => {
    for (const tema of TEMAS) {
      expect(tema.nombre).toBeTruthy();
      expect(tema.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe("aplicarTema", () => {
  it("pone el tema en el <html>", () => {
    aplicarTema("teal");

    expect(html()).toHaveAttribute("data-theme", "teal");
  });

  // El de defecto son los colores del :root: un bloque data-theme="indigo"
  // tendria que repetirlos, y dos sitios con los mismos valores acaban
  // separandose.
  it("el de defecto no pone atributo", () => {
    aplicarTema("teal");
    aplicarTema("indigo");

    expect(html()).not.toHaveAttribute("data-theme");
  });

  // El tema llega de la API. Un valor raro -o manipulado- no deberia poder
  // escribir un atributo cualquiera en el <html>.
  it("un tema que no existe se queda en el de defecto", () => {
    expect(aplicarTema("fucsia")).toBe("indigo");
    expect(html()).not.toHaveAttribute("data-theme");
  });

  it("y tampoco lo guarda", () => {
    aplicarTema("fucsia");

    expect(localStorage.getItem("qre_tema")).toBe("indigo");
  });

  it("un perfil sin tema tampoco rompe nada", () => {
    expect(aplicarTema(undefined)).toBe("indigo");
    expect(aplicarTema(null)).toBe("indigo");
  });

  it("lo guarda para el proximo arranque", () => {
    aplicarTema("terracota");

    expect(localStorage.getItem("qre_tema")).toBe("terracota");
  });

  // Al mirar el perfil publico de OTRO negocio. Guardar su color pintaria el
  // panel propio con el la proxima vez que se abriera la aplicacion.
  it("con recordar en false aplica pero no guarda", () => {
    aplicarTema("teal", { recordar: false });

    expect(html()).toHaveAttribute("data-theme", "teal");
    expect(localStorage.getItem("qre_tema")).toBeNull();
  });
});

describe("temaGuardado", () => {
  it("sin nada guardado devuelve el de defecto", () => {
    expect(temaGuardado()).toBe("indigo");
  });

  it("devuelve lo ultimo que se aplico", () => {
    aplicarTema("terracota");

    expect(temaGuardado()).toBe("terracota");
  });

  // Lo guardado se puede editar a mano desde la consola del navegador.
  it("desconfia de lo que haya guardado", () => {
    localStorage.setItem("qre_tema", "<script>");

    expect(temaGuardado()).toBe("indigo");
  });

  // Se lee antes de pintar nada: una excepcion aqui dejaria la pantalla en
  // blanco. Pasa en un navegador con el almacenamiento bloqueado.
  it("si el navegador no deja leer, se queda con el de defecto", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("acceso denegado");
      }
    });

    expect(temaGuardado()).toBe("indigo");
    expect(() => aplicarTema("teal")).not.toThrow();

    Object.defineProperty(window, "localStorage", original);
  });
});

describe("olvidarTema", () => {
  // Se llama al cerrar sesion.
  it("quita el atributo y lo borra de lo guardado", () => {
    aplicarTema("teal");

    olvidarTema();

    expect(html()).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem("qre_tema")).toBeNull();
  });
});
