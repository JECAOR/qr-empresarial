// ============================================
// PREPARAR.JS — lo que se monta antes de cada prueba
//
// Vitest lo carga una vez por archivo de pruebas, antes que nada.
// ============================================

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";

import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

beforeEach(() => {
  // Cada prueba arranca sin sesion. Sin esto, el token que deja una prueba
  // viaja a la siguiente y aparecen fallos que dependen del orden.
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom no implementa estos tres y los componentes los usan de verdad. Se
// rellenan aqui, no en cada prueba, porque faltarian en cualquiera que monte
// el componente y el error -"not a function"- no dice de donde viene.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function abrir() {
    this.open = true;
  };

  HTMLDialogElement.prototype.close = function cerrar(valor) {
    this.open = false;
    if (valor !== undefined) this.returnValue = valor;
    this.dispatchEvent(new Event("close"));
  };
}

if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:prueba";
  URL.revokeObjectURL = () => {};
}

// jsdom no desplaza nada, asi que tampoco trae scrollIntoView. Configuracion
// lo usa para llevar el mensaje de error a la vista.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
