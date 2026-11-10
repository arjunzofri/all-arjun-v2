import { llamarGeminiJson } from "./gemini";
import { parteImagen, type ImagenEntrada, type InfoFoto } from "./describir";
import type { GrupoCatalogo } from "./catalogo";
import type { FichaVisual } from "./fichas";

export interface ItemCatalogo {
  codigo: string;
  codigos: string[];
  detalle: string | null;
  imagenUrl: string;
  ficha: FichaVisual | null;
}

// Normalización idéntica a la PoC (poc2.cjs).
const norm = (s: string) =>
  (s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const toks = (s: string) =>
  norm(s).split(/[^A-Z0-9]+/).filter((t) => t.length >= 2);
const alnum = (s: string) => norm(s).replace(/[^A-Z0-9]/g, "");

function fichaTexto(f: FichaVisual | null): string {
  if (!f) return "";
  return [f.tipo_es, f.tipo_en, f.colores.join(" "), f.textos.join(" "), f.marca, f.rasgos].join(" ");
}

/** Un item por grupo; ficha del código preseleccionado o de una variante. */
export function armarItemsCatalogo(
  grupos: GrupoCatalogo[],
  fichas: Map<string, { ficha: FichaVisual }>
): ItemCatalogo[] {
  return grupos.map((g) => {
    const ficha =
      fichas.get(g.codigo)?.ficha ??
      g.codigos.map((c) => fichas.get(c)?.ficha).find(Boolean) ??
      null;
    return {
      codigo: g.codigo,
      codigos: g.codigos,
      detalle: g.detalle,
      imagenUrl: g.imagenUrl,
      ficha,
    };
  });
}

/** Scoring de keywordSearch de poc2.cjs; considera todos los códigos del grupo. */
export function buscarPorPalabras(
  info: InfoFoto,
  items: ItemCatalogo[],
  n = 30
): string[] {
  const kws = new Set(
    [...info.palabras_clave, info.tipo_producto_es, info.tipo_producto_en, info.marca]
      .flatMap(toks)
  );
  const txts = new Set(info.textos_visibles.flatMap(toks).filter((t) => t.length >= 3));
  const cols = new Set(toks(info.color));
  const models = [info.modelo, ...info.codigos_visibles]
    .filter(Boolean)
    .map(alnum)
    .filter((m) => m.length >= 3);

  return items
    .map((item) => {
      const all = `${item.detalle ?? ""} ${item.codigos.join(" ")} ${fichaTexto(item.ficha)}`;
      const dt = new Set(toks(all));
      const da = alnum(all);
      const ct = new Set(toks((item.ficha?.textos ?? []).join(" ")));
      const cc = new Set(toks((item.ficha?.colores ?? []).join(" ")));

      let s = 0;
      for (const k of kws) if (dt.has(k)) s += 1;
      for (const t of txts) if (ct.has(t)) s += 2;
      for (const c of cols) if (cc.has(c)) s += 1;
      for (const m of models) if (da.includes(m)) s += 8;
      return { item, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.item.codigo);
}

/** Línea del LIST de poc2.cjs. */
export function lineaCatalogo(item: ItemCatalogo): string {
  const f = item.ficha;
  return `${item.codigo} | ${(item.detalle ?? "").replace(/\s+/g, " ").trim()} | ${f?.tipo_es ?? ""}; ${(f?.colores ?? []).join("/")}; ${(f?.textos ?? []).filter((t) => !/c[oó]digo|x caja/i.test(t)).join(", ")}`;
}

function promptB(lista: string, info: InfoFoto, n: number): string {
  return `Catalogo (codigo | descripcion | ficha visual: tipo; colores; textos de la caja):\n${lista}\n\nLa imagen es una foto de bodega de UN producto. Descripcion extraida: ${JSON.stringify(info)}.\nDevuelve SOLO JSON {"candidatos":["codigo",...]} con los ${n} codigos mas probables, del mas al menos probable. Usa colores y textos de la caja. Solo codigos de la lista.`;
}

/** Prompt B de poc2.cjs; mapea variantes al código del grupo. */
export async function preseleccionarConModelo(
  img: ImagenEntrada,
  info: InfoFoto,
  items: ItemCatalogo[],
  n = 30
): Promise<string[]> {
  const lista = items.map(lineaCatalogo).join("\n");
  const respuesta = await llamarGeminiJson<{ candidatos?: unknown }>(
    [{ text: promptB(lista, info, n) }, parteImagen(img)],
    { razonamiento: "low", timeoutMs: 25_000 }
  );

  const porCodigo = new Map<string, string>();
  for (const item of items) for (const c of item.codigos) porCodigo.set(c, item.codigo);

  const crudos = Array.isArray(respuesta?.candidatos)
    ? respuesta.candidatos.filter((c): c is string => typeof c === "string")
    : [];

  const salida: string[] = [];
  for (const crudo of crudos) {
    const codigo = porCodigo.get(crudo);
    if (codigo && !salida.includes(codigo)) salida.push(codigo);
    if (salida.length >= n) break;
  }
  return salida;
}

/** llm primero, luego kw, dedupe, cap. */
export function unirCandidatos(llm: string[], kw: string[], max = 48): string[] {
  const salida: string[] = [];
  for (const c of [...llm, ...kw]) {
    if (!salida.includes(c)) salida.push(c);
    if (salida.length >= max) break;
  }
  return salida;
}

export async function preseleccionar(
  img: ImagenEntrada,
  info: InfoFoto,
  items: ItemCatalogo[]
): Promise<{ candidatos: string[]; llm: string[]; kw: string[]; errorModelo?: string }> {
  const kw = buscarPorPalabras(info, items);
  let llm: string[] = [];
  let errorModelo: string | undefined;

  try {
    llm = await preseleccionarConModelo(img, info, items);
  } catch (e) {
    errorModelo = e instanceof Error ? e.message : String(e);
  }

  return {
    candidatos: unirCandidatos(llm, kw),
    llm,
    kw,
    ...(errorModelo ? { errorModelo } : {}),
  };
}
