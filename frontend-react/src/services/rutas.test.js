// ============================================
// LAS RUTAS DE LOS SERVICIOS
//
// Cada funcion de servicio es una linea, pero la linea dice que ruta, que
// metodo y que cuerpo. Ahi es donde el ejemplo de las guias se separa de esta
// API -/users/:id/status contra /usuarios/:id/estado, 1 contra "activo"- y
// donde una equivocacion no se ve hasta que el servidor responde 404.
// ============================================

import { describe, expect, it } from "vitest";

import * as usuarios from "./usuarioService";
import * as contenido from "./contenidoService";
import * as perfil from "./perfilService";
import * as estadisticas from "./estadisticaService";
import * as qr from "./qrService";
import * as admin from "./adminService";
import { respuesta, simularFetch } from "../pruebas/ayudas";

/**
 * Llama a la funcion y devuelve la ruta, el metodo y el cuerpo con los que
 * habria llamado al servidor.
 */
async function llamar(fn, ...argumentos) {
  const espia = simularFetch([
    respuesta({ data: {} }, { headers: { "content-disposition": 'filename="x.csv"' } })
  ]);

  await fn(...argumentos);

  const [url, opciones = {}] = espia.mock.calls[0];

  return {
    ruta: url.replace("http://api.de.pruebas.invalido/api", ""),
    metodo: opciones.method ?? "GET",
    cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined
  };
}

describe("usuarioService", () => {
  it("lista en GET /usuarios", async () => {
    expect(await llamar(usuarios.listarUsuarios)).toMatchObject({
      ruta: "/usuarios", metodo: "GET"
    });
  });

  it("consulta uno en GET /usuarios/:id", async () => {
    expect(await llamar(usuarios.consultarUsuario, 7)).toMatchObject({ ruta: "/usuarios/7" });
  });

  it("crea con POST", async () => {
    expect(await llamar(usuarios.crearUsuario, { nombre: "Ana" })).toMatchObject({
      ruta: "/usuarios", metodo: "POST", cuerpo: { nombre: "Ana" }
    });
  });

  it("edita con PUT", async () => {
    expect(await llamar(usuarios.actualizarUsuario, 7, { nombre: "Ana" })).toMatchObject({
      ruta: "/usuarios/7", metodo: "PUT"
    });
  });

  // El ejemplo de la guia usa /users/:id/status y manda 1 o 0. Con eso, esta
  // API responde 404 y, si respondiera, la pantalla diria siempre "Inactivo".
  it("cambia el estado en PATCH /usuarios/:id/estado, con la palabra", async () => {
    expect(await llamar(usuarios.cambiarEstadoUsuario, 7, "restringido")).toEqual({
      ruta: "/usuarios/7/estado",
      metodo: "PATCH",
      cuerpo: { estado: "restringido" }
    });
  });

  it("elimina con DELETE", async () => {
    expect(await llamar(usuarios.eliminarUsuario, 7)).toMatchObject({
      ruta: "/usuarios/7", metodo: "DELETE"
    });
  });
});

describe("contenidoService", () => {
  it("lista los bloques, encendidos y apagados", async () => {
    expect(await llamar(contenido.listarContenido)).toMatchObject({ ruta: "/contenido" });
  });

  it("lista las categorias", async () => {
    expect(await llamar(contenido.listarCategorias))
      .toMatchObject({ ruta: "/contenido/categorias" });
  });

  it("crea un bloque con POST", async () => {
    expect(await llamar(contenido.crearContenido, { titulo: "Escríbenos", tipo: "enlace" }))
      .toMatchObject({ ruta: "/contenido", metodo: "POST" });
  });

  // El identificador es compuesto -"enlace-12"- porque los bloques viven en
  // dos tablas y el numero solo no los distingue.
  it("edita por el identificador compuesto", async () => {
    expect(await llamar(contenido.actualizarContenido, "enlace-12", { titulo: "X" }))
      .toMatchObject({ ruta: "/contenido/enlace-12", metodo: "PUT" });
  });

  it("enciende y apaga en PATCH /:id/estado", async () => {
    expect(await llamar(contenido.cambiarEstadoContenido, "elemento-3", false)).toEqual({
      ruta: "/contenido/elemento-3/estado",
      metodo: "PATCH",
      cuerpo: { activo: false }
    });
  });

  // Se manda la seccion entera y no "sube este uno": el servidor comprueba que
  // todos los identificadores sean de esta cuenta antes de tocar nada.
  it("reordena mandando la lista completa de identificadores", async () => {
    expect(await llamar(contenido.reordenarContenido, ["enlace-1", "enlace-4"])).toEqual({
      ruta: "/contenido/orden",
      metodo: "PUT",
      cuerpo: { ids: ["enlace-1", "enlace-4"] }
    });
  });
});

