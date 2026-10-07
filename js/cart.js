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

// p: {id, nombre, precio, imagen, stock}
export function agregar(p) {
  const c = leer();
  const actual = c[p.id]?.cant || 0;
  if (actual >= p.stock) return false;
  c[p.id] = { id: p.id, nombre: p.nombre, precio: p.precio, imagen: p.imagen, stock: p.stock, cant: actual + 1 };
  guardar(c);
  return true;
}

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
