# Dali Shop

Tienda estática (HTML/JS) para GitHub Pages con Firebase (Firestore + Auth) y Cloudinary (imágenes).

## Páginas
- `index.html`: catálogo con pestañas por categoría y carrito.
- `pedido.html`: datos del cliente, recoger o envío.
- `IngresoShopAdmin/`: administración (`https://fernandoqm.github.io/dali_shop/IngresoShopAdmin/`).

## Configuración
1. `js/config.js`: datos de Firebase, Cloudinary (cloud name y upload preset **unsigned**), moneda, WhatsApp y costo de envío.
2. Firebase Console → Firestore Database → Reglas: pega `firestore.rules` y cambia `CORREO_DEL_ADMIN@ejemplo.com` por el correo del administrador.
3. Firebase Console → Authentication → Settings → Authorized domains: agrega `fernandoqm.github.io`.
4. Firebase Console → Authentication → Sign-in method: deja activo solo Correo/contraseña y no permitas registro público de otros usuarios.

## Probar en local
Los módulos ES no funcionan abriendo el archivo con doble clic. Usa un servidor local:

```
npx serve .
```

## Publicar
Settings → Pages → Deploy from a branch → `main` / `(root)`.

## Datos
- `productos`: nombre, categoria, precio, cantidad, imagen, activo, oferta, precioOferta, mostrarAhorro, fecha.
- `pedidos`: codigo, cliente, tipo, direccion, notas, items, subtotal, costoEnvio, total, estado, fecha.

## Comportamiento
- Las pestañas se arman con las categorías de los artículos visibles; una categoría sin artículos no aparece.
- Con cantidad 0 el artículo se muestra gris, con "Agotado" y no se puede agregar.
- En oferta, el sticker muestra precio normal y de oferta si "Mostrar sticker" está activo; si no, solo el precio de oferta.
- Al confirmar un pedido se descuentan las existencias; al cancelarlo desde el panel se devuelven.

## Temas de temporada
- Se eligen en el admin → pestaña Apariencia (Clásico, Navidad, Halloween, San Valentín, Día de la Madre, Verano, Otoño o Automático por fecha).
- Se guardan en Firestore (`config/tienda`) y la tienda los aplica a todos los clientes sin volver a publicar.
- El mensaje superior usa el del tema, o uno personalizado; también se puede ocultar.
- Para crear un tema nuevo o ajustar las fechas del modo automático, edita `js/temas.js`.
