import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, doc, addDoc, setDoc, deleteDoc, updateDoc, writeBatch, increment,
  query, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { $, esc, precio, miniatura, fotoUrl, toast } from "./util.js";
import { enOferta } from "./producto.js";
import { comprimir, subir } from "./imagen.js";
import { listarTemas, temaAuto, aplicarTema } from "./temas.js";
import { configurado, tienda } from "./config.js";

let unsubs = [];
let productos = [];
let editando = null;   // producto en edición (null = nuevo)
let fotoBlob = null;
let config = {};      // documento config/tienda
let pedidos = [];

/* ---------- Sesión ---------- */
onAuthStateChanged(auth, (user) => {
  unsubs.forEach((u) => u());
  unsubs = [];
  $("#login").hidden = !!user;
  $("#panel").hidden = !user;
  if (!user) return;
  unsubs.push(
    onSnapshot(collection(db, "productos"), (s) => {
      productos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      productos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      pintarProductos();
    }, errPermiso),
    onSnapshot(doc(db, "config", "tienda"), (s) => {
      config = s.exists() ? s.data() : {};
      cargarTema(config);
      cargarAjustes(config);
      pintarCategorias();
      pintarPedidos();
    }, errPermiso),
    onSnapshot(query(collection(db, "pedidos"), orderBy("fecha", "desc"), limit(200)), (s) => {
      pedidos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      pintarPedidos();
    }, errPermiso)
  );
});

function errPermiso(e) {
  console.error(e);
  toast("Sin permiso o error de conexión. Revisa las reglas de Firestore.", "err");
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  $("#loginError").hidden = true;
  if (!configurado) {
    $("#loginError").textContent = "Falta configurar Firebase en js/config.js.";
    $("#loginError").hidden = false;
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
    f.password.value = "";
  } catch {
    $("#loginError").textContent = "Correo o contraseña incorrectos.";
    $("#loginError").hidden = false;
  }
});
$("#btnSalir").addEventListener("click", () => signOut(auth));

/* ---------- Pestañas ---------- */
document.querySelectorAll(".atab").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".atab").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("#tabArticulos").hidden = b.dataset.tab !== "articulos";
    $("#tabCategorias").hidden = b.dataset.tab !== "categorias";
    $("#tabPedidos").hidden = b.dataset.tab !== "pedidos";
    $("#tabApariencia").hidden = b.dataset.tab !== "apariencia";
    $("#tabAjustes").hidden = b.dataset.tab !== "ajustes";
  })
);

/* ---------- Apariencia (temas por carpeta) ---------- */
const temaForm = $("#temaForm");
let listaTemas = null;

listarTemas()
  .then((l) => {
    listaTemas = l;
    const opciones = [{ id: "auto", nombre: "Automático por fecha", descripcion: "Cada tema se activa en sus fechas (ver tema.json)", colores: [] }, ...l.temas];
    $("#temas").innerHTML = opciones
      .map((t) => `<label class="tema"><input type="radio" name="tema" value="${esc(t.id)}">
        <b>${esc(t.nombre)}</b>
        <span class="dots">${(t.colores || []).map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</span>
        <small>${esc(t.descripcion || "")}</small></label>`)
      .join("");
    cargarTema(config);
  })
  .catch(() => ($("#temas").innerHTML = `<p class="s" style="color:var(--warn)">No se pudo leer temas/temas.json</p>`));

temaForm.addEventListener("change", (e) => {
  if (e.target.name !== "tema" || !listaTemas) return;
  // Vista previa inmediata en el panel; no se publica hasta guardar
  aplicarTema(e.target.value === "auto" ? temaAuto(listaTemas) : e.target.value);
});

function cargarTema(cfg) {
  const id = cfg?.tema || listaTemas?.porDefecto || "clasico";
  const r = temaForm.querySelector(`input[name="tema"][value="${id}"]`);
  if (r) r.checked = true;
  $("#mostrarMensaje").checked = cfg?.mostrarMensaje !== false;
  if (document.activeElement !== $("#mensaje")) $("#mensaje").value = cfg?.mensaje || "";
}

temaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tema = temaForm.querySelector('input[name="tema"]:checked')?.value || "clasico";
  const btn = $("#btnTema");
  btn.disabled = true;
  try {
    await setDoc(doc(db, "config", "tienda"), {
      tema,
      mostrarMensaje: $("#mostrarMensaje").checked,
      mensaje: $("#mensaje").value.trim()
    }, { merge: true });
    toast("Apariencia guardada");
  } catch (err) {
    errPermiso(err);
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Categorías (son las pestañas del catálogo) ---------- */
const normCat = (t) => String(t || "").trim().replace(/\s+/g, " ").slice(0, 40);
const mismaCat = (a, b) => normCat(a).toLowerCase() === normCat(b).toLowerCase();

// Lista de trabajo: las guardadas (en orden) y las que solo existen escritas en algún artículo
function listaCats() {
  const base = [];
  for (const c of config.categorias || []) if (normCat(c) && !base.some((b) => mismaCat(b, c))) base.push(normCat(c));
  const extras = [...new Set(productos.map((p) => normCat(p.categoria)).filter(Boolean))]
    .filter((c) => !base.some((b) => mismaCat(b, c)))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...base, ...extras];
}

const cuantos = (c) => productos.filter((p) => mismaCat(p.categoria, c)).length;
let catPrevia = "";

function llenarSelectCategorias(actual = "") {
  const sel = $("#selCat");
  const lista = listaCats();
  const act = normCat(actual);
  if (act && !lista.some((c) => mismaCat(c, act))) lista.push(act);
  sel.innerHTML =
    `<option value="">Sin categoría</option>` +
    lista.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("") +
    `<option value="__nueva">+ Nueva categoría…</option>`;
  sel.value = act ? lista.find((c) => mismaCat(c, act)) : "";
  catPrevia = sel.value;
}

function pintarCategorias() {
  const lista = listaCats();
  const guardadas = (config.categorias || []).map(normCat);
  $("#listaCats").innerHTML = lista.length
    ? lista.map((c, i) => `<div class="item" data-i="${i}" style="grid-template-columns:1fr auto">
        <div><div class="t">${esc(c)}</div>
          <div class="s">${cuantos(c)} artículo${cuantos(c) === 1 ? "" : "s"}${guardadas.some((g) => mismaCat(g, c)) ? "" : " · aún no está en la lista"}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="ibtn" data-a="sube" aria-label="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="ibtn" data-a="baja" aria-label="Bajar" ${i === lista.length - 1 ? "disabled" : ""}>↓</button>
          <button class="ibtn" data-a="renombrar">Renombrar</button>
          <button class="ibtn" data-a="borrar" aria-label="Eliminar">🗑</button>
        </div></div>`).join("")
    : `<p class="vacio" style="padding:20px 0">Aún no hay categorías. Agrega la primera arriba.</p>`;
}

async function agregarCategoria(nombre) {
  const n = normCat(nombre);
  if (!n) return false;
  const lista = listaCats();
  if (lista.some((c) => mismaCat(c, n))) {
    toast("Esa categoría ya existe", "err");
    return false;
  }
  if (lista.length >= 30) {
    toast("Máximo 30 categorías", "err");
    return false;
  }
  await guardarConfig({ categorias: [...lista, n] }, "Categoría agregada");
  return true;
}

$("#catForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (await agregarCategoria($("#catNombre").value)) e.target.reset();
});

