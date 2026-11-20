// Cliente: comprime la foto antes de enviarla. Sin dependencias externas.
export const MAX_LADO = 1280;
export const MAX_DATA = 1_000_000;

/** Error de reducción; su mensaje es apto para mostrar al usuario. */
export class ErrorImagen extends Error {}

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

function pintar(img: HTMLImageElement, ancho: number, alto: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = ancho; canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(img, 0, 0, ancho, alto);
  return canvas;
}

function codificar(img: HTMLImageElement, ancho: number, alto: number, calidad: number): string {
  return pintar(img, ancho, alto).toDataURL("image/jpeg", calidad).split(",")[1] ?? "";
}

export const MAX_LADO_SUBIDA = 2000;
export const MAX_PESO_SUBIDA = 3.5 * 1024 * 1024;

function aBlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new ErrorImagen("No se pudo reducir la imagen. Intente con otra foto."))),
      "image/jpeg",
      calidad
    )
  );
}

/** JPEG <= 3.5 MB para subir por /api/productos/[id]/imagen (límite Vercel 4.5 MB). */
export async function reducirImagenParaSubir(file: File): Promise<File> {
  let img: HTMLImageElement;
  try {
    img = await cargarImagen(file);
  } catch {
    throw new ErrorImagen("No se pudo leer la imagen. Intente con una foto JPG, PNG o WebP.");
  }
  for (const lado of [MAX_LADO_SUBIDA, 1600]) {
    const tam = dimensionesEscaladas(img.naturalWidth, img.naturalHeight, lado);
    const canvas = pintar(img, tam.ancho, tam.alto);
    for (const calidad of [0.85, 0.7, 0.55]) {
      const blob = await aBlob(canvas, calidad);
      if (blob.size <= MAX_PESO_SUBIDA) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
      }
    }
  }
  throw new ErrorImagen("No se pudo reducir la imagen. Intente con otra foto.");
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
