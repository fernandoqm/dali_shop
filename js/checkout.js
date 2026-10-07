import { doc, collection, runTransaction, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { tienda } from "./config.js";
import { $, esc, precio } from "./util.js";
import { precioFinal } from "./producto.js";
import * as cart from "./cart.js";
import { iniciarTema } from "./temas.js";
import { iniciarFooter } from "./footer.js";
import { waLink, textoPedido, enviarCorreo } from "./notificar.js";

iniciarTema();
iniciarFooter();

const form = $("#form");
let enviando = false;

function pintar() {
  const its = cart.items();
  $("#vacio").hidden = its.length > 0 || !$("#exito").hidden;
  form.hidden = its.length === 0;
  if (!its.length) return;

  const envio = form.tipo.value === "envio";
  const costo = envio ? Number(tienda.costoEnvio) || 0 : 0;
  $("#lineas").innerHTML = its
    .map(
      (i) => `<div class="linea" data-id="${esc(i.id)}" style="grid-template-columns:1fr auto">
      <div><div class="nom">${esc(i.nombre)}</div><div class="sub">${esc(precio(i.precio))} c/u</div>
        <div class="qty"><button type="button" data-d="-1" aria-label="Menos">−</button><span>${i.cant}</span><button type="button" data-d="1" aria-label="Más">+</button></div></div>
      <div style="text-align:right"><b>${esc(precio(i.precio * i.cant))}</b><br><button type="button" class="rm" aria-label="Quitar">&times;</button></div>
    </div>`
    )
    .join("");
  $("#rowEnvio").hidden = !(envio && costo > 0);
  $("#costoEnvio").textContent = precio(costo);
  $("#total").textContent = precio(cart.subtotal() + costo);
  $("#lblDir").hidden = !envio;
}

$("#lineas").addEventListener("click", (e) => {
  const linea = e.target.closest(".linea");
  if (!linea) return;
  const d = e.target.closest("[data-d]");
  if (d) cart.cambiar(linea.dataset.id, Number(d.dataset.d));
  else if (e.target.closest(".rm")) cart.quitar(linea.dataset.id);
});
form.addEventListener("change", pintar);
window.addEventListener("cart:change", pintar);

const mostrarError = (m) => {
  $("#error").textContent = m;
  $("#error").hidden = !m;
};

const codigoPedido = () => (Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4)).toUpperCase();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enviando) return;
  mostrarError("");

  const nombre = form.nombre.value.trim();
  const telefono = form.telefono.value.trim();
  const tipo = form.tipo.value;
  const direccion = form.direccion.value.trim();
  if (!nombre) return mostrarError("Escribe tu nombre.");
  if (telefono.replace(/\D/g, "").length < 7) return mostrarError("Escribe un teléfono válido.");
  if (tipo === "envio" && !direccion) return mostrarError("Escribe la dirección de entrega.");

  const its = cart.items();
  const costoEnvio = tipo === "envio" ? Number(tienda.costoEnvio) || 0 : 0;
  const codigo = codigoPedido();
  enviando = true;
  $("#btnEnviar").disabled = true;
  $("#btnEnviar").textContent = "Enviando…";

  try {
    const resumen = await runTransaction(db, async (tx) => {
      // Lee todos los artículos primero (requisito de Firestore) y valida existencias con datos actuales
      const refs = its.map((i) => doc(db, "productos", i.id));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      const lineas = [];
      snaps.forEach((s, idx) => {
        const i = its[idx];
        const p = s.exists() ? s.data() : null;
        if (!p || !p.activo) throw new Error(`"${i.nombre}" ya no está disponible.`);
        const stock = Number(p.cantidad) || 0;
        if (stock < i.cant) throw new Error(stock <= 0 ? `"${p.nombre}" se agotó.` : `De "${p.nombre}" solo quedan ${stock}.`);
        lineas.push({ id: s.id, nombre: p.nombre, precio: precioFinal(p), cant: i.cant, nuevoStock: stock - i.cant });
      });
      const subtotal = lineas.reduce((a, l) => a + l.precio * l.cant, 0);
      lineas.forEach((l, idx) => tx.update(refs[idx], { cantidad: l.nuevoStock }));
      tx.set(doc(collection(db, "pedidos")), {
        codigo,
        cliente: { nombre, telefono },
        tipo,
        direccion: tipo === "envio" ? direccion : "",
        notas: form.notas.value.trim(),
        items: lineas.map(({ id, nombre, precio, cant }) => ({ id, nombre, precio, cant })),
        subtotal,
        costoEnvio,
        total: subtotal + costoEnvio,
        estado: "nuevo",
        fecha: serverTimestamp()
      });
      return { lineas, total: subtotal + costoEnvio };
    });

    cart.vaciar();
    const datos = { codigo, nombre, telefono, tipo, direccion, notas: form.notas.value.trim(), lineas: resumen.lineas, total: resumen.total };
    getDoc(doc(db, "config", "tienda"))
      .then((s) => enviarCorreo(datos, s.exists() ? s.data().correoPedidos : ""))
      .catch((e) => console.warn("No se pudo enviar el correo del pedido", e));
    exito(datos);
  } catch (err) {
    console.error(err);
    const propio = err instanceof Error && /^"|^De "/.test(err.message);
    mostrarError(propio ? `${err.message} Ajusta tu carrito e intenta de nuevo.` : "No se pudo enviar el pedido. Revisa tu conexión e intenta de nuevo.");
  } finally {
    enviando = false;
    $("#btnEnviar").disabled = false;
    $("#btnEnviar").textContent = "Confirmar pedido";
  }
});

function exito(datos) {
  form.hidden = true;
  $("#vacio").hidden = true;
  $("#exito").hidden = false;
  $("#codigo").textContent = datos.codigo;
  $("#textoExito").textContent =
    datos.tipo === "envio" ? "Te contactaremos para coordinar el envío." : "Te avisaremos cuando esté listo para recoger.";
  const link = waLink(textoPedido(datos));
  if (link) {
    const a = $("#btnWa");
    a.href = link;
    a.hidden = false;
  }
}

pintar();
