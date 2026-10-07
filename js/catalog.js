import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { $, esc, precio, fotoUrl, toast } from "./util.js";
import { enOferta, precioFinal, descuento } from "./producto.js";
import * as cart from "./cart.js";
import { iniciarTema } from "./temas.js";
import { iniciarFooter } from "./footer.js";
import { alConfig } from "./tiendaconfig.js";
import { configurado, tienda } from "./config.js";
import { waLink, textoConsulta, textoProducto } from "./notificar.js";
import { ICONOS } from "./iconos.js";

iniciarTema();
iniciarFooter();

const TODOS = "Todos";
const SIN_CAT = "Otros";

let cargado = false;
let productos = [];   // todos los activos (incluye los sin existencias, que no se muestran)
let categoria = TODOS;
let busqueda = "";
let orden = [];       // orden de categorías definido en el admin

const catDe = (p) => (p.categoria || "").trim() || SIN_CAT;
const stockDe = (p) => Math.max(0, Number(p.cantidad) || 0);
// El cliente solo ve artículos con existencias
const visibles = () => productos.filter((p) => stockDe(p) > 0);
const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function aviso(titulo, texto = "") {
  $("#grid").innerHTML = "";
  $("#vacio").hidden = false;
  $("#vacio").innerHTML = `<b>${esc(titulo)}</b>${esc(texto)}`;
}

if (!configurado) aviso("Tienda en configuración", "Falta configurar Firebase en js/config.js.");
else setTimeout(() => !cargado && aviso("No se pudo cargar el catálogo", "Revisa tu conexión e intenta de nuevo."), 10000);

alConfig((cfg) => {
  orden = cfg.categorias || [];
  if (cargado) render();
});

onSnapshot(
  query(collection(db, "productos"), where("activo", "==", true)),
  (snap) => {
    cargado = true;
    productos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    productos.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
    render();
    renderCart();
  },
  (err) => {
    console.error(err);
    aviso("No se pudo cargar el catálogo", "Intenta de nuevo en un momento.");
  }
);

/* ---------- Catálogo ---------- */
function categoriasOrdenadas(lista) {
  const usadas = [...new Set(lista.map(catDe))];
  const ordenadas = [];
  for (const o of orden) {
    const m = usadas.find((u) => u.toLowerCase() === String(o).trim().toLowerCase());
    if (m && !ordenadas.includes(m)) ordenadas.push(m);
  }
  const resto = usadas.filter((u) => !ordenadas.includes(u) && u !== SIN_CAT).sort((a, b) => a.localeCompare(b, "es"));
  return [...ordenadas, ...resto, ...(usadas.includes(SIN_CAT) ? [SIN_CAT] : [])];
}

function render() {
  const disponibles = visibles();
  // Solo hay pestaña para categorías con artículos disponibles
  const cats = categoriasOrdenadas(disponibles);
  if (categoria !== TODOS && !cats.includes(categoria)) categoria = TODOS;
  const conTabs = cats.length > 1;
  $("#tabs").hidden = !conTabs;
  $("#tabs").innerHTML = conTabs
    ? [TODOS, ...cats].map((c) => `<button class="tab" role="tab" data-cat="${esc(c)}" aria-selected="${c === categoria}">${esc(c)}</button>`).join("")
    : "";

  let lista = categoria === TODOS ? disponibles : disponibles.filter((p) => catDe(p) === categoria);
  const q = normal(busqueda.trim());
  if (q) lista = lista.filter((p) => normal(`${p.nombre} ${p.categoria || ""}`).includes(q));

  $("#titulo").textContent = q ? `Resultados para “${busqueda.trim()}”` : categoria === TODOS ? "Todos los artículos" : categoria;
  $("#conteo").textContent = lista.length ? `${lista.length} artículo${lista.length === 1 ? "" : "s"}` : "";

  if (!lista.length) {
    if (q) aviso("Sin resultados", "Prueba con otra palabra o revisa otra categoría.");
    else aviso("Pronto tendremos novedades", "Por ahora no hay artículos disponibles en esta sección.");
    return;
  }
  $("#vacio").hidden = true;
  $("#grid").innerHTML = lista.map(tarjeta).join("");
}

function precioHtml(p) {
  if (!enOferta(p)) return `<div class="precio">${esc(precio(p.precio))}</div>`;
  const verAhorro = p.mostrarAhorro !== false;
  return `<div class="precio"><span class="oferta">${esc(precio(p.precioOferta))}</span>${
    verAhorro ? `<span class="viejo">${esc(precio(p.precio))}</span>` : ""
  }</div>`;
}

