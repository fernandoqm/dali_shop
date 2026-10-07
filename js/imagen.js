import { cloudinary } from "./config.js";

// Redimensiona y convierte a WebP en el navegador (foto de celular 4-6 MB -> ~60-120 KB)
export async function comprimir(file, maxLado = 1000, calidad = 0.75) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", calidad));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}

// Sube a Cloudinary con upload preset "unsigned". Devuelve la URL segura.
export async function subir(blob) {
  const fd = new FormData();
  fd.append("file", blob, "producto.webp");
  fd.append("upload_preset", cloudinary.uploadPreset);
  if (cloudinary.carpeta) fd.append("folder", cloudinary.carpeta);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "Error subiendo a Cloudinary");
  return data.secure_url;
}
