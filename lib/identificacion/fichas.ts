import { createHash } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { productoFichasVisuales } from "@/db/schema";
import { llamarGeminiJson, type GeminiPart } from "./gemini";

export const PROMPT_FICHA_VERSION = "v1";

export interface FichaVisual {
  tipo_es: string;
  tipo_en: string;
  colores: string[];
  textos: string[];
  marca: string;
  rasgos: string;
}

export interface FichaGuardada {
  ficha: FichaVisual;
  imagenHash: string | null;
}

/** URL de Cloudinary a miniatura cuadrada, igual que la PoC (thumbs.cjs). */
export function urlMiniatura(imagenUrl: string, px = 320): string {
  if (!imagenUrl.includes("/upload/")) return imagenUrl;
  return imagenUrl.replace(
    "/upload/",
    `/upload/w_${px},h_${px},c_pad,b_white,f_jpg,q_70/`
  );
}

export function hashFicha(imagenUrl: string): string {
  return createHash("sha256")
    .update(`${imagenUrl}|${PROMPT_FICHA_VERSION}`)
    .digest("hex");
}

function textos(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function validarFicha(x: unknown): FichaVisual | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const tipo_es = texto(o.tipo_es);
  if (!tipo_es) return null;
  return {
    tipo_es,
    tipo_en: texto(o.tipo_en),
    colores: textos(o.colores),
    textos: textos(o.textos).slice(0, 8),
    marca: texto(o.marca),
    rasgos: texto(o.rasgos),
  };
}

// Prompt textual idéntico a caption.cjs.
const promptFicha = (n: number) =>
  `Vienen ${n} imagenes de catalogo, cada una precedida por su codigo. Para CADA una describe lo que se VE (producto y su caja). Devuelve SOLO JSON array: [{"codigo":"","tipo_es":"","tipo_en":"","colores":["colores del producto y de la caja"],"textos":["textos visibles en producto/caja, tal cual, max 8"],"marca":"","rasgos":"forma, material y detalles distintivos en 1 frase"}]. No inventes textos.`;

/** Miniaturas 320 + una sola llamada a Gemini. Omite las imágenes que fallan. */
export async function generarFichasLote(
  items: { codigo: string; imagenUrl: string }[]
): Promise<Map<string, FichaVisual>> {
  const parts: GeminiPart[] = [{ text: promptFicha(items.length) }];
  const incluidos = new Set<string>();

  for (const item of items) {
    try {
      const respuesta = await fetch(urlMiniatura(item.imagenUrl));
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const data = Buffer.from(await respuesta.arrayBuffer()).toString("base64");
      parts.push({ text: `Codigo: ${item.codigo}` });
      parts.push({ inline_data: { mime_type: "image/jpeg", data } });
      incluidos.add(item.codigo);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      console.warn(`[fichas] miniatura omitida ${item.codigo}: ${motivo}`);
    }
  }

  const resultado = new Map<string, FichaVisual>();
  if (incluidos.size === 0) return resultado;

  const respuesta = await llamarGeminiJson<unknown>(parts, { timeoutMs: 120_000 });
  for (const x of Array.isArray(respuesta) ? respuesta : []) {
    const codigo =
      typeof x === "object" && x !== null ? (x as { codigo?: unknown }).codigo : null;
    if (typeof codigo !== "string" || !incluidos.has(codigo)) continue;
    const ficha = validarFicha(x);
    if (ficha) resultado.set(codigo, ficha);
  }
  return resultado;
}

/** Fichas de la base propia. Sin `codigos` devuelve todas (una sola query). */
export async function getFichasVisuales(
  codigos?: readonly string[]
): Promise<Map<string, FichaGuardada>> {
  if (codigos && codigos.length === 0) return new Map();

  const base = db
    .select({
      codigo: productoFichasVisuales.codigo,
      ficha: productoFichasVisuales.ficha,
      imagenHash: productoFichasVisuales.imagenHash,
    })
    .from(productoFichasVisuales);
  const filas = codigos
    ? await base.where(inArray(productoFichasVisuales.codigo, [...codigos]))
    : await base;

  const mapa = new Map<string, FichaGuardada>();
  for (const fila of filas) {
    const ficha = validarFicha(fila.ficha);
    if (ficha) mapa.set(fila.codigo, { ficha, imagenHash: fila.imagenHash });
  }
  return mapa;
}

/** Upsert de un lote entero en una sola sentencia. */
export async function upsertFichas(
  filas: { codigo: string; ficha: FichaVisual; imagenHash: string; modelo: string }[]
): Promise<void> {
  if (filas.length === 0) return;
  await db
    .insert(productoFichasVisuales)
    .values(
      filas.map((f) => ({
        codigo: f.codigo,
        ficha: f.ficha,
        imagenHash: f.imagenHash,
        modelo: f.modelo,
      }))
    )
    .onConflictDoUpdate({
      target: productoFichasVisuales.codigo,
      set: {
        ficha: sql`excluded.ficha`,
        imagenHash: sql`excluded.imagen_hash`,
        modelo: sql`excluded.modelo`,
        generadoEn: sql`now()`,
      },
    });
}
