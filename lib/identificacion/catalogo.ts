import { db } from "@/db";
import { productos } from "@/db/schema";
import {
  getCatalogoVidaDigital,
  type ProductoCatalogoVD,
} from "@/db/vidadigital/queries";

export interface GrupoCatalogo {
  /** Código preseleccionado. Siempre pertenece a `codigos` y va primero. */
  codigo: string;
  /** Variantes del mismo producto; el resto en orden alfabético. */
  codigos: string[];
  detalle: string | null;
  imagenUrl: string;
}

// Palabras que no distinguen un producto de otro.
const BOILERPLATE = new Set([
  "TIPO", "M", "COD", "NOMBRE", "MODELO", "MARCA", "DE", "PARA", "CON",
  "VIDA", "DIGITAL", "ANIL", "PZA", "UN", "INF", "ADIC",
]);

const NOMBRE_RE = /^\s*NOMBRE\s*:\s*([^;]+)/i;

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Clave de agrupación: trim + espacios colapsados + MAYÚSCULAS,
 *  sin sufijo "(ANIL)" ni prefijo "VD-". */
export function claveBase(codigo: string): string {
  return codigo
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .replace(/\s*\(ANIL\)$/, "")
    .replace(/^VD-/, "")
    .trim();
}

function sinDiacriticos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function tokens(texto: string): string[] {
  return texto.match(/[A-Z0-9]+/g) ?? [];
}

/**
 * Tokens comparables del detalle. Si el detalle trae el formato
 * "NOMBRE: X; MODELO: ...; MARCA: ...", solo se tokeniza X (AJUSTE 3).
 * Se quitan los tokens del propio código y el boilerplate.
 */
function tokensDetalle(detalle: string, codigo: string): string[] {
  const nombre = NOMBRE_RE.exec(detalle);
  const texto = nombre ? nombre[1] : detalle;
  const propios = new Set(tokens(sinDiacriticos(codigo)));
  return tokens(sinDiacriticos(texto)).filter(
    (t) => !propios.has(t) && !BOILERPLATE.has(t)
  );
}

function mismoProducto(a: ProductoCatalogoVD, b: ProductoCatalogoVD): boolean {
  if (a.detalle === null || b.detalle === null) return false;
  const ta = tokensDetalle(a.detalle, a.codigo);
  const tb = tokensDetalle(b.detalle, b.codigo);
  if (ta.length === 0 || tb.length === 0) return false;
  if (ta[0] === tb[0]) return true;

  const sa = new Set(ta);
  const sb = new Set(tb);
  let interseccion = 0;
  for (const t of sa) if (sb.has(t)) interseccion++;
  const union = sa.size + sb.size - interseccion;
  return union > 0 && interseccion / union >= 0.5;
}

function elegirAncla(
  cluster: readonly ProductoCatalogoVD[],
  base: string
): ProductoCatalogoVD {
  const exacta = cluster.find((f) => f.codigo === base);
  if (exacta) return exacta;
  return [...cluster].sort(
    (a, b) => a.codigo.length - b.codigo.length || cmp(a.codigo, b.codigo)
  )[0];
}

function armarGrupo(
  miembros: readonly ProductoCatalogoVD[],
  propios: ReadonlySet<string>
): GrupoCatalogo {
  const ordenados = miembros.map((m) => m.codigo).sort(cmp);
  const codigo =
    ordenados.find((c) => propios.has(c.trim().toUpperCase())) ?? ordenados[0];
  const fila = miembros.find((m) => m.codigo === codigo)!;
  return {
    codigo,
    codigos: [codigo, ...ordenados.filter((c) => c !== codigo)],
    detalle: fila.detalle,
    imagenUrl: fila.imagenUrl,
  };
}

/**
 * Agrupa códigos del mismo producto con política conservadora: una variante
 * solo se une al ancla si pasa el gate de descripción (primer token igual o
 * Jaccard >= 0.5). Ante duda quedan grupos separados (falso negativo).
 */
export function agruparCatalogo(
  filas: readonly ProductoCatalogoVD[],
  codigosPropios: ReadonlySet<string>
): GrupoCatalogo[] {
  // Dedupe defensivo por código exacto (el query ya deduplica).
  const porCodigo = new Map<string, ProductoCatalogoVD>();
  for (const f of filas) if (!porCodigo.has(f.codigo)) porCodigo.set(f.codigo, f);

  const clusters = new Map<string, ProductoCatalogoVD[]>();
  for (const f of porCodigo.values()) {
    const base = claveBase(f.codigo);
    if (base === "") continue;
    const cluster = clusters.get(base);
    if (cluster) cluster.push(f);
    else clusters.set(base, [f]);
  }

  const propios = new Set([...codigosPropios].map((c) => c.trim().toUpperCase()));
  const grupos: GrupoCatalogo[] = [];
  for (const [base, cluster] of clusters) {
    const ancla = elegirAncla(cluster, base);
    const miembros = [ancla];
    for (const f of cluster) {
      if (f === ancla) continue;
      // Rechazado por el gate: queda como grupo propio (entrada separada).
      if (mismoProducto(ancla, f)) miembros.push(f);
      else grupos.push(armarGrupo([f], propios));
    }
    grupos.push(armarGrupo(miembros, propios));
  }

  return grupos.sort((a, b) => cmp(a.codigo, b.codigo));
}

/** IO: catálogo VD (solo SELECT) + códigos de la tabla productos propia. */
export async function getCatalogoIdentificacion(): Promise<GrupoCatalogo[]> {
  const [filas, propios] = await Promise.all([
    getCatalogoVidaDigital(),
    db.select({ codigo: productos.codigo }).from(productos),
  ]);
  return agruparCatalogo(filas, new Set(propios.map((p) => p.codigo)));
}
