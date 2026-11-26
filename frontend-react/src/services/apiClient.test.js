// ============================================
// APICLIENT — la unica puerta de salida hacia la API
//
// Es la pieza que mas vale probar: todo lo demas pasa por aqui, y si se
// equivoca con el token o con un error del servidor, se equivocan las trece
// pantallas a la vez.
// ============================================

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  peticion, descargar, origenDelBackend, alTerminarLaSesion, CLAVE_TOKEN, CLAVE_USUARIO
} from "./apiClient";
import { respuesta, simularFetch } from "../pruebas/ayudas";

const API = "http://api.de.pruebas.invalido/api";

describe("peticion()", () => {
  it("compone la direccion con la base de VITE_API_URL", async () => {
    const espia = simularFetch([respuesta({ data: [] })]);

    await peticion("/usuarios");

    expect(espia).toHaveBeenCalledWith(`${API}/usuarios`, expect.anything());
  });

  it("manda Content-Type en todas las peticiones", async () => {
    const espia = simularFetch([respuesta({})]);

    await peticion("/qr", { method: "POST" });

    const [, opciones] = espia.mock.calls[0];

    expect(opciones.headers["Content-Type"]).toBe("application/json");
    expect(opciones.method).toBe("POST");
  });

  it("no manda Authorization cuando no hay sesion", async () => {
    const espia = simularFetch([respuesta({ data: {} })]);

    await peticion("/publico/mi-negocio");

    expect(espia.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  it("manda el token de sessionStorage cuando lo hay", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "abc.def.ghi");

    const espia = simularFetch([respuesta({ data: {} })]);

    await peticion("/usuarios/me");

    expect(espia.mock.calls[0][1].headers.Authorization).toBe("Bearer abc.def.ghi");
  });

  it("deja que quien llama pise una cabecera", async () => {
    const espia = simularFetch([respuesta({})]);

    await peticion("/algo", { headers: { "Content-Type": "text/plain" } });

    expect(espia.mock.calls[0][1].headers["Content-Type"]).toBe("text/plain");
  });

  it("devuelve el cuerpo ya convertido", async () => {
    simularFetch([respuesta({ data: { idUsuario: 7 } })]);

    await expect(peticion("/usuarios/7")).resolves.toEqual({ data: { idUsuario: 7 } });
  });

  it("devuelve null en un 204, sin intentar leer el cuerpo", async () => {
    const sinCuerpo = respuesta(undefined, { status: 204 });

    vi.spyOn(sinCuerpo, "json");
    simularFetch([sinCuerpo]);

    await expect(peticion("/usuarios/7", { method: "DELETE" })).resolves.toBeNull();
    expect(sinCuerpo.json).not.toHaveBeenCalled();
  });

  describe("cuando el servidor responde con error", () => {
    it("lanza con el mensaje que mando el servidor", async () => {
      simularFetch([respuesta({ message: "Credenciales incorrectas" }, { status: 401 })]);

      await expect(peticion("/auth/login", { method: "POST" }))
        .rejects.toThrow("Credenciales incorrectas");
    });

    it("pone el codigo HTTP en el error, que es lo que mira cada pantalla", async () => {
      simularFetch([respuesta({ message: "No encontrado" }, { status: 404 })]);

      // 404 en /qr no es un fallo: es un perfil que aun no genero su codigo,
      // y la pantalla lo distingue por este numero.
      await expect(peticion("/qr")).rejects.toMatchObject({ status: 404 });
    });

    it("inventa un mensaje si el cuerpo no es JSON", async () => {
      simularFetch([respuesta(undefined, { status: 502 })]);

      await expect(peticion("/usuarios")).rejects.toThrow("Error HTTP 502");
    });

    // El ejemplo de las guias decide si la peticion salio bien mirando un
    // campo `success` del cuerpo. Esta API no lo tiene: manda el codigo HTTP.
    // Si alguien volviera a fiarse de `success`, esto pasaria por correcto.
    it("no se fia de un campo success que esta API no manda", async () => {
      simularFetch([respuesta({ success: true, message: "Prohibido" }, { status: 403 })]);

      await expect(peticion("/admin/resumen")).rejects.toThrow("Prohibido");
    });

    it("tampoco toma por error un 200 con success a false", async () => {
      simularFetch([respuesta({ success: false, data: { idUsuario: 7 } })]);

      await expect(peticion("/usuarios/me")).resolves.toHaveProperty("data.idUsuario", 7);
    });
  });
});

describe("origenDelBackend()", () => {
  // La API devuelve la direccion del QR relativa -"/p/mi-negocio"- y quien lo
  // escanea necesita el enlace entero.
  it("quita el /api del final", () => {
    expect(origenDelBackend()).toBe("http://api.de.pruebas.invalido");
  });
});

describe("descargar()", () => {
  beforeEach(() => {
    sessionStorage.setItem(CLAVE_TOKEN, "token-de-prueba");
  });

  it("manda el token, que es justo por lo que no se puede usar un <a href>", async () => {
    const espia = simularFetch([
      respuesta("imagen", { headers: { "content-disposition": 'attachment; filename="qr.png"' } })
    ]);

    await descargar("/qr/imagen?formato=png");

    expect(espia.mock.calls[0][1].headers.Authorization).toBe("Bearer token-de-prueba");
  });

  it("saca el nombre del archivo de Content-Disposition", async () => {
    simularFetch([
      respuesta("imagen", {
        headers: { "content-disposition": 'attachment; filename="qr-la-espiga.png"' }
      })
    ]);

    const { nombre, blob } = await descargar("/qr/imagen");

    expect(nombre).toBe("qr-la-espiga.png");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("lee el nombre aunque venga sin comillas", async () => {
    simularFetch([
      respuesta("imagen", { headers: { "content-disposition": "attachment; filename=qr.svg" } })
    ]);

    await expect(descargar("/qr/imagen")).resolves.toHaveProperty("nombre", "qr.svg");
  });

  // Sin Access-Control-Expose-Headers el navegador no deja leer la cabecera
  // desde otro origen. Pasa de verdad, y el archivo no puede quedarse sin
  // nombre.
  it("usa un nombre de respaldo si el navegador no deja leer la cabecera", async () => {
    simularFetch([respuesta("imagen")]);

    await expect(descargar("/qr/imagen")).resolves.toHaveProperty("nombre", "codigo-qr");
  });

  it("lanza con el mensaje del servidor cuando falla", async () => {
    simularFetch([respuesta({ message: "El código no existe" }, { status: 404 })]);

    await expect(descargar("/qr/imagen")).rejects.toMatchObject({
      message: "El código no existe",
      status: 404
    });
  });
});

// REGRESION. Cuando no hay conexion, fetch rechaza con un TypeError cuyo
// mensaje lo pone el navegador: "Failed to fetch" en Chrome, "Load failed" en
// Safari, "NetworkError when attempting to fetch resource" en Firefox. Las
// pantallas ensenan el mensaje del error, asi que ese texto acababa delante
// de quien atiende un negocio, en ingles y sin decir que hacer.
describe("cuando la peticion no sale", () => {
  const sinRed = () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  };

  it("lo cuenta en castellano", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});

    sinRed();

    await expect(peticion("/usuarios/me")).rejects.toThrow(/No se pudo conectar con el servidor/);

    silencio.mockRestore();
  });

  it("sin colar el texto del navegador", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});

    sinRed();

    await expect(peticion("/usuarios/me")).rejects.not.toThrow(/fetch/);

    silencio.mockRestore();
  });

  // Para quien revise la consola, que es donde ese detalle si sirve.
  it("pero deja el original en la consola", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});

    sinRed();

    await expect(peticion("/usuarios/me")).rejects.toThrow();

    expect(consola).toHaveBeenCalledWith(
      "La petición no salió:",
      expect.stringContaining("/usuarios/me"),
      "Failed to fetch"
    );

    consola.mockRestore();
  });

  // Se distingue por el TIPO del error y no por su texto: comparar cadenas
  // acertaria en un navegador y fallaria en los otros dos.
  it("se fija en el tipo del error, no en lo que dice", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Load failed")));

    await expect(peticion("/usuarios/me")).rejects.toThrow(/No se pudo conectar/);

    silencio.mockRestore();
  });

  // Un error que no sea de red -uno que lance el propio codigo- tiene que
  // llegar tal cual: taparlo todo con "no hay conexion" seria mentir.
  it("un error que no es de red pasa sin tocarse", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Algo muy raro")));

    await expect(peticion("/usuarios/me")).rejects.toThrow("Algo muy raro");
  });
});