$("#listaCats").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]");
  const row = e.target.closest("[data-i]");
  if (!b || !row) return;
  const lista = listaCats();
  const i = Number(row.dataset.i);
  const c = lista[i];
  const accion = b.dataset.a;
  try {
    if (accion === "sube" || accion === "baja") {
      const j = accion === "sube" ? i - 1 : i + 1;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      await guardarConfig({ categorias: lista }, "Orden guardado");
    } else if (accion === "renombrar") {
      const nuevo = normCat(prompt("Nuevo nombre de la categoría", c));
      if (!nuevo || nuevo === c) return;
      if (lista.some((x, k) => k !== i && mismaCat(x, nuevo))) return toast("Ya existe una categoría con ese nombre", "err");
      const lote = writeBatch(db);
      productos.filter((p) => mismaCat(p.categoria, c)).forEach((p) => lote.update(doc(db, "productos", p.id), { categoria: nuevo }));
      lista[i] = nuevo;
      lote.set(doc(db, "config", "tienda"), { categorias: lista }, { merge: true });
      await lote.commit();
      toast("Categoría renombrada");
    } else if (accion === "borrar") {
      const n = cuantos(c);
      const aviso = n
        ? `¿Eliminar "${c}"? Sus ${n} artículo${n === 1 ? "" : "s"} quedarán sin categoría y se verán en "Otros".`
        : `¿Eliminar "${c}"?`;
      if (!confirm(aviso)) return;
      const lote = writeBatch(db);
      productos.filter((p) => mismaCat(p.categoria, c)).forEach((p) => lote.update(doc(db, "productos", p.id), { categoria: "" }));
      lote.set(doc(db, "config", "tienda"), { categorias: lista.filter((_, k) => k !== i) }, { merge: true });
      await lote.commit();
      toast("Categoría eliminada");
    }
  } catch (err) {
    errPermiso(err);
  }
});

// En el formulario del artículo: crear una categoría sin salir de la pantalla
$("#selCat").addEventListener("change", async (e) => {
  const sel = e.target;
  if (sel.value !== "__nueva") {
    catPrevia = sel.value;
    return;
  }
  const nombre = normCat(prompt("Nombre de la nueva categoría"));
  if (!nombre) {
    sel.value = catPrevia;
    return;
  }
  const existente = listaCats().find((c) => mismaCat(c, nombre));
  if (!existente && !(await agregarCategoria(nombre))) {
    sel.value = catPrevia;
    return;
  }
  llenarSelectCategorias(existente || nombre);
});

/* ---------- Artículos ---------- */
function pintarProductos() {
  pintarCategorias();
  $("#listaProd").innerHTML = productos.length
    ? productos
        .map((p) => {
          const stock = Number(p.cantidad) || 0;
          return `<div class="item" data-id="${esc(p.id)}">
        <img src="${esc(fotoUrl(p.imagen, 120))}" alt="">
        <div>
          <div class="t">${esc(p.nombre)}${enOferta(p) ? `<span class="pill of">Oferta</span>` : ""}${p.destacado ? `<span class="pill sin">Destacado</span>` : ""}${p.activo ? "" : `<span class="pill off">Oculto</span>`}</div>
          <div class="s">${esc(p.categoria || "Sin categoría")} · ${enOferta(p) ? `<s>${esc(precio(p.precio))}</s> <b>${esc(precio(p.precioOferta))}</b>` : esc(precio(p.precio))} ·
            <span style="${stock <= 0 ? "color:var(--warn);font-weight:600" : ""}">${stock <= 0 ? "Sin existencias · no se muestra en la tienda" : `Disponibles: ${stock}`}</span></div>
        </div>
        <div style="display:flex;gap:6px"><button class="ibtn" data-a="editar">Editar</button><button class="ibtn" data-a="borrar" aria-label="Eliminar">🗑</button></div>
      </div>`;
        })
        .join("")
    : `<p class="vacio">Todavía no hay artículos. Crea el primero.</p>`;
}

$("#listaProd").addEventListener("click", async (e) => {
  const a = e.target.closest("[data-a]");
  const row = e.target.closest(".item");
  if (!a || !row) return;
  const p = productos.find((x) => x.id === row.dataset.id);
  if (a.dataset.a === "editar") abrirModal(p);
  if (a.dataset.a === "borrar" && confirm(`¿Eliminar "${p.nombre}"? No se puede deshacer.`)) {
    try {
      await deleteDoc(doc(db, "productos", p.id));
      toast("Artículo eliminado");
    } catch (err) {
      errPermiso(err);
    }
  }
});

const form = $("#prodForm");
const syncOferta = () => ($("#ofertaCampos").hidden = !form.oferta.checked);
form.oferta.addEventListener("change", syncOferta);

