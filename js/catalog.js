import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { $, esc, precio, miniatura, toast } from "./util.js";
import { enOferta, precioFinal, descuento } from "./producto.js";
import * as cart from "./cart.js";
import { iniciarTema } from "./temas.js";
import { configurado } from "./config.js";

iniciarTema();

let cargado = false;
const aviso = (t) => {
  $("#vacio").hidden = false;
  $("#vacio").textContent = t;
};
if (!configurado) aviso("Falta configurar Firebase en js/config.js. Cuando lo completes aquí aparecerá el catálogo.");
else setTimeout(() => !cargado && aviso("No se pudo cargar el catálogo. Revisa tu conexión y las reglas de Firestore."), 8000);

let productos = [];
let categoria = "Todos";
const TODOS = "Todos";
const SIN_CAT = "Otros";

const catDe = (p) => (p.categoria || "").trim() || SIN_CAT;
const stockDe = (p) => Math.max(0, Number(p.cantidad) || 0);

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
    $("#vacio").hidden = false;
    $("#vacio").textContent = "No se pudo cargar el catálogo. Intenta de nuevo en un momento.";
  }
);

function render() {
  const cats = [...new Set(productos.map(catDe))].sort((a, b) => a.localeCompare(b, "es"));
  if (categoria !== TODOS && !cats.includes(categoria)) categoria = TODOS;

  // Solo se muestran pestañas de categorías que tienen artículos
  const nombres = cats.length > 1 ? [TODOS, ...cats] : cats;
  if (cats.length <= 1) categoria = TODOS;
  $("#tabs").innerHTML = nombres
    .map((c) => `<button class="tab" role="tab" data-cat="${esc(c)}" aria-selected="${(c === categoria) || (cats.length <= 1)}">${esc(c)}</button>`)
    .join("");
  $("#tabs").hidden = cats.length <= 1;

  const lista = categoria === TODOS ? productos : productos.filter((p) => catDe(p) === categoria);
  $("#vacio").hidden = lista.length > 0;
  if (!lista.length) $("#vacio").textContent = "No hay artículos disponibles por ahora.";
  $("#grid").innerHTML = lista.map(tarjeta).join("");
}

function tarjeta(p) {
  const stock = stockDe(p);
  const agotado = stock <= 0;
  const of = enOferta(p);
  const verAhorro = of && p.mostrarAhorro !== false;

  const sticker = verAhorro
    ? `<div class="sticker">OFERTA -${descuento(p)}%<small>Antes ${esc(precio(p.precio))}</small></div>`
    : "";
  const precioHtml = of
    ? `<div class="precio">${verAhorro ? `<span class="viejo">${esc(precio(p.precio))}</span>` : ""}<span class="oferta">${esc(precio(p.precioOferta))}</span></div>`
    : `<div class="precio">${esc(precio(p.precio))}</div>`;

  return `<article class="prod ${agotado ? "agotado" : ""}" data-id="${esc(p.id)}">
    <div class="ph">
      ${p.imagen ? `<img src="${esc(miniatura(p.imagen))}" alt="${esc(p.nombre)}" loading="lazy">` : ""}
      ${agotado ? "" : sticker}
      ${agotado ? `<span class="agotado-tag">Agotado</span>` : ""}
    </div>
    <div class="info">
      <h3>${esc(p.nombre)}</h3>
      ${precioHtml}
      ${!agotado && stock <= 3 ? `<span class="stock-bajo">Quedan ${stock}</span>` : ""}
      <button class="add" ${agotado ? "disabled" : ""}>${agotado ? "Agotado" : "Agregar"}</button>
    </div>
  </article>`;
}

$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  categoria = b.dataset.cat;
  render();
});

$("#grid").addEventListener("click", (e) => {
  const card = e.target.closest(".prod");
  if (!card) return;
  const p = productos.find((x) => x.id === card.dataset.id);
  if (!p || stockDe(p) <= 0) return;
  const ok = cart.agregar({ id: p.id, nombre: p.nombre, precio: precioFinal(p), imagen: p.imagen || "", stock: stockDe(p) });
  ok ? toast(`${p.nombre} agregado`) : toast("Ya tienes todas las existencias en tu carrito", "err");
});

/* ---- Carrito ---- */
function renderCart() {
  // Ajusta el carrito a las existencias y precios actuales
  for (const it of cart.items()) {
    const p = productos.find((x) => x.id === it.id);
    if (!p || stockDe(p) <= 0) cart.quitar(it.id);
  }
  $("#cartN").textContent = cart.cantidadTotal();
  $("#cartTotal").textContent = precio(cart.subtotal());
  const its = cart.items();
  $("#btnPedido").style.display = its.length ? "" : "none";
  $("#cartBody").innerHTML = its.length
    ? its
        .map(
          (i) => `<div class="linea" data-id="${esc(i.id)}">
        ${i.imagen ? `<img src="${esc(miniatura(i.imagen, 150))}" alt="">` : `<div class="noimg"></div>`}
        <div><div class="nom">${esc(i.nombre)}</div><div class="sub">${esc(precio(i.precio))}</div>
          <div class="qty"><button data-d="-1" aria-label="Menos">−</button><span>${i.cant}</span><button data-d="1" aria-label="Más">+</button></div></div>
        <button class="rm" aria-label="Quitar">&times;</button>
      </div>`
        )
        .join("")
    : `<p class="vacio" style="padding:30px 0">Tu carrito está vacío.</p>`;
}

const abrir = (v) => {
  $("#drawer").hidden = !v;
  $("#overlay").hidden = !v;
};
$("#btnCart").addEventListener("click", () => abrir(true));
$("#btnClose").addEventListener("click", () => abrir(false));
$("#overlay").addEventListener("click", () => abrir(false));

$("#cartBody").addEventListener("click", (e) => {
  const linea = e.target.closest(".linea");
  if (!linea) return;
  const id = linea.dataset.id;
  const d = e.target.closest("[data-d]");
  if (d) cart.cambiar(id, Number(d.dataset.d));
  else if (e.target.closest(".rm")) cart.quitar(id);
});

window.addEventListener("cart:change", renderCart);
renderCart();
