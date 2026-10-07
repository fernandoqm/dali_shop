import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase.js";

const base = { "--bg": "#faf6f1", "--card": "#ffffff", "--ink": "#2b2622", "--muted": "#7a6f66", "--line": "#e8dfd5", "--on-brand": "#ffffff" };

// Para agregar un tema nuevo basta con sumar una entrada aquí.
export const TEMAS = {
  clasico: { nombre: "Dali (negro y dorado)", saludo: "", vars: { ...base, "--bg": "#faf7f0", "--brand": "#9a6b0c", "--brand-d": "#7a5409", "--offer": "#d9342b", "--soft": "#efe7d4", "--tint": "#f8edd2" } },
  navidad: { nombre: "Navidad", saludo: "🎄 ¡Feliz Navidad! Regalos para el hogar", vars: { ...base, "--bg": "#fbf5f0", "--brand": "#b3202a", "--brand-d": "#8a1720", "--offer": "#1f7a3d", "--soft": "#f1e4dc", "--tint": "#fbe9e9" } },
  halloween: { nombre: "Halloween", saludo: "🎃 Ofertas de miedo", vars: { "--bg": "#1f1a24", "--card": "#2a2430", "--ink": "#f3ece4", "--muted": "#b3a8bd", "--line": "#3d3447", "--on-brand": "#ffffff", "--brand": "#c85a0a", "--brand-d": "#a84a05", "--offer": "#8b3fd1", "--soft": "#3a3242", "--tint": "#3d2f22" } },
  san_valentin: { nombre: "San Valentín", saludo: "💝 Detalles para quien más quieres", vars: { ...base, "--bg": "#fff5f8", "--brand": "#c2185b", "--brand-d": "#9c1249", "--offer": "#e11d48", "--soft": "#f8e1ea", "--tint": "#fde7f0" } },
  dia_madre: { nombre: "Día de la Madre", saludo: "🌸 Feliz Día de la Madre", vars: { ...base, "--bg": "#fbf5fa", "--brand": "#a24b8f", "--brand-d": "#823b72", "--offer": "#d9342b", "--soft": "#efdcec", "--tint": "#f6e6f3" } },
  verano: { nombre: "Verano", saludo: "☀️ Ofertas de verano", vars: { ...base, "--bg": "#f3fbfc", "--brand": "#0b7d96", "--brand-d": "#08647a", "--offer": "#e8590c", "--soft": "#d9eef2", "--tint": "#dff3f7" } },
  otono: { nombre: "Otoño", saludo: "🍂 Renueva tu hogar", vars: { ...base, "--bg": "#fbf5ea", "--brand": "#b45309", "--brand-d": "#92400e", "--offer": "#b91c1c", "--soft": "#f0e2c8", "--tint": "#fbeacd" } }
};

// Selección automática por fecha (ajusta las fechas a tu país si hace falta)
export function temaAuto(f = new Date()) {
  const m = f.getMonth() + 1, d = f.getDate(), md = m * 100 + d;
  if (md >= 1125 || md <= 106) return "navidad";
  if (md >= 1015 && md <= 1102) return "halloween";
  if (md >= 201 && md <= 214) return "san_valentin";
  return "clasico";
}

const KEY = "dali_tema";

export function aplicar(id, mensaje) {
  const t = TEMAS[id] || TEMAS.clasico;
  const root = document.documentElement.style;
  Object.entries(t.vars).forEach(([k, v]) => root.setProperty(k, v));
  const b = document.getElementById("banner");
  if (b) {
    const txt = mensaje ?? t.saludo;
    b.textContent = txt;
    b.hidden = !txt;
  }
}

function resolver(cfg) {
  if (!cfg || cfg.tema === "auto" || !cfg.tema) return cfg?.tema === "auto" ? temaAuto() : "clasico";
  return TEMAS[cfg.tema] ? cfg.tema : "clasico";
}

function mensajeDe(cfg, id) {
  if (cfg?.mostrarMensaje === false) return "";
  return (cfg?.mensaje || "").trim() || TEMAS[id].saludo;
}

// Aplica al instante el último tema guardado en el dispositivo y luego se sincroniza con Firestore
export function iniciarTema() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (c) aplicar(c.id, c.msg);
  } catch {}
  onSnapshot(
    doc(db, "config", "tienda"),
    (s) => {
      const cfg = s.exists() ? s.data() : null;
      const id = resolver(cfg);
      const msg = mensajeDe(cfg, id);
      aplicar(id, msg);
      try {
        localStorage.setItem(KEY, JSON.stringify({ id, msg }));
      } catch {}
    },
    () => {}
  );
}
