import { tienda } from "./config.js";

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const precio = (n) => `${tienda.moneda}${Number(n || 0).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Miniatura optimizada de Cloudinary (WebP/AVIF automático y ancho limitado)
export function miniatura(url, ancho = 500) {
  if (!url || !url.includes("/upload/")) return url || "";
  return url.replace("/upload/", `/upload/c_limit,w_${ancho},q_auto,f_auto/`);
}

export function toast(msg, tipo = "ok") {
  let box = $("#toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
