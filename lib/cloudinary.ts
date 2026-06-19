"use server";

const CLOUD_NAME = "dbl8yxnjy"; // Arjun
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function extraerPublicId(url: string | null): string | null {
  if (!url) return null;
  // Solo URLs del Cloudinary de Arjun
  if (!url.includes(`res.cloudinary.com/${CLOUD_NAME}/`)) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  return match ? match[1].replace(/\.[^.]+$/, "") : null;
}

export async function subirImagen(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Formato no permitido. Usá JPEG, PNG o WebP");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Imagen demasiado grande. Máximo 10MB");
  }

  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!key || !secret) {
    throw new Error("CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET requeridos");
  }

  // Comprimir con sharp
  const sharp = (await import("sharp")).default;
  const buffer = Buffer.from(await file.arrayBuffer());
  const compressed = await sharp(buffer)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Subir a Cloudinary
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(compressed)], { type: "image/jpeg" })
  );
  formData.append("upload_preset", "arjun-products");
  formData.append("api_key", key);

  const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload falló: ${err}`);
  }

  const data = (await res.json()) as {
    secure_url: string;
    public_id: string;
  };
  return data.secure_url;
}

export async function eliminarImagen(url: string): Promise<void> {
  const publicId = extraerPublicId(url);
  if (!publicId) return; // no es de Arjun, no tocar

  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!key || !secret) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await generarFirma(publicId, timestamp, secret);

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("api_key", key);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
    { method: "POST", body: formData }
  );
}

async function generarFirma(
  publicId: string,
  timestamp: number,
  secret: string
): Promise<string> {
  const { createHash } = await import("node:crypto");
  const params = `public_id=${publicId}&timestamp=${timestamp}${secret}`;
  return createHash("sha1").update(params).digest("hex");
}
