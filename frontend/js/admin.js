// ============================================
// ADMIN.JS — pantalla de administración (RF-13, RF-14 y RF-15)
//
// Tres requisitos en una sola pantalla porque son el mismo trabajo: el
// administrador mira la actividad de las cuentas (RF-13), actúa sobre las que
// lo necesiten (RF-14) y se lleva el listado si quiere revisarlo fuera
// (RF-15). Separarlos en tres pantallas obligaría a buscar la misma cuenta
// tres veces.
//
// El RF-14 no tiene endpoints propios: usa PATCH /api/usuarios/:id/estado y
// DELETE /api/usuarios/:id, que existen desde el módulo 1 con sus reglas.
// ============================================

// Esta pantalla es solo del rol administrador (RN-22). La comprobación de
// verdad la hace el servidor —que responde 403—, pero sin esto una cuenta de
// empresa vería la tabla vacía y los filtros, sin entender por qué.
//
// Se hace sobre la sesión guardada, que es instantánea; guardia.js confirma
// contra el servidor un momento después y echa a quien ya no tenga sesión.
(function comprobarRol() {
  const cuenta = Sesion.usuario();

  if (cuenta && cuenta.rol !== "administrador") {
    window.location.replace("dashboard.html");
  }
})();

const filtros = {
  busqueda: "",
  estado: "",
  orden: "registro",
  pagina: 1,
  porPagina: 20
};

let usuariosEnPantalla = [];

// --- Formato ---

/**
 * Una fecha como se lee en Colombia, o un guion si no hay.
 *
 * El "nunca" importa: una cuenta registrada que no volvió a entrar es
 * justo la que el RF-14 llama inactiva.
 */
function fecha(valor, conHora = false) {
  if (!valor) return null;

  const d = new Date(valor);

  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {})
  });
}

/** Hace cuánto, en palabras. Es lo que se mira de un vistazo. */
function haceCuanto(valor) {
  if (!valor) return "Nunca entró";

  const dias = Math.floor((Date.now() - new Date(valor).getTime()) / 86400000);

  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  if (dias < 60) return "Hace un mes";

  return `Hace ${Math.floor(dias / 30)} meses`;
}

function numero(valor) {
  return Number(valor || 0).toLocaleString("es-CO");
}

// --- Dibujado ---

function pintarResumen(resumen) {
  const tarjetas = [
    { etiqueta: "Cuentas registradas", valor: resumen.total },
    { etiqueta: "Activas", valor: resumen.activos },
    { etiqueta: "Restringidas", valor: resumen.restringidos },
    { etiqueta: "Nuevas (30 días)", valor: resumen.nuevos30Dias },
    // Las dos que importan para el RF-14: son las candidatas a revisar
    { etiqueta: "Nunca entraron", valor: resumen.nuncaEntraron, aviso: resumen.nuncaEntraron > 0 },
    { etiqueta: "Sin entrar (30 días)", valor: resumen.inactivos30Dias, aviso: resumen.inactivos30Dias > 0 }
  ];

  document.getElementById("admin-resumen").innerHTML = tarjetas
    .map(
      (t) => `
      <div class="admin-kpi ${t.aviso ? "admin-kpi--aviso" : ""}">
        <div class="admin-kpi-valor">${numero(t.valor)}</div>
        <div class="admin-kpi-etiqueta">${escapeHtml(t.etiqueta)}</div>
      </div>`
    )
    .join("");
}

