import { tienda, emailjs } from "./config.js";
import { precio, esc } from "./util.js";

export const waLink = (texto) =>
  tienda.whatsapp ? `https://wa.me/${tienda.whatsapp}?text=${encodeURIComponent(texto)}` : "";

// items: [{nombre, cant}]
export const listaTexto = (items) => items.map((l) => `• ${l.cant} x ${l.nombre}`).join("\n");

export const textoConsulta = (items) =>
  items.length
    ? `Hola, me interesa consultar por:\n${listaTexto(items)}`
    : "Hola, quisiera hacer una consulta sobre sus artículos.";

// Consulta por un artículo puntual desde su tarjeta o ficha
export const textoProducto = (nombre, precioUnidad, cant = 1, enlace = "") =>
  `Hola, me interesa este artículo:\n• ${cant} x ${nombre} (${precio(precioUnidad)} c/u)\n¿Está disponible?` + (enlace ? `\n${enlace}` : "");

export function textoPedido({ codigo, nombre, tipo, direccion, lineas, total }) {
  return (
    `Hola, soy ${nombre}. Quiero confirmar mi pedido ${codigo} (${tipo === "envio" ? "envío" : "retiro en punto acordado"}):\n` +
    `${listaTexto(lineas)}\nTotal: ${precio(total)}${tipo === "envio" ? " + envío (por confirmar según el mensajero)" : ""}` +
    (tipo === "envio" && direccion ? `\nDirección: ${direccion}` : "")
  );
}

// Envía el aviso del pedido al correo del negocio mediante EmailJS (no bloquea el pedido si falla)
export async function enviarCorreo(p, para) {
  const { serviceId, templateId, publicKey } = emailjs;
  if (!serviceId || !templateId || !publicKey || !para) return;
  const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: para,
        codigo: p.codigo,
        nombre: p.nombre,
        telefono: p.telefono,
        tipo: p.tipo === "envio" ? "Envío (costo por confirmar según el mensajero)" : "Retiro en punto acordado",
        direccion: p.direccion || "—",
        notas: p.notas || "—",
        pedido: p.lineas.map((l) => `${l.cant} x ${l.nombre} (${precio(l.precio)} c/u)`).join("\n"),
        // Versión para plantillas HTML: usar {{{pedido_html}}} (triple llave) para respetar los saltos de línea
        pedido_html: p.lineas.map((l) => `• ${esc(String(l.cant))} x ${esc(l.nombre)} (${esc(precio(l.precio))} c/u)`).join("<br>"),
        total: precio(p.total)
      }
    })
  });
  if (!r.ok) throw new Error(`EmailJS ${r.status}`);
}
