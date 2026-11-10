// server-only: usa DB (Neon) vía catalogo/fichas. No importar desde client components.
import { getCatalogoIdentificacion } from "./catalogo";
import { getFichasVisuales } from "./fichas";
import { armarItemsCatalogo, buscarPorPalabras, preseleccionar, type ItemCatalogo } from "./preseleccion";
import { describirFoto, type ImagenEntrada } from "./describir";
import { rerankPorTandas } from "./rerank";

export interface OpcionResultado {
  codigo: string;
  codigos: string[];
  detalle: string | null;
  imagenUrl: string;
  razon: string;
}

export interface ResultadoIdentificacion {
  opciones: OpcionResultado[];
  tiempos: { catalogoMs: number; describirMs: number; preseleccionMs: number; rerankMs: number; totalMs: number };
  candidatos: number;
  avisos: string[];
}

export class ErrorIdentificacion extends Error {
  readonly tipo: "tiempo" | "ia" | "foto";
  constructor(tipo: "tiempo" | "ia" | "foto", mensaje: string) {
    super(mensaje);
    this.name = "ErrorIdentificacion";
    this.tipo = tipo;
  }
}

const TTL_MS = 10 * 60_000;
const UMBRAL_RECORTE_MS = 22_000;
const MAX_RECORTE = 24;
let cache: { items: ItemCatalogo[]; expira: number } | null = null;

/** Solo para tests: olvida la cache en memoria. */
export function _resetCacheCatalogo(): void {
  cache = null;
}

/** Catálogo + fichas con cache TTL 10 min; ante fallo usa la cache vencida con aviso. */
export async function getItemsCatalogo(ahora = Date.now()): Promise<{ items: ItemCatalogo[]; avisos: string[] }> {
  if (cache && ahora < cache.expira) return { items: cache.items, avisos: [] };
  try {
    const [grupos, fichas] = await Promise.all([getCatalogoIdentificacion(), getFichasVisuales()]);
    const items = armarItemsCatalogo(grupos, fichas);
    cache = { items, expira: ahora + TTL_MS };
    return { items, avisos: [] };
  } catch (e) {
    console.error(`[identificacion] catalogo: ${e instanceof Error ? e.message : String(e)}`);
    if (cache) return { items: cache.items, avisos: ["catalogo desactualizado"] };
    throw new ErrorIdentificacion("ia", "No se pudo cargar el catalogo");
  }
}

/** Traduce los errores de etapa a los tres tipos públicos del orquestador. */
function comoError(e: unknown): ErrorIdentificacion {
  if (e instanceof ErrorIdentificacion) return e;
  if (e instanceof Error && e.message === "No se pudo describir la foto") return new ErrorIdentificacion("foto", e.message);
  return new ErrorIdentificacion("ia", e instanceof Error ? e.message : String(e));
}

/** Corre la etapa contra el presupuesto restante; al vencer lanza error "tiempo". */
function conPlazo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let rechazar!: (e: ErrorIdentificacion) => void;
  const limite = new Promise<never>((_, r) => { rechazar = r; });
  const t = setTimeout(() => rechazar(new ErrorIdentificacion("tiempo", "Presupuesto agotado")), Math.max(0, ms));
  return Promise.race([promesa, limite]).finally(() => clearTimeout(t));
}

export async function identificarProducto(
  img: ImagenEntrada,
  opciones: { presupuestoMs?: number } = {}
): Promise<ResultadoIdentificacion> {
  const presupuestoMs = opciones.presupuestoMs ?? 45_000;
  const inicio = Date.now();
  const restante = () => presupuestoMs - (Date.now() - inicio);
  const avisos: string[] = [];

  const tCatalogo = Date.now();
  const { items, avisos: avisosCatalogo } = await getItemsCatalogo();
  const catalogoMs = Date.now() - tCatalogo;
  avisos.push(...avisosCatalogo);

  const tDescribir = Date.now();
  let info;
  try { info = await conPlazo(describirFoto(img), restante()); } catch (e) { throw comoError(e); }
  const describirMs = Date.now() - tDescribir;

  const tPreseleccion = Date.now();
  let pre;
  try {
    pre = await conPlazo(preseleccionar(img, info, items), restante());
  } catch (e) {
    const kw = e instanceof ErrorIdentificacion && e.tipo === "tiempo" ? buscarPorPalabras(info, items) : [];
    if (!kw.length) throw comoError(e);
    pre = { candidatos: kw, llm: [], kw, errorModelo: "Presupuesto agotado" };
  }
  const preseleccionMs = Date.now() - tPreseleccion;
  if (pre.errorModelo) avisos.push("preseleccion por modelo fallo; se uso busqueda por palabras");

  const restanteTrasPreseleccion = restante();
  if (restanteTrasPreseleccion <= 0) throw new ErrorIdentificacion("tiempo", "Presupuesto agotado");
  let candidatos = pre.candidatos;
  if (restanteTrasPreseleccion < UMBRAL_RECORTE_MS) {
    candidatos = candidatos.slice(0, MAX_RECORTE);
    avisos.push("candidatos recortados por tiempo");
  }

  const porCodigo = new Map(items.map((i) => [i.codigo, i]));
  const itemsRerank = candidatos.map((c) => porCodigo.get(c)).filter((i): i is ItemCatalogo => Boolean(i));

  const tRerank = Date.now();
  let identificadas;
  try { identificadas = await conPlazo(rerankPorTandas(img, itemsRerank), restante()); } catch (e) { throw comoError(e); }
  const rerankMs = Date.now() - tRerank;

  const resultado = identificadas.flatMap((o): OpcionResultado[] => {
    const item = porCodigo.get(o.codigo);
    return item ? [{ codigo: item.codigo, codigos: item.codigos, detalle: item.detalle, imagenUrl: item.imagenUrl, razon: o.razon }] : [];
  });

  return {
    opciones: resultado,
    tiempos: { catalogoMs, describirMs, preseleccionMs, rerankMs, totalMs: Date.now() - inicio },
    candidatos: itemsRerank.length,
    avisos,
  };
}