function abrirModal(p = null) {
  editando = p;
  fotoBlob = null;
  form.reset();
  llenarSelectCategorias(p?.categoria || "");
  $("#prodError").hidden = true;
  $("#modalTitulo").textContent = p ? "Editar artículo" : "Nuevo artículo";
  if (p) {
    form.nombre.value = p.nombre || "";
    form.precio.value = p.precio ?? "";
    form.cantidad.value = p.cantidad ?? 0;
    form.oferta.checked = !!p.oferta;
    form.precioOferta.value = p.precioOferta ?? "";
    form.mostrarAhorro.checked = p.mostrarAhorro !== false;
    form.activo.checked = p.activo !== false;
    form.descripcion.value = p.descripcion || "";
    form.destacado.checked = !!p.destacado;
  }
  verPreview(p?.imagen ? miniatura(p.imagen, 600) : "");
  syncOferta();
  $("#modal").hidden = false;
}

function verPreview(src) {
  $("#preview").hidden = !src;
  if (src) $("#preview").src = src;
  $("#fotoLbl").textContent = src ? "Cambiar foto" : "Tomar foto o elegir de la galería (opcional)";
}

const cerrarModal = () => ($("#modal").hidden = true);
$("#btnNuevo").addEventListener("click", () => abrirModal());
$("#btnCancelar").addEventListener("click", cerrarModal);

$("#foto").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    fotoBlob = await comprimir(file);
    verPreview(URL.createObjectURL(fotoBlob));
    $("#fotoLbl").textContent = `Cambiar foto (${Math.round(fotoBlob.size / 1024)} KB)`;
  } catch {
    toast("No se pudo procesar la imagen", "err");
  }
  e.target.value = "";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = (m) => {
    $("#prodError").textContent = m;
    $("#prodError").hidden = !m;
  };
  err("");

  const nombre = form.nombre.value.trim();
  const precioN = Number(form.precio.value);
  const cantidad = Math.floor(Number(form.cantidad.value));
  const oferta = form.oferta.checked;
  const precioOferta = Number(form.precioOferta.value) || 0;
  if (!nombre) return err("Escribe el nombre.");
  if (!(precioN >= 0) || form.precio.value === "") return err("Escribe el precio.");
  if (!(cantidad >= 0)) return err("Escribe la cantidad (0 si no hay).");
  if (oferta && !(precioOferta > 0 && precioOferta < precioN)) return err("El precio de oferta debe ser mayor que 0 y menor que el precio normal.");

  const btn = $("#btnGuardar");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    let imagen = editando?.imagen || "";
    if (fotoBlob) imagen = await subir(fotoBlob);

    const datos = {
      nombre,
      categoria: form.categoria.value === "__nueva" ? "" : form.categoria.value.trim(),
      precio: precioN,
      cantidad,
      imagen,
      activo: form.activo.checked,
      oferta,
      precioOferta: oferta ? precioOferta : 0,
      mostrarAhorro: form.mostrarAhorro.checked,
      descripcion: form.descripcion.value.trim(),
      destacado: form.destacado.checked
    };
    if (editando) await updateDoc(doc(db, "productos", editando.id), datos);
    else await addDoc(collection(db, "productos"), { ...datos, fecha: serverTimestamp() });
    toast("Guardado");
    cerrarModal();
  } catch (ex) {
    console.error(ex);
    err(ex.message || "No se pudo guardar. Intenta de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
});

/* ---------- Ajustes (correo de pedidos y mensajeros) ---------- */
function cargarAjustes(cfg) {
  const campos = { correoPedidos: "#correoPedidos", direccion: "#negDireccion", telefonos: "#negTelefonos", correoContacto: "#negCorreo", horario: "#negHorario", pago: "#negPago" };
  for (const [k, sel] of Object.entries(campos)) if (document.activeElement !== $(sel)) $(sel).value = cfg[k] || "";
  const m = cfg.mensajeros || [];
  $("#listaMens").innerHTML = m.length
    ? m.map((x, i) => `<div class="item" data-i="${i}" style="grid-template-columns:1fr auto">
        <div><div class="t">${esc(x.nombre)}</div><div class="s">${esc(x.telefono || "Sin teléfono")}</div></div>
        <button class="ibtn" data-del aria-label="Eliminar mensajero">🗑</button></div>`).join("")
    : `<p class="s" style="color:var(--muted)">Aún no hay mensajeros.</p>`;
}

