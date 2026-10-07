// Completa estos valores (Firebase Console > Configuración del proyecto > Tus apps > Web)
export const firebaseConfig = {
  apiKey: "AIzaSyCpsSbmVKS-yVyAM0bSoqvswRHTpy6XYKw",
  authDomain: "dali-shop.firebaseapp.com",
  projectId: "dali-shop",
  appId: "1:1092300268902:web:9d25c2eaeb9d47f80494a7"
};

// Cloudinary: cloudName está en el Dashboard; uploadPreset debe ser "Unsigned" (Settings > Upload > Upload presets)
export const cloudinary = {
  cloudName: "p2js7vpn",
  uploadPreset: "dali_shop",
  carpeta: "dali_shop"
};

export const tienda = {
  nombre: "Dali Shop",
  moneda: "¢",              // símbolo que se muestra antes del precio
  whatsapp: "50685646198",           // con código de país y sin signos, ej. 50612345678. Vacío = sin botón de WhatsApp
  costoEnvio: 0             // se suma al total cuando el cliente elige envío
};

// true cuando ya reemplazaste los valores de ejemplo de Firebase
export const configurado = !String(firebaseConfig.apiKey).startsWith("TU_");

// Aviso de pedidos por correo con EmailJS (https://www.emailjs.com). Si dejas vacío, no se envía correo.
export const emailjs = {
  serviceId: "service_if94c4f",
  templateId: "template_hfr8b4k",
  publicKey: "s7gPzEIwmgM-GPZZI"
};
