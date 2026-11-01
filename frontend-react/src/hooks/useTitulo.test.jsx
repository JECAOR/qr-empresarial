// ============================================
// USETITULO — el titulo de la pestana
//
// REGRESION. Bajo React hay un solo index.html, asi que las trece pantallas
// compartian su <title> y la pestana decia "QR Empresarial — perfil público"
// tambien en el login, en el panel y en la gestion de usuarios. El frontend
// original no tenia el problema: alli cada pantalla era un archivo.
// ============================================

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import useTitulo from "./useTitulo";

function Pantalla({ titulo }) {
  useTitulo(titulo);

  return <p>una pantalla</p>;
}

describe("useTitulo", () => {
  it("pone el nombre de la pantalla delante de la marca", () => {
    render(<Pantalla titulo="Contenido" />);

    expect(document.title).toBe("Contenido · QR Empresarial");
  });

  it("lo cambia si cambia la pantalla", () => {
    const { rerender } = render(<Pantalla titulo="Contenido" />);

    rerender(<Pantalla titulo="Código QR" />);

    expect(document.title).toBe("Código QR · QR Empresarial");
  });

  // La pantalla escaneada pasa el nombre del negocio en cuanto lo sabe, y
  // hasta entonces hay que dejar en pie el titulo que el servidor ya
  // escribio en el HTML para los robots que no ejecutan JavaScript.
  it("sin titulo no toca el que ya hubiera", () => {
    document.title = "Panadería La Espiga · QR Empresarial";

    render(<Pantalla titulo={undefined} />);

    expect(document.title).toBe("Panadería La Espiga · QR Empresarial");
  });

  it("una cadena vacia tampoco lo borra", () => {
    document.title = "Panadería La Espiga · QR Empresarial";

    render(<Pantalla titulo="" />);

    expect(document.title).toBe("Panadería La Espiga · QR Empresarial");
  });

  // El servidor arma el titulo de /p/:slug con este mismo separador -ver
  // publico.metadatos.js-, para que el titulo que lee un robot y el que
  // acaba poniendo el navegador no sean dos cosas distintas.
  it("usa el separador del servidor", () => {
    render(<Pantalla titulo="Panadería La Espiga" />);

    expect(document.title).toBe("Panadería La Espiga · QR Empresarial");
  });
});