async function guardarConfig(parcial, msg) {
  try {
    await setDoc(doc(db, "config", "tienda"), parcial, { merge: true });
    toast(msg);
  } catch (err) {
    errPermiso(err);
  }
}

$("#ajustesForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const correo = $("#correoPedidos").value.trim();
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return toast("El correo no es válido", "err");
  guardarConfig({ correoPedidos: correo }, "Correo guardado");
});

$("#negocioForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const correo = $("#negCorreo").value.trim();
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return toast("El correo de contacto no es válido", "err");
  guardarConfig({
    direccion: $("#negDireccion").value.trim(),
    telefonos: $("#negTelefonos").value.trim(),
    correoContacto: correo,
    horario: $("#negHorario").value.trim(),
    pago: $("#negPago").value.trim()
  }, "Datos del negocio guardados");
});

$("#mensForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = $("#mensNombre").value.trim();
  const telefono = $("#mensTel").value.trim();
  if (!nombre) return toast("Escribe el nombre del mensajero", "err");
  const lista = [...(config.mensajeros || []), { nombre, telefono }];
  if (lista.length > 20) return toast("Máximo 20 mensajeros", "err");
  guardarConfig({ mensajeros: lista }, "Mensajero agregado");
  e.target.reset();
});

$("#listaMens").addEventListener("click", (e) => {
  const row = e.target.closest("[data-i]");
  if (!row || !e.target.closest("[data-del]")) return;
  const lista = [...(config.mensajeros || [])];
  const [x] = lista.splice(Number(row.dataset.i), 1);
  if (confirm(`¿Eliminar a ${x.nombre}? Los pedidos ya asignados conservan sus datos.`)) guardarConfig({ mensajeros: lista }, "Mensajero eliminado");
});

/* ---------- Pedidos ---------- */
const ESTADOS = [
  ["nuevo", "Nuevo"], ["preparando", "Preparando"], ["listo", "Listo"],
  ["en_camino", "En camino"], ["entregado", "Entregado"], ["cancelado", "Cancelado"]
];
const nombreEstado = (e) => ESTADOS.find((x) => x[0] === e)?.[1] || e;
const METODOS = ["Efectivo", "Transferencia", "Tarjeta", "Otro"];

const FILTROS = {
  porEntregar: ["Por entregar", (p) => !["entregado", "cancelado"].includes(p.estado)],
  sinPagar: ["Sin pagar", (p) => !p.pagado && p.estado !== "cancelado"],
  entregados: ["Entregados", (p) => p.estado === "entregado"],
  cancelados: ["Cancelados", (p) => p.estado === "cancelado"],
  todos: ["Todos", () => true]
};
let filtro = "porEntregar";

const soloDigitos = (t) => String(t || "").replace(/\D/g, "");

