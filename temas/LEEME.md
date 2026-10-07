# Temas de Dali Shop

Un tema es una carpeta dentro de `temas/`, como en WordPress.

```
temas/
  temas.json            <- lista de temas disponibles
  navidad/
    tema.json           <- nombre, descripción, mensaje, colores de la vista previa y fechas automáticas
    tema.css            <- colores y estilos del tema
    (imágenes, etc.)    <- opcional; en el CSS se usan con url("imagen.png")
```

## Crear un tema nuevo
1. Copia una carpeta existente, por ejemplo `navidad`, y renómbrala (`pascua`, `black_friday`...). Sin espacios ni tildes.
2. Edita `tema.json`:
   - `nombre`: como se verá en el admin.
   - `saludo`: mensaje que aparece arriba de la tienda (puede quedar vacío).
   - `colores`: tres colores para la vista previa en el admin.
   - `auto`: rangos de fechas `MM-DD` para el modo "Automático por fecha". Puede cruzar el año (`"11-25"` a `"01-06"`).
3. Edita `tema.css`: cambia las variables de `:root` y agrega los estilos que quieras.
4. Agrega el id de la carpeta a la lista de `temas.json`.
5. Sube los cambios a GitHub. El tema aparece en el admin → Apariencia.

## Variables disponibles
`--bg` (fondo), `--card` (tarjetas), `--ink` (texto), `--muted` (texto secundario), `--line` (bordes),
`--brand` y `--brand-d` (color principal y hover), `--on-brand` (texto sobre el color principal),
`--offer` (sticker de oferta), `--soft` y `--tint` (fondos suaves).

## Piezas que se pueden decorar
`.top` (encabezado), `.banner` (mensaje superior), `.prod` (tarjeta de artículo), `.sticker` (oferta),
`.foot` (pie de página), `body`.

Solo se carga el `tema.css` del tema activo. Respeta `prefers-reduced-motion` si agregas animaciones.