function pintarFilas(usuarios) {
  const cuerpo = document.getElementById("admin-filas");

  cuerpo.innerHTML = usuarios
    .map((u) => {
      const perfil = u.perfil;
      const total = u.actividad.escaneos + u.actividad.visitas + u.actividad.clics;
      const esAdmin = u.rol === "administrador";

      // El propio administrador no puede restringirse ni eliminarse: si fuera
      // el único, nadie podría volver a administrar el sistema. El servidor lo
      // rechaza con 400; aquí no se ofrece el botón para no prometerlo.
      const esUnoMismo = Sesion.usuario() && Sesion.usuario().idUsuario === u.id;

      return `
      <tr data-id="${u.id}">
        <td data-label="Cuenta">
          <div class="admin-cuenta">
            <span class="admin-nombre">${escapeHtml(u.nombre)}</span>
            <span class="admin-correo">${escapeHtml(u.correo)}</span>
            ${esAdmin ? '<span class="admin-chip admin-chip--rol">Administrador</span>' : ""}
          </div>
          <span class="admin-registro">Registro: ${escapeHtml(fecha(u.fechaRegistro) || "—")}</span>
        </td>
        <td data-label="Negocio">
          ${
            perfil
              ? `<span class="admin-negocio">${escapeHtml(perfil.nombreNegocio)}</span>
                 <span class="admin-detalle">${perfil.bloquesActivos} bloques ·
                   ${perfil.qr === null ? "sin código" : perfil.qr ? "código activo" : "código apagado"}</span>`
              : '<span class="admin-detalle">Sin perfil</span>'
          }
        </td>
        <td data-label="Estado">
          <span class="admin-chip admin-chip--${u.estado}">${u.estado === "activo" ? "Activo" : "Restringido"}</span>
        </td>
        <td data-label="Último acceso">
          <span class="admin-acceso ${u.ultimoAcceso ? "" : "admin-acceso--nunca"}">${escapeHtml(haceCuanto(u.ultimoAcceso))}</span>
          ${u.ultimoAcceso ? `<span class="admin-detalle">${escapeHtml(fecha(u.ultimoAcceso, true) || "")}</span>` : ""}
        </td>
        <td data-label="Actividad">
          <span class="admin-actividad">${numero(total)}</span>
          <span class="admin-detalle">${numero(u.actividad.escaneos)} esc · ${numero(u.actividad.visitas)} vis · ${numero(u.actividad.clics)} clic</span>
        </td>
        <td class="admin-acciones">
          ${
            esUnoMismo
              ? '<span class="admin-detalle">Tu cuenta</span>'
              : `<button type="button" class="admin-btn" data-accion="estado"
                         data-estado="${u.estado === "activo" ? "restringido" : "activo"}">
                   ${u.estado === "activo" ? "Restringir" : "Reactivar"}
                 </button>
                 <button type="button" class="admin-btn admin-btn--peligro" data-accion="eliminar">
                   Eliminar
                 </button>`
          }
        </td>
      </tr>`;
    })
    .join("");
}

function pintarPaginacion({ pagina, paginas, total }) {
  const el = document.getElementById("admin-paginacion");

  if (paginas <= 1) {
    el.innerHTML = `<span class="admin-detalle">${numero(total)} ${total === 1 ? "cuenta" : "cuentas"}</span>`;
    return;
  }

  el.innerHTML = `
    <button type="button" class="admin-btn" data-pagina="${pagina - 1}" ${pagina <= 1 ? "disabled" : ""}>Anterior</button>
    <span class="admin-detalle">Página ${pagina} de ${paginas} · ${numero(total)} cuentas</span>
    <button type="button" class="admin-btn" data-pagina="${pagina + 1}" ${pagina >= paginas ? "disabled" : ""}>Siguiente</button>`;
}

function avisarError(mensaje) {
  const aviso = document.getElementById("admin-alert");

  aviso.textContent = mensaje;
  aviso.hidden = false;

  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => {
    aviso.hidden = true;
  }, 6000);
}

function avisar(mensaje, tipo = "ok") {
  const toast = document.getElementById("admin-toast");

  toast.textContent = mensaje;
  toast.className = "settings-saved-toast " + (tipo === "error" ? "is-error" : "is-ok");

  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.textContent = "";
    toast.className = "settings-saved-toast";
  }, 4000);
}

// --- Carga ---

async function cargar() {
  try {
    const [resumen, lista] = await Promise.all([
      Api.resumenAdmin(),
      Api.listarUsuariosAdmin(filtros)
    ]);

    pintarResumen(resumen.data);

    usuariosEnPantalla = lista.data;

    pintarFilas(lista.data);
    pintarPaginacion(lista.paginacion);

    document.getElementById("admin-vacio").hidden = lista.data.length > 0;
  } catch (error) {
    // El 403 solo puede verlo quien llegó aquí sin ser administrador, y para
    // eso ya redirigió comprobarRol(); cualquier otro fallo sí hay que decirlo
    avisarError(error.message);
  }
}

// --- Filtros ---

let esperaBusqueda;

