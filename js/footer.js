import { alConfig, cacheado } from "./tiendaconfig.js";
import { tienda } from "./config.js";
import { esc } from "./util.js";
import { ICONOS } from "./iconos.js";
import { waLink, textoConsulta } from "./notificar.js";

const partir = (t) => String(t || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
const multilinea = (t) => esc(t).replace(/\n/g, "<br>");

export function pintarFooter(cfg) {
  const el = document.getElementById("footer");
  if (!el || !cfg) return;
  const tels = partir(cfg.telefonos);
  const dir = (cfg.direccion || "").trim();
  const correo = (cfg.correoContacto || "").trim();
  const horario = (cfg.horario || "").trim();
  const wa = waLink(textoConsulta([]));

  const visita = [];
  if (dir)
    visita.push(`<li>${ICONOS.pin}<div><span>${multilinea(dir)}</span>
      <a class="foot-mapa" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}" target="_blank" rel="noopener">Ver en el mapa</a></div></li>`);
  if (horario) visita.push(`<li>${ICONOS.reloj}<span>${multilinea(horario)}</span></li>`);

  const contacto = [];
  // Números de 8 dígitos se muestran como 8564-6198
  const formato = (t) => (/^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4)}` : t);
  for (const t of tels) contacto.push(`<li>${ICONOS.telefono}<a href="tel:${esc(t.replace(/[^\d+]/g, ""))}">${esc(formato(t))}</a></li>`);
  if (correo) contacto.push(`<li>${ICONOS.correo}<a href="mailto:${esc(correo)}">${esc(correo)}</a></li>`);

  const columna = (titulo, items) => (items.length ? `<div class="foot-col"><h3>${titulo}</h3><ul>${items.join("")}</ul></div>` : "");

  el.innerHTML = `<div class="wrap">
    <div class="foot-main">
      <div class="foot-marca">
        <a class="foot-logo" href="./"><img src="img/logo.webp" alt="" width="56" height="56"><span>${esc(tienda.nombre)}</span></a>
        <p>Artículos para el hogar, la oficina y tu día a día. Recoge en un punto acordado o recibe tu pedido donde estés.</p>
        ${wa ? `<a class="foot-wa" href="${esc(wa)}" target="_blank" rel="noopener">${ICONOS.chat}<span>Escríbenos por WhatsApp</span></a>` : ""}
      </div>
      ${columna("Atención", visita)}
      ${columna("Contacto", contacto)}
      <div class="foot-col"><h3>Tienda</h3><ul class="foot-links">
        <li><a href="./">Catálogo</a></li>
        <li><a href="pedido.html">Mi carrito y pedido</a></li>
      </ul></div>
    </div>
    <div class="foot-bar">
      <p>© ${new Date().getFullYear()} ${esc(tienda.nombre)}. Todos los derechos reservados.</p>
      <button class="foot-arriba" type="button" aria-label="Volver arriba">${ICONOS.arriba}<span>Arriba</span></button>
    </div>
  </div>`;
  el.querySelector(".foot-arriba").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  el.hidden = false;
}

export function iniciarFooter() {
  pintarFooter(cacheado());
  alConfig(pintarFooter);
}
