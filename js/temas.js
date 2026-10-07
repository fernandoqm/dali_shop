import { alConfig } from "./tiendaconfig.js";

const BASE = new URL("../temas/", import.meta.url).href;
const KEY = "dali_tema";

const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return r.json();
};

let listaCache = null;

// Lee temas/temas.json y la ficha de cada tema
export async function listarTemas() {
  if (listaCache) return listaCache;
  const { porDefecto = "clasico", temas } = await json(BASE + "temas.json");
  const fichas = await Promise.all(
    temas.map((id) => json(`${BASE}${id}/tema.json`).then((m) => ({ id, ...m })).catch(() => null))
  );
  listaCache = { porDefecto, temas: fichas.filter(Boolean) };
  return listaCache;
}

const aNum = (md) => {
  const [m, d] = md.split("-").map(Number);
  return m * 100 + d;
};

// Tema que corresponde a la fecha según los rangos "auto" de cada tema.json
export function temaAuto({ porDefecto, temas }, f = new Date()) {
  const hoy = (f.getMonth() + 1) * 100 + f.getDate();
  for (const t of temas) {
    for (const r of t.auto || []) {
      const a = aNum(r.desde), b = aNum(r.hasta);
      if (a <= b ? hoy >= a && hoy <= b : hoy >= a || hoy <= b) return t.id;
    }
  }
  return porDefecto;
}

// Cambia la hoja de estilos del tema (y opcionalmente el mensaje superior)
export function aplicarTema(id, mensaje) {
  let link = document.getElementById("tema-css");
  if (!link) {
    link = document.createElement("link");
    link.id = "tema-css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const href = `${BASE}${id}/tema.css`;
  if (link.getAttribute("href") !== href) link.href = href;
  const b = document.getElementById("banner");
  if (b && mensaje !== undefined) {
    b.textContent = mensaje;
    b.hidden = !mensaje;
  }
}

async function resolver(cfg) {
  const lista = await listarTemas();
  let id = cfg?.tema || lista.porDefecto;
  if (id === "auto") id = temaAuto(lista);
  const ficha = lista.temas.find((t) => t.id === id) || lista.temas.find((t) => t.id === lista.porDefecto);
  const id2 = ficha?.id || lista.porDefecto;
  const msg = cfg?.mostrarMensaje === false ? "" : (cfg?.mensaje || "").trim() || ficha?.saludo || "";
  return { id: id2, msg };
}

// Aplica al instante el último tema usado en el dispositivo y luego sincroniza con Firestore
export function iniciarTema() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (c?.id) aplicarTema(c.id, c.msg);
  } catch {}
  alConfig(async (cfg) => {
    try {
      const { id, msg } = await resolver(cfg);
      aplicarTema(id, msg);
      try {
        localStorage.setItem(KEY, JSON.stringify({ id, msg }));
      } catch {}
    } catch (e) {
      console.warn("No se pudo cargar el tema", e);
    }
  });
}