// ============================================
// La sesion que se termina sola
//
// Esto no lo veia ninguna prueba. Las seis revisiones del frontend
// mantuvieron la sesion constante: la de red cortada hace fallar la
// CONEXION -un TypeError-, no la SESION. Y AuthContext solo se enteraba de
// un token muerto en su primer efecto, o sea al cargar la pagina: navegando
// por la barra, que es lo que hace quien esta usando la aplicacion, nadie se
// enteraba.
// ============================================

describe("un 401 de sesion", () => {
  /** Un 401 como el que manda el middleware del backend. */
  const deSesion = (message = "Token inválido o vencido") =>
    respuesta({ message, codigo: "sesion" }, { status: 401 });

  it("borra el token y el usuario guardados", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify({ nombre: "Alguien" }));

    simularFetch([deSesion()]);

    await expect(peticion("/usuarios/me")).rejects.toThrow();

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
    expect(sessionStorage.getItem(CLAVE_USUARIO)).toBeNull();
  });

  // El mensaje del servidor es correcto para un registro y no dice que hacer
  // a quien esta delante. Y la segunda mitad es la que importa: quien
  // llevaba media hora escribiendo tiene derecho a saber que no se guardo.
  it("no reenvia el mensaje del servidor, dice uno que sirve", async () => {
    simularFetch([deSesion()]);

    await expect(peticion("/usuarios/me")).rejects.toThrow(/Tu sesión terminó/);
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  it("y dice que lo que se estaba escribiendo no se guardo", async () => {
    simularFetch([deSesion()]);

    await expect(peticion("/perfiles/me")).rejects.toThrow(/no se guardó/);
  });

  it("avisa a quien se haya registrado", async () => {
    const avisado = vi.fn();

    alTerminarLaSesion(avisado);
    simularFetch([deSesion()]);

    await expect(peticion("/contenido")).rejects.toThrow();

    expect(avisado).toHaveBeenCalledTimes(1);
    expect(avisado.mock.calls[0][0]).toMatch(/Tu sesión terminó/);

    alTerminarLaSesion(null);
  });

  // Los cinco motivos del middleware llevan el mismo codigo y se tratan
  // igual: la frase vale para todos.
  it.each([
    "Autenticación requerida",
    "Token inválido o vencido",
    "La sesión fue cerrada",
    "Usuario inválido o restringido",
    "La contraseña cambió. Inicie sesión de nuevo"
  ])("pasa igual con «%s»", async (mensaje) => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([deSesion(mensaje)]);

    await expect(peticion("/usuarios/me")).rejects.toThrow(/Tu sesión terminó/);
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });

  // La descarga del codigo QR no pasa por peticion(): pide un blob y tiene
  // su propio manejo de errores, asi que podria quedarse fuera del arreglo.
  it("la descarga del codigo QR tambien", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([deSesion()]);

    await expect(descargar("/qr/descargar/png")).rejects.toThrow(/Tu sesión terminó/);
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull();
  });
});

