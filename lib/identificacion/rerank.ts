import { llamarGeminiJson, type GeminiPart } from "./gemini";
import { parteImagen, type ImagenEntrada } from "./describir";
import { urlMiniatura } from "./fichas";
import type { ItemCatalogo } from "./preseleccion";

export interface OpcionIdentificada {
  codigo: string;
  razon: string;
}

const CONCURRENCIA_DESCARGA = 12;
const TIMEOUT_DESCARGA_MS = 8_000;
const TAMANO_TANDA = 24;
const N_FINALISTAS = 3;

/** Miniaturas de Cloudinary en base64. Las que fallan se omiten (no lanza). */
export async function descargarMiniaturas(
  items: ItemCatalogo[],
  px = 320
): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  const cola = [...items];

  const trabajadores = Array.from(
    { length: Math.min(CONCURRENCIA_DESCARGA, cola.length) },
    async () => {
      for (let item = cola.shift(); item; item = cola.shift()) {
        try {
          const respuesta = await fetch(urlMiniatura(item.imagenUrl, px), {
            signal: AbortSignal.timeout(TIMEOUT_DESCARGA_MS),
          });
          if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
          salida.set(
            item.codigo,
            Buffer.from(await respuesta.arrayBuffer()).toString("base64")
          );
        } catch (e) {
          const motivo = e instanceof Error ? e.message : String(e);
          console.warn(`[rerank] miniatura omitida ${item.codigo}: ${motivo}`);
        }
      }
    }
  );

  await Promise.all(trabajadores);
  return salida;
}

/** Prompt del rerank de poc2.cjs, idéntico. */
function promptRerank(cantidad: number, n: number): string {
  return `Imagen 0 = foto de bodega de UN producto (puede estar en su caja, con poca luz). Luego vienen ${cantidad} fotos de catalogo, cada una precedida por su codigo. Elige los ${n} codigos que mas probablemente son EXACTAMENTE el mismo producto (mismo modelo y misma caja/diseno, no solo la misma categoria). Compara textos impresos, colores de la caja y forma. Devuelve SOLO JSON {"top":[{"codigo":"","confianza":0-100,"razon":""}]}`;
}

/**
 * Rerank visual de una tanda. La confianza del modelo se descarta: la PoC
 * mostró que acierta igual con 95-100% en respuestas equivocadas.
 */
export async function rerankTanda(
  img: ImagenEntrada,
  items: ItemCatalogo[],
  miniaturas: Map<string, string>,
  n = N_FINALISTAS
): Promise<OpcionIdentificada[]> {
  const conMiniatura = items.filter((i) => miniaturas.has(i.codigo));
  if (conMiniatura.length === 0) return [];

  const codigos = new Set(conMiniatura.map((i) => i.codigo));
  const parts: GeminiPart[] = [
    { text: promptRerank(conMiniatura.length, n) },
    parteImagen(img),
  ];
  for (const item of conMiniatura) {
    parts.push({ text: `Codigo: ${item.codigo}` });
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: miniaturas.get(item.codigo)!,
      },
    });
  }

  const respuesta = await llamarGeminiJson<{ top?: unknown }>(parts, {
    razonamiento: "modelo",
    timeoutMs: 40_000,
  });

  const salida: OpcionIdentificada[] = [];
  const vistos = new Set<string>();
  const crudos = Array.isArray(respuesta?.top) ? respuesta.top : [];

  for (const crudo of crudos) {
    if (typeof crudo !== "object" || crudo === null) continue;
    const o = crudo as Record<string, unknown>;
    const codigo = typeof o.codigo === "string" ? o.codigo : "";
    if (!codigos.has(codigo) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    salida.push({
      codigo,
      razon: typeof o.razon === "string" ? o.razon.trim() : "",
    });
    if (salida.length >= n) break;
  }
  return salida;
}

/**
 * Descarga miniaturas una sola vez, parte en tandas de 24 en paralelo y, si
 * sobran finalistas, hace una ronda final con todos ellos.
 */
export async function rerankPorTandas(
  img: ImagenEntrada,
  items: ItemCatalogo[],
  opciones: { tamanoTanda?: number; n?: number } = {}
): Promise<OpcionIdentificada[]> {
  const tamanoTanda = opciones.tamanoTanda ?? TAMANO_TANDA;
  const n = opciones.n ?? N_FINALISTAS;

  const miniaturas = await descargarMiniaturas(items);
  const validos = items.filter((i) => miniaturas.has(i.codigo));
  if (validos.length === 0) return [];

  const tandas: ItemCatalogo[][] = [];
  for (let i = 0; i < validos.length; i += tamanoTanda) {
    tandas.push(validos.slice(i, i + tamanoTanda));
  }

  const resultados = await Promise.allSettled(
    tandas.map((tanda) => rerankTanda(img, tanda, miniaturas, n))
  );
  if (resultados.every((r) => r.status === "rejected")) {
    throw new Error("Fallo el rerank de todas las tandas");
  }

  const finalistas: OpcionIdentificada[] = [];
  const vistos = new Set<string>();
  for (const resultado of resultados) {
    if (resultado.status !== "fulfilled") continue;
    for (const opcion of resultado.value) {
      if (vistos.has(opcion.codigo)) continue;
      vistos.add(opcion.codigo);
      finalistas.push(opcion);
    }
  }

  if (finalistas.length <= n) return finalistas;

  const porCodigo = new Map(validos.map((i) => [i.codigo, i]));
  const itemsFinales = finalistas
    .map((f) => porCodigo.get(f.codigo))
    .filter((i): i is ItemCatalogo => Boolean(i));
  return rerankTanda(img, itemsFinales, miniaturas, n);
}
