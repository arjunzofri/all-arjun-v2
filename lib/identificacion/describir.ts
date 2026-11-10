import { z } from "zod";
import { llamarGeminiJson, type GeminiPart } from "./gemini";

export interface ImagenEntrada {
  /** base64 sin prefijo data:. */
  data: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface InfoFoto {
  tipo_producto_es: string;
  tipo_producto_en: string;
  marca: string;
  modelo: string;
  codigos_visibles: string[];
  textos_visibles: string[];
  palabras_clave: string[];
  color: string;
}

// Prompt A de la PoC, idéntico.
const PROMPT_A =
  'Foto tomada con celular en una bodega de un producto importado (en su caja). Devuelve SOLO JSON: {"tipo_producto_es":"","tipo_producto_en":"","marca":"","modelo":"","codigos_visibles":[],"textos_visibles":[],"palabras_clave":["8-15 palabras en espanol e ingles para buscar en un catalogo"],"color":""}. Transcribe textos tal cual aparecen; no inventes.';

export function parteImagen(img: ImagenEntrada): GeminiPart {
  return { inline_data: { mime_type: img.mimeType, data: img.data } };
}

const texto = z.unknown().transform((v) => (typeof v === "string" ? v.trim() : ""));
const lista = z.unknown().transform((v) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : []
);

const esquema = z
  .object({
    tipo_producto_es: texto,
    tipo_producto_en: texto,
    marca: texto,
    modelo: texto,
    codigos_visibles: lista,
    textos_visibles: lista,
    palabras_clave: lista,
    color: texto,
  })
  .transform((v) => ({
    ...v,
    palabras_clave: v.palabras_clave.slice(0, 15),
    textos_visibles: v.textos_visibles.slice(0, 12),
  }));

export async function describirFoto(img: ImagenEntrada): Promise<InfoFoto> {
  const respuesta = await llamarGeminiJson<unknown>(
    [{ text: PROMPT_A }, parteImagen(img)],
    { razonamiento: "low", timeoutMs: 15_000 }
  );

  const parseado = esquema.safeParse(respuesta);
  if (!parseado.success) throw new Error("No se pudo describir la foto");

  const info = parseado.data;
  if (!info.tipo_producto_es && !info.tipo_producto_en) {
    throw new Error("No se pudo describir la foto");
  }
  return info;
}