const stickerDe = (p) => (enOferta(p) && p.mostrarAhorro !== false ? `Oferta -${descuento(p)}%` : "");

function tarjeta(p) {
  const st = stickerDe(p);
  const wa = waLink(textoProducto(p.nombre, precioFinal(p)));
  const nombre = esc(p.nombre);
  return `<article class="prod" data-id="${esc(p.id)}">
    <button class="ph" data-a="ver" aria-label="Ver ${nombre}">
      <img src="${esc(fotoUrl(p.imagen))}" alt="${nombre}" loading="lazy">
      ${st ? `<span class="sticker">${esc(st)}</span>` : ""}
    </button>
    <div class="info">
      ${p.categoria ? `<span class="cat">${esc(p.categoria)}</span>` : ""}
      <h3 data-a="ver">${nombre}</h3>
      ${precioHtml(p)}
      <div class="acciones">
        <button class="add" data-a="add" aria-label="Agregar ${nombre} al carrito">${ICONOS.bolsa}<span>Agregar</span></button>
        ${wa ? `<a class="wa-mini" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Pedir ${nombre} por WhatsApp" title="Pedir por WhatsApp">${ICONOS.chat}</a>` : ""}
      </div>
    </div>
  </article>`;
}

function agregarAlCarrito(p, n = 1) {
  const agregadas = cart.agregar({ id: p.id, nombre: p.nombre, precio: precioFinal(p), imagen: p.imagen || "", stock: stockDe(p) }, n);
  if (!agregadas) {
    toast("No hay más unidades disponibles de este artículo", "err");
    return false;
  }
  toast(`${p.nombre} agregado al carrito`);
  const b = $("#cartN");
  b.classList.remove("bump");
  void b.offsetWidth;
  b.classList.add("bump");
  return true;
}

$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  categoria = b.dataset.cat;
  render();
});

let tBusqueda;
$("#buscar").addEventListener("input", (e) => {
  clearTimeout(tBusqueda);
  tBusqueda = setTimeout(() => {
    busqueda = e.target.value;
    if (cargado) render();
  }, 150);
});

$("#grid").addEventListener("click", (e) => {
  const accion = e.target.closest("[data-a]");
  const card = e.target.closest(".prod");
  if (!accion || !card) return;
  const p = productos.find((x) => x.id === card.dataset.id);
  if (!p || stockDe(p) <= 0) return;
  if (accion.dataset.a === "add") agregarAlCarrito(p);
  else if (accion.dataset.a === "ver") abrirDetalle(p);
});

/* ---------- Ficha de detalle ---------- */
let enDetalle = null;
let cantDetalle = 1;

$("#detCerrar").innerHTML = ICONOS.cerrar;
$("#btnClose").innerHTML = ICONOS.cerrar;

function bloquear() {
  document.body.classList.toggle("lock", !$("#detalle").hidden || !$("#drawer").hidden);
}

function pintarCantidad() {
  $("#detCant").textContent = cantDetalle;
  if (enDetalle) {
    const wa = waLink(textoProducto(enDetalle.nombre, precioFinal(enDetalle), cantDetalle));
    $("#detWa").hidden = !wa;
    if (wa) $("#detWa").href = wa;
  }
}

function abrirDetalle(p) {
  enDetalle = p;
  cantDetalle = 1;
  $("#detImg").src = fotoUrl(p.imagen, 900);
  $("#detImg").alt = p.nombre;
  $("#detCat").textContent = p.categoria || "";
  $("#detCat").hidden = !p.categoria;
  $("#detNombre").textContent = p.nombre;
  $("#detPrecio").innerHTML = precioHtml(p).replace(/^<div class="precio">|<\/div>$/g, "");
  const st = stickerDe(p);
  $("#detSticker").textContent = st;
  $("#detSticker").hidden = !st;
  const ahorro = enOferta(p) && p.mostrarAhorro !== false ? Number(p.precio) - Number(p.precioOferta) : 0;
  $("#detAhorro").textContent = ahorro ? `Ahorras ${precio(ahorro)}` : "";
  $("#detAhorro").hidden = !ahorro;
  $("#detNota").innerHTML = `${ICONOS.tienda}<span>Retira en tienda o pide envío a domicilio al confirmar tu pedido.</span>`;
  $("#detAgregar").innerHTML = `${ICONOS.bolsa}<span>Agregar al carrito</span>`;
  $("#detWa").innerHTML = `${ICONOS.chat}<span>Pedir por WhatsApp</span>`;
  pintarCantidad();
  $("#detalle").hidden = false;
  $("#detFondo").hidden = false;
  bloquear();
  $("#detCerrar").focus();
}

function cerrarDetalle() {
  $("#detalle").hidden = true;
  $("#detFondo").hidden = true;
  enDetalle = null;
  bloquear();
}

$("#detCerrar").addEventListener("click", cerrarDetalle);
$("#detFondo").addEventListener("click", cerrarDetalle);
$("#detMenos").addEventListener("click", () => {
  cantDetalle = Math.max(1, cantDetalle - 1);
  pintarCantidad();
});
$("#detMas").addEventListener("click", () => {
  if (!enDetalle) return;
  // Límite silencioso: no se muestra cuántas unidades hay
  const maximo = stockDe(enDetalle) - cart.cantidadDe(enDetalle.id);
  if (cantDetalle >= maximo) return toast("No hay más unidades disponibles", "err");
  cantDetalle++;
  pintarCantidad();
});
$("#detAgregar").addEventListener("click", () => {
  if (enDetalle && agregarAlCarrito(enDetalle, cantDetalle)) cerrarDetalle();
});

/* ---------- Carrito ---------- */
function renderCart() {
  // Ajusta el carrito a las existencias actuales (sin revelarlas)
  if (cargado) {
    for (const it of cart.items()) {
      const p = productos.find((x) => x.id === it.id);
      if (!p || stockDe(p) <= 0) cart.quitar(it.id);
    }
  }
  const totalItems = cart.cantidadTotal();
  $("#cartN").textContent = totalItems;
  $("#cartN").hidden = !totalItems;
  $("#cartTotal").textContent = precio(cart.subtotal());
  const its = cart.items();
  $("#cartFoot").hidden = !its.length;
  const wa = waLink(textoConsulta(its));
  $("#btnWaCart").hidden = !wa || !its.length;
  if (wa) $("#btnWaCart").href = wa;
  $("#btnWaCart").innerHTML = `${ICONOS.chat}<span>Consultar por WhatsApp</span>`;
  $("#cartBody").innerHTML = its.length
    ? its
        .map(
          (i) => `<div class="linea" data-id="${esc(i.id)}">
        <img src="${esc(fotoUrl(i.imagen, 160))}" alt="">
        <div><div class="nom">${esc(i.nombre)}</div><div class="sub">${esc(precio(i.precio))} c/u</div>
          <div class="qty"><button data-d="-1" aria-label="Menos">−</button><span>${i.cant}</span><button data-d="1" aria-label="Más">+</button></div></div>
        <button class="rm" aria-label="Quitar ${esc(i.nombre)}">${ICONOS.basura}</button>
      </div>`
        )
        .join("")
    : `<div class="carrito-vacio">${ICONOS.bolsa}<b>Tu carrito está vacío</b>Explora el catálogo y agrega tus favoritos.</div>`;
}

const abrirCarrito = (v) => {
  $("#drawer").hidden = !v;
  $("#overlay").hidden = !v;
  bloquear();
};
$("#btnCart").addEventListener("click", () => abrirCarrito(true));
$("#btnClose").addEventListener("click", () => abrirCarrito(false));
$("#overlay").addEventListener("click", () => abrirCarrito(false));

$("#cartBody").addEventListener("click", (e) => {
  const linea = e.target.closest(".linea");
  if (!linea) return;
  const id = linea.dataset.id;
  const d = e.target.closest("[data-d]");
  if (d) {
    const antes = cart.cantidadDe(id);
    cart.cambiar(id, Number(d.dataset.d));
    if (Number(d.dataset.d) > 0 && cart.cantidadDe(id) === antes) toast("No hay más unidades disponibles", "err");
  } else if (e.target.closest(".rm")) cart.quitar(id);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("#detalle").hidden) cerrarDetalle();
  else if (!$("#drawer").hidden) abrirCarrito(false);
});

window.addEventListener("cart:change", renderCart);
renderCart();

// Botón flotante de WhatsApp (consultas generales)
if (tienda.whatsapp) {
  const f = $("#waFlot");
  f.href = waLink(textoConsulta([]));
  f.hidden = false;
}