document.getElementById("admin-busqueda").addEventListener("input", (evento) => {
  // Se espera a que deje de escribir: una consulta por tecla serían tres
  // LIKE sobre la tabla de usuarios en cada pulsación
  clearTimeout(esperaBusqueda);

  esperaBusqueda = setTimeout(() => {
    filtros.busqueda = evento.target.value.trim();
    filtros.pagina = 1;
    cargar();
  }, 300);
});

for (const [id, campo] of [["admin-estado", "estado"], ["admin-orden", "orden"]]) {
  document.getElementById(id).addEventListener("change", (evento) => {
    filtros[campo] = evento.target.value;
    filtros.pagina = 1;
    cargar();
  });
}

document.getElementById("admin-paginacion").addEventListener("click", (evento) => {
  const boton = evento.target.closest("[data-pagina]");

  if (!boton || boton.disabled) return;

  filtros.pagina = Number(boton.dataset.pagina);
  cargar();
});

// --- Restringir y eliminar (RF-14) ---

const dialogo = document.getElementById("admin-confirmar");

let pendiente = null;

/**
 * Pide confirmación antes de actuar.
 *
 * Las dos acciones del RF-14 afectan a otra persona y una no se deshace, así
 * que ninguna se ejecuta de un solo clic.
 */
function confirmar({ titulo, texto, etiqueta, accion }) {
  document.getElementById("admin-confirmar-titulo").textContent = titulo;
  document.getElementById("admin-confirmar-texto").textContent = texto;
  document.getElementById("admin-aceptar").textContent = etiqueta;

  pendiente = accion;

  dialogo.showModal();
}

document.getElementById("admin-cancelar").addEventListener("click", () => {
  pendiente = null;
  dialogo.close();
});

document.getElementById("admin-aceptar").addEventListener("click", async () => {
  const accion = pendiente;

  pendiente = null;
  dialogo.close();

  if (!accion) return;

  try {
    await accion();
    await cargar();
  } catch (error) {
    avisar(error.message, "error");
  }
});

document.getElementById("admin-filas").addEventListener("click", (evento) => {
  const boton = evento.target.closest("[data-accion]");

  if (!boton) return;

  const id = Number(boton.closest("tr").dataset.id);
  const usuario = usuariosEnPantalla.find((u) => u.id === id);

  if (!usuario) return;

  if (boton.dataset.accion === "estado") {
    const estado = boton.dataset.estado;
    const restringir = estado === "restringido";

    confirmar({
      titulo: restringir ? "Restringir la cuenta" : "Reactivar la cuenta",
      texto: restringir
        ? `${usuario.nombre} dejará de poder iniciar sesión, y las sesiones que tenga abiertas dejarán de servir. Su página pública también dejará de responder.`
        : `${usuario.nombre} podrá volver a iniciar sesión y su página pública volverá a responder.`,
      etiqueta: restringir ? "Restringir" : "Reactivar",
      accion: async () => {
        await Api.cambiarEstadoUsuario(id, estado);
        avisar(restringir ? "Cuenta restringida" : "Cuenta reactivada");
      }
    });

    return;
  }

  confirmar({
    titulo: "Eliminar la cuenta",
    texto: `Se eliminará la cuenta de ${usuario.nombre} (${usuario.correo}). Su correo queda libre para registrarse de nuevo y su página pública deja de responder. Esta acción no se puede deshacer desde aquí.`,
    etiqueta: "Eliminar",
    accion: async () => {
      await Api.eliminarUsuario(id);
      avisar("Cuenta eliminada");
    }
  });
});

// --- Descargar el reporte (RF-15) ---

document.getElementById("admin-descargar").addEventListener("click", async (evento) => {
  const boton = evento.currentTarget;

  boton.disabled = true;

  try {
    // Se mandan los mismos filtros de la tabla: lo que se ve es lo que se
    // descarga. Un reporte que no coincide con la pantalla desconcierta.
    const { blob, nombre } = await descargarReporteUsuarios({
      busqueda: filtros.busqueda,
      estado: filtros.estado,
      orden: filtros.orden
    });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);

    avisar("Reporte descargado");
  } catch (error) {
    avisar(error.message, "error");
  } finally {
    boton.disabled = false;
  }
});

cargar();