describe("perfilService", () => {
  // Ninguna lleva identificador: el perfil sale del token y no hay forma de
  // pedir el de otro.
  it("todas las rutas son sobre /me", async () => {
    expect((await llamar(perfil.consultarMiPerfil)).ruta).toBe("/perfiles/me");
    expect((await llamar(perfil.guardarMiPerfil, {})).ruta).toBe("/perfiles/me");
    expect((await llamar(perfil.guardarMiTema, "indigo")).ruta).toBe("/perfiles/me/tema");
  });

  // Es un PUT: lo que no se envie se borra, y por eso la pantalla manda
  // siempre todos los campos, tambien los vacios.
  it("guarda el perfil entero con PUT", async () => {
    expect(await llamar(perfil.guardarMiPerfil, { nombreNegocio: "X", telefono: "" }))
      .toMatchObject({ metodo: "PUT", cuerpo: { nombreNegocio: "X", telefono: "" } });
  });

  // Ruta propia para que elegir un color no obligue a reenviar el perfil y
  // arriesgarse a pisar algo.
  it("el tema va por su cuenta, con PATCH", async () => {
    expect(await llamar(perfil.guardarMiTema, "esmeralda")).toEqual({
      ruta: "/perfiles/me/tema", metodo: "PATCH", cuerpo: { tema: "esmeralda" }
    });
  });
});

describe("estadisticaService", () => {
  it("pide siete dias si no se dice otra cosa", async () => {
    expect((await llamar(estadisticas.consultarMisEstadisticas)).ruta)
      .toBe("/estadisticas?dias=7");
  });

  it("pasa el rango pedido", async () => {
    expect((await llamar(estadisticas.consultarMisEstadisticas, 90)).ruta)
      .toBe("/estadisticas?dias=90");
  });

  // Cualquier otro valor lo ignora el servidor y devuelve 7, de modo que una
  // pantalla que ofreciera 14 enseñaria 7 dias diciendo que son 14.
  it("solo ofrece los tres rangos que acepta el servidor", () => {
    expect(estadisticas.RANGOS).toEqual([7, 30, 90]);
  });
});

describe("qrService", () => {
  it("consulta, genera y publica por las rutas de /qr", async () => {
    expect(await llamar(qr.consultarMiQr)).toMatchObject({ ruta: "/qr", metodo: "GET" });
    expect(await llamar(qr.generarMiQr)).toMatchObject({ ruta: "/qr", metodo: "POST" });
    expect(await llamar(qr.cambiarEstadoQr, true)).toEqual({
      ruta: "/qr/estado", metodo: "PATCH", cuerpo: { activo: true }
    });
  });

  it("compone los parametros de la imagen y quita la almohadilla del color", async () => {
    const { ruta } = await llamar(qr.descargarImagen, {
      formato: "png", tamano: 512, color: "#4F46E5"
    });

    const parametros = new URLSearchParams(ruta.split("?")[1]);

    expect(ruta).toMatch(/^\/qr\/imagen\?/);
    expect(parametros.get("formato")).toBe("png");
    expect(parametros.get("tamano")).toBe("512");
    expect(parametros.get("color")).toBe("4F46E5");
  });
});

describe("adminService", () => {
  it("consulta el resumen", async () => {
    expect((await llamar(admin.consultarResumen)).ruta).toBe("/admin/resumen");
  });

  it("consulta una cuenta con sus eventos", async () => {
    expect((await llamar(admin.consultarUsuario, 7)).ruta).toBe("/admin/usuarios/7");
  });

  it("pasa los filtros como parametros", async () => {
    const { ruta } = await llamar(admin.listarUsuarios, {
      busqueda: "espiga", rol: "empresa", pagina: 2
    });

    const parametros = new URLSearchParams(ruta.split("?")[1]);

    expect(parametros.get("busqueda")).toBe("espiga");
    expect(parametros.get("rol")).toBe("empresa");
    expect(parametros.get("pagina")).toBe("2");
  });

  // Un filtro vacio como parametro no es lo mismo que no filtrar: el servidor
  // recibiria estado="" y la pantalla pediria algo que no quiso pedir.
  it("quita los filtros vacios, nulos y sin definir", async () => {
    const { ruta } = await llamar(admin.listarUsuarios, {
      busqueda: "", rol: null, estado: undefined, orden: "nombre"
    });

    expect(ruta).toBe("/admin/usuarios?orden=nombre");
  });

  // Un cero si es un filtro: no es lo mismo que no filtrar.
  it("conserva un cero", async () => {
    const { ruta } = await llamar(admin.listarUsuarios, { pagina: 0 });

    expect(ruta).toBe("/admin/usuarios?pagina=0");
  });

  // Lo que se descarga es lo que se esta viendo, no la tabla entera.
  it("el reporte respeta los filtros de la pantalla", async () => {
    const { ruta } = await llamar(admin.descargarReporte, { rol: "empresa", busqueda: "" });

    expect(ruta).toBe("/admin/reportes/usuarios?rol=empresa");
  });

  it("ofrece solo los estados y roles que acepta el validador", () => {
    expect(admin.ESTADOS).toEqual(["activo", "restringido"]);
    expect(admin.ROLES).toEqual(["empresa", "administrador"]);
    expect(admin.ORDENES.map((o) => o.valor))
      .toEqual(["registro", "nombre", "acceso", "actividad"]);
  });
});
