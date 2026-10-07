import { cloudinary } from "./config.js";

const MAX_LADO = 1000;      // px del lado más largo
const MAX_BYTES = 200 * 1024; // objetivo de peso final

// Carga la imagen respetando la orientación EXIF (las fotos de celular suelen venir "acostadas")
async function cargar(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {}
  try {
    return await createImageBitmap(file);
  } catch {}
  // Respaldo para navegadores sin createImageBitmap: <img> aplica la orientación EXIF por sí solo
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

const aBlob = (canvas, tipo, calidad) => new Promise((res) => canvas.toBlob(res, tipo, calidad));

// Redimensiona y convierte a WebP (o JPEG si el navegador no sabe crear WebP).
// Una foto de celular de 4-6 MB queda en unos 50-150 KB.
export async function comprimir(file) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo no es una imagen");
  const bmp = await cargar(file);
  const ancho = bmp.width || bmp.naturalWidth;
  const alto = bmp.height || bmp.naturalHeight;
  const escala = Math.min(1, MAX_LADO / Math.max(ancho, alto));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();

  let tipo = "image/webp";
  let blob = await aBlob(canvas, tipo, 0.75);
  if (!blob || blob.type !== "image/webp") {
    // Safari antiguo devuelve PNG al pedir WebP: usamos JPEG, que sí comprime
    tipo = "image/jpeg";
    blob = await aBlob(canvas, tipo, 0.78);
  }
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  // Si aún pesa mucho, baja la calidad por pasos
  for (let q = 0.65; blob.size > MAX_BYTES && q >= 0.4; q -= 0.1) {
    blob = (await aBlob(canvas, tipo, q)) || blob;
  }
  return blob;
}

// Sube a Cloudinary con upload preset "unsigned". Devuelve la URL segura.
export async function subir(blob) {
  const fd = new FormData();
  fd.append("file", blob, blob.type === "image/webp" ? "producto.webp" : "producto.jpg");
  fd.append("upload_preset", cloudinary.uploadPreset);
  if (cloudinary.carpeta) fd.append("folder", cloudinary.carpeta);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "Error subiendo a Cloudinary");
  return data.secure_url;
}
