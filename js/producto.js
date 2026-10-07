// Lógica compartida de precios/ofertas

export const enOferta = (p) => !!p.oferta && Number(p.precioOferta) > 0 && Number(p.precioOferta) < Number(p.precio);

export const precioFinal = (p) => (enOferta(p) ? Number(p.precioOferta) : Number(p.precio));

export const descuento = (p) => (enOferta(p) ? Math.round((1 - Number(p.precioOferta) / Number(p.precio)) * 100) : 0);