describe("un 401 que NO es de sesion", () => {
  // LA TRAMPA DEL ARREGLO, y la razon de que el backend mande un codigo.
  //
  // Cambiar el correo, cambiar la contrasena y darse de baja piden confirmar
  // la contrasena, y responden 401 cuando no es la que es. Si cualquier 401
  // cerrara la sesion, equivocarse al teclear la contrasena echaria a la
  // persona fuera de la aplicacion y le haria perder lo que estuviera
  // escribiendo: un defecto peor que el que esto arregla.
  const deContrasena = respuesta(
    { message: "La contraseña no es correcta" },
    { status: 401 }
  );

  it("no cierra la sesion", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([deContrasena]);

    await expect(peticion("/usuarios/me", { method: "PUT" })).rejects.toThrow();

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe("jwt");
  });

  it("deja pasar el mensaje del servidor, que es el que hay que leer", async () => {
    simularFetch([deContrasena]);

    await expect(peticion("/usuarios/me", { method: "PUT" }))
      .rejects.toThrow("La contraseña no es correcta");
  });

  it("ni avisa de que la sesion termino", async () => {
    const avisado = vi.fn();

    alTerminarLaSesion(avisado);
    simularFetch([deContrasena]);

    await expect(peticion("/usuarios/me", { method: "DELETE" })).rejects.toThrow();

    expect(avisado).not.toHaveBeenCalled();

    alTerminarLaSesion(null);
  });

  // Y un 401 sin cuerpo que se pueda leer tampoco: sin el codigo no se puede
  // afirmar que sea de sesion, y cerrarla por si acaso seria adivinar.
  it("un 401 sin cuerpo no cierra la sesion", async () => {
    sessionStorage.setItem(CLAVE_TOKEN, "jwt");
    simularFetch([respuesta(undefined, { status: 401 })]);

    await expect(peticion("/usuarios/me")).rejects.toThrow();

    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe("jwt");
  });
});