// Mensaje de WhatsApp al cliente según el estado del pedido
function avisoCliente(p) {
  let tel = soloDigitos(p.cliente?.telefono);
  if (tel.length === 8) tel = "506" + tel;
  const nombre = (p.cliente?.nombre || "").trim().split(/\s+/)[0] || "";
  const envio = p.tipo === "envio";
  const msgs = {
    nuevo: `recibimos tu pedido ${p.codigo}. En breve lo preparamos.`,
    preparando: `estamos preparando tu pedido ${p.codigo}.`,
    listo: envio
      ? `tu pedido ${p.codigo} está listo y pronto saldrá con el mensajero. Te confirmamos el costo del envío.`
      : `tu pedido ${p.codigo} está listo. Coordinemos el lugar y la hora de entrega.`,
    en_camino: `tu pedido ${p.codigo} va en camino.`,
    entregado: `tu pedido ${p.codigo} fue entregado. ¡Gracias por tu compra!`,
    cancelado: `tu pedido ${p.codigo} fue cancelado. Si tienes dudas, escríbenos.`
  };
  const texto = `Hola ${nombre}, te escribimos de ${tienda.nombre}: ${msgs[p.estado] || `tu pedido ${p.codigo} fue actualizado.`}`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

function textoMensajero(p) {
  const cobro = p.pagado ? "Ya está pagado." : `Cobrar al entregar: ${precio(p.total)}`;
  return `Pedido ${p.codigo}\nCliente: ${p.cliente?.nombre} - ${p.cliente?.telefono}\n` +
    `Dirección: ${p.direccion || "—"}${p.notas ? `\nNotas: ${p.notas}` : ""}\n` +
    `${(p.items || []).map((i) => `• ${i.cant} x ${i.nombre}`).join("\n")}\n${cobro}`;
}

// Resumen de ventas (sobre los últimos 200 pedidos cargados; no cuenta cancelados)
function pintarResumen() {
  const hoy = new Date();
  const validos = pedidos.filter((p) => p.estado !== "cancelado" && p.fecha?.toDate);
  const mismoDia = (d) => d.toDateString() === hoy.toDateString();
  const mismoMes = (d) => d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  const suma = (l) => l.reduce((t, p) => t + (Number(p.total) || 0), 0);
  const deHoy = validos.filter((p) => mismoDia(p.fecha.toDate()));
  const delMes = validos.filter((p) => mismoMes(p.fecha.toDate()));
  const porEntregar = validos.filter((p) => p.estado !== "entregado");
  const porCobrar = validos.filter((p) => !p.pagado);
  const tile = (t, v, s) => `<div class="stat"><span>${t}</span><b>${v}</b><small>${s}</small></div>`;
  $("#statsPed").innerHTML =
    tile("Hoy", precio(suma(deHoy)), `${deHoy.length} pedido${deHoy.length === 1 ? "" : "s"}`) +
    tile("Este mes", precio(suma(delMes)), `${delMes.length} pedido${delMes.length === 1 ? "" : "s"}`) +
    tile("Por entregar", porEntregar.length, "pedidos") +
    tile("Por cobrar", precio(suma(porCobrar)), `${porCobrar.length} sin pagar`);
}

function pintarPedidos() {
  const nuevos = pedidos.filter((p) => p.estado === "nuevo").length;
  $("#nuevos").textContent = nuevos;
  $("#nuevos").hidden = !nuevos;
  pintarResumen();

  $("#filtrosPed").innerHTML = Object.entries(FILTROS)
    .map(([k, [t, fn]]) => `<button class="tab" data-f="${k}" aria-selected="${k === filtro}">${t} (${pedidos.filter(fn).length})</button>`)
    .join("");

  const lista = pedidos.filter(FILTROS[filtro][1]);
  const mens = config.mensajeros || [];
  $("#listaPed").innerHTML = lista.length
    ? lista.map((p) => {
        const f = p.fecha?.toDate ? p.fecha.toDate().toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "";
        const envio = p.tipo === "envio";
        const m = p.mensajero;
        const tel = soloDigitos(m?.telefono);
        return `<div class="pedido" data-id="${esc(p.id)}">
        <div class="h"><span>#${esc(p.codigo)} · ${esc(p.cliente?.nombre)}</span>
          <span><span class="est ${p.pagado ? "listo" : "nuevo"}">${p.pagado ? "Pagado" : "Sin pagar"}</span> <span class="est ${esc(p.estado)}">${esc(nombreEstado(p.estado))}</span></span></div>
        <div class="d">${esc(f)} · ${envio ? "Envío" : "Retiro en punto acordado"} · <a href="tel:${esc(p.cliente?.telefono)}">${esc(p.cliente?.telefono)}</a>
          ${p.direccion ? `<br>${esc(p.direccion)}` : ""}${p.notas ? `<br><i>${esc(p.notas)}</i>` : ""}</div>
        <ul>${(p.items || []).map((i) => `<li>${esc(i.cant)} × ${esc(i.nombre)} — ${esc(precio(i.precio * i.cant))}</li>`).join("")}</ul>
        <div class="row"><b>Total ${esc(precio(p.total))}</b>
          ${p.cliente?.telefono ? `<a class="avisar" href="${esc(avisoCliente(p))}" target="_blank" rel="noopener">Avisar al cliente por WhatsApp</a>` : ""}</div>
        <div class="ctrl">
          <label class="f">Entrega
            <select data-est>${ESTADOS.filter(([k]) => envio || k !== "en_camino").map(([k, t]) => `<option value="${k}" ${k === p.estado ? "selected" : ""}>${t}</option>`).join("")}</select></label>
          <label class="f">Pago
            <select data-pagado><option value="0" ${p.pagado ? "" : "selected"}>Sin pagar</option><option value="1" ${p.pagado ? "selected" : ""}>Pagado</option></select></label>
          <label class="f">Método de pago
            <select data-metodo><option value="">—</option>${METODOS.map((x) => `<option ${x === p.metodoPago ? "selected" : ""}>${x}</option>`).join("")}</select></label>
          ${envio ? `<label class="f">Mensajero
            <select data-mens><option value="">Sin asignar</option>${mens.map((x, i) => `<option value="${i}" ${m && m.nombre === x.nombre ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
              ${m && !mens.some((x) => x.nombre === m.nombre) ? `<option selected>${esc(m.nombre)}</option>` : ""}</select></label>` : ""}
        </div>
        ${envio && m ? `<div class="d" style="margin:8px 0 0">Mensajero: <b>${esc(m.nombre)}</b>${m.telefono ? ` · <a href="tel:${esc(m.telefono)}">${esc(m.telefono)}</a>` : ""}
          ${tel ? ` · <a href="https://wa.me/${tel}?text=${encodeURIComponent(textoMensajero(p))}" target="_blank" rel="noopener">Enviarle el pedido por WhatsApp</a>` : ""}</div>` : ""}
      </div>`;
      }).join("")
    : `<p class="vacio">No hay pedidos en esta vista.</p>`;
}

$("#filtrosPed").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  filtro = b.dataset.f;
  pintarPedidos();
});

$("#listaPed").addEventListener("change", async (e) => {
  const el = e.target;
  const id = el.closest(".pedido")?.dataset.id;
  const ped = pedidos.find((p) => p.id === id);
  if (!ped) return;
  try {
    if (el.matches("[data-est]")) {
      const estado = el.value;
      // Al cancelar se devuelven las existencias (una sola vez)
      if (estado === "cancelado" && !ped.repuesto) {
        const b = writeBatch(db);
        (ped.items || []).forEach((i) => b.update(doc(db, "productos", i.id), { cantidad: increment(i.cant) }));
        b.update(doc(db, "pedidos", id), { estado, repuesto: true });
        await b.commit();
        toast("Pedido cancelado y existencias devueltas");
      } else {
        await updateDoc(doc(db, "pedidos", id), { estado });
        toast("Estado actualizado");
      }
    } else if (el.matches("[data-pagado]")) {
      const pagado = el.value === "1";
      await updateDoc(doc(db, "pedidos", id), { pagado, fechaPago: pagado ? serverTimestamp() : null });
      toast(pagado ? "Marcado como pagado" : "Marcado sin pagar");
    } else if (el.matches("[data-metodo]")) {
      await updateDoc(doc(db, "pedidos", id), { metodoPago: el.value });
      toast("Método de pago guardado");
    } else if (el.matches("[data-mens]")) {
      const x = el.value === "" ? null : (config.mensajeros || [])[Number(el.value)];
      await updateDoc(doc(db, "pedidos", id), { mensajero: x ? { nombre: x.nombre, telefono: x.telefono || "" } : null });
      toast(x ? `Asignado a ${x.nombre}` : "Mensajero quitado");
    }
  } catch (err) {
    errPermiso(err);
    pintarPedidos();
  }
});
