import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase.js";

// Un solo listener de config/tienda compartido por tema, pie de página, etc.
const KEY = "dali_cfg";
const oyentes = [];
let ultimo = null;
let iniciado = false;

export const cacheado = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};

export function alConfig(fn) {
  oyentes.push(fn);
  if (ultimo) fn(ultimo);
  if (iniciado) return;
  iniciado = true;
  onSnapshot(
    doc(db, "config", "tienda"),
    (s) => {
      ultimo = s.exists() ? s.data() : {};
      try {
        localStorage.setItem(KEY, JSON.stringify(ultimo));
      } catch {}
      oyentes.forEach((f) => f(ultimo));
    },
    () => {}
  );
}
