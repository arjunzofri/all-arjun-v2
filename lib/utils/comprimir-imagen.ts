// Cliente: comprime la foto antes de enviarla. Sin dependencias externas.
export const MAX_LADO = 1280;
export const MAX_DATA = 1_000_000;

/** Lado mayor <= max, proporciones intactas. Función pura. */
export function dimensionesEscaladas(ancho: number, alto: number, max: number) {
  if (ancho <= 0 || alto <= 0) return { ancho: 0, alto: 0 };
  const mayor = Math.max(ancho, alto);
  if (mayor <= max) return { ancho, alto };
  const factor = max / mayor;
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) };
}

/** Igual que urlMiniatura() de lib/identificacion/fichas.ts, duplicada a
 * propósito: fichas.ts es server-only y este módulo lo importa un client. */
export function miniaturaCloudinary(imagenUrl: string, px: number): string {
  return imagenUrl.includes("/upload/")
    ? imagenUrl.replace("/upload/", `/upload/w_${px},h_${px},c_pad,b_white,f_jpg,q_70/`)
    : imagenUrl;
}

function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

function codificar(img: HTMLImageElement, ancho: number, alto: number, calidad: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = ancho; canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(img, 0, 0, ancho, alto);
  return canvas.toDataURL("image/jpeg", calidad).split(",")[1] ?? "";
}

/** JPEG <= 1280px; si el base64 supera MAX_DATA baja calidad y luego a 1024px. */
export async function comprimirImagen(file: File): Promise<{ data: string; mimeType: "image/jpeg" }> {
  const img = await cargarImagen(file);
  let tam = dimensionesEscaladas(img.naturalWidth, img.naturalHeight, MAX_LADO);
  for (const calidad of [0.8, 0.7, 0.6, 0.5]) {
    const data = codificar(img, tam.ancho, tam.alto, calidad);
    if (data.length <= MAX_DATA) return { data, mimeType: "image/jpeg" };
  }
  tam = dimensionesEscaladas(img.naturalWidth, img.naturalHeight, 1024);
  return { data: codificar(img, tam.ancho, tam.alto, 0.8), mimeType: "image/jpeg" };
}
