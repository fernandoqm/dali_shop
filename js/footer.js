import { alConfig, cacheado } from "./tiendaconfig.js";
import { tienda } from "./config.js";
import { esc } from "./util.js";

const partir = (t) => String(t || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

export function pintarFooter(cfg) {
  const el = document.getElementById("footer");
  if (!el || !cfg) return;
  const tels = partir(cfg.telefonos);
  const dir = (cfg.direccion || "").trim();
  const correo = (cfg.correoContacto || "").trim();
  const horario = (cfg.horario || "").trim();

  const filas = [];
  if (dir) filas.push(`<div><strong>Estamos ubicados en</strong><br>${esc(dir).replace(/\n/g, "<br>")}</div>`);
  if (tels.length)
    filas.push(`<div><strong>Teléfonos</strong><br>${tels.map((t) => `<a href="tel:${esc(t.replace(/[^\d+]/g, ""))}">${esc(t)}</a>`).join("<br>")}</div>`);
  if (correo) filas.push(`<div><strong>Correo</strong><br><a href="mailto:${esc(correo)}">${esc(correo)}</a></div>`);
  if (horario) filas.push(`<div><strong>Horario</strong><br>${esc(horario).replace(/\n/g, "<br>")}</div>`);

  el.innerHTML = `<div class="wrap">
    ${filas.length ? `<div class="foot-grid">${filas.join("")}</div>` : ""}
    <p class="foot-copy">© ${new Date().getFullYear()} ${esc(tienda.nombre)}</p>
  </div>`;
  el.hidden = false;
}

export function iniciarFooter() {
  pintarFooter(cacheado());
  alConfig(pintarFooter);
}
