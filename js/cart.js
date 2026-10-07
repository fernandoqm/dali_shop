const KEY = "dali_cart";

export function leer() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function guardar(c) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
  window.dispatchEvent(new Event("cart:change"));
}

export const items = () => Object.values(leer());
export const cantidadTotal = () => items().reduce((a, i) => a + i.cant, 0);
export const subtotal = () => items().reduce((a, i) => a + i.cant * i.precio, 0);

// p: {id, nombre, precio, imagen, stock}. Devuelve cuántas unidades se agregaron (0 si no hay más disponibles)
export function agregar(p, n = 1) {
  const c = leer();
  const actual = c[p.id]?.cant || 0;
  const nueva = Math.min(p.stock, actual + Math.max(1, n));
  if (nueva <= actual) return 0;
  c[p.id] = { id: p.id, nombre: p.nombre, precio: p.precio, imagen: p.imagen, stock: p.stock, cant: nueva };
  guardar(c);
  return nueva - actual;
}

export const cantidadDe = (id) => leer()[id]?.cant || 0;

export function cambiar(id, delta) {
  const c = leer();
  if (!c[id]) return;
  c[id].cant = Math.min(c[id].stock, c[id].cant + delta);
  if (c[id].cant <= 0) delete c[id];
  guardar(c);
}

export function quitar(id) {
  const c = leer();
  delete c[id];
  guardar(c);
}

export function vaciar() {
  guardar({});
}
