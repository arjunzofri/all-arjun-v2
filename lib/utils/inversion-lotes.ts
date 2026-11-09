import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { productos, stock } from "@/db/schema";
import { getVidaDigitalClient } from "@/db/vidadigital";
import type { LoteCompra } from "./inversion-fifo";

interface LoteRow {
  codigo: string;
  folio: string;
  fecha: string | null;
  precdocd: string | number | null;
  cantidad: string | number;
}

export interface StockCodigo {
  /** Suma real (sin clamp), solo filas con suma > 0. */
  stock: number;
  detalle: string | null;
}

/**
 * Lotes de compra de varios códigos, leídos de Vida Digital (vida + sanjh)
 * en una query por esquema. Solo lectura. `codunico` entra en DISTINCT ON
 * y GROUP BY para que dos códigos con el mismo nº de folio no se mezclen.
 *
 * Las líneas de itemdcto vienen duplicadas por un artefacto de importación
 * (kdocitem ' 13' vs '13', knumdocu '001957' vs '000000001957'). Se toma
 * una sola fila por (código, folio, kdocitem normalizado) antes de sumar;
 * líneas distintas del mismo código en el mismo folio sí se suman.
 */
// R1: el driver neon-http expande arrays del template a ($1, $2, ...), así que
// ANY($1) no recibe un array. Fallback aprobado: IN (sql.join) con un parámetro
// por código (~263 hoy, muy por debajo del límite de 65535).
const codigosIn = (codigos: readonly string[]) =>
  sql.join(
    codigos.map((c) => sql`${c}`),
    sql`, `
  );

const lotesQuery = (esquema: "vida" | "sanjh", codigos: readonly string[]) => sql`
  SELECT
    x.codigo,
    x.folio,
    x.fecha,
    x.precdocd,
    SUM(x.cantidad)::int AS cantidad
  FROM (
    SELECT DISTINCT ON (
      i.codunico, i.knumfoli, NULLIF(TRIM(i.kdocitem), '')::int
    )
      i.codunico AS codigo,
      i.knumfoli AS folio,
      m.fechanvt::text AS fecha,
      i.precdocd,
      i.cantsali AS cantidad
    FROM ${sql.raw(esquema)}.itemdcto i
    JOIN ${sql.raw(esquema)}.movidcto m ON i.knumfoli = m.knumfoli
    WHERE i.codunico IN (${codigosIn(codigos)})
      AND m.tipomovi = 'V'
      AND m.kcodcli2 IN (2, 20, 218)
      AND m.fechanvt >= '2023-09-01'
    ORDER BY
      i.codunico, i.knumfoli, NULLIF(TRIM(i.kdocitem), '')::int,
      m.fechanvt, i.precdocd, i.cantsali
  ) x
  GROUP BY x.codigo, x.folio, x.fecha, x.precdocd
  ORDER BY x.codigo, x.fecha, x.folio, x.precdocd
`;

export async function getLotesCompraPorCodigos(
  codigos: readonly string[]
): Promise<Map<string, LoteCompra[]>> {
  const mapa = new Map<string, LoteCompra[]>();
  const unicos = [...new Set(codigos)];
  if (unicos.length === 0) return mapa;

  const client = getVidaDigitalClient();
  const [vida, sanjh] = await Promise.all([
    client.execute(lotesQuery("vida", unicos)),
    client.execute(lotesQuery("sanjh", unicos)),
  ]);

  // Cada query es de un solo esquema; las filas de ambos se agregan por código.
  for (const result of [vida, sanjh]) {
    const { rows } = result as unknown as { rows: LoteRow[] };
    for (const r of rows) {
      const lote: LoteCompra = {
        folio: r.folio,
        fecha: r.fecha,
        cantidad: Number(r.cantidad),
        costoUnitario: r.precdocd === null ? null : Number(r.precdocd),
      };
      const lista = mapa.get(r.codigo);
      if (lista) lista.push(lote);
      else mapa.set(r.codigo, [lote]);
    }
  }

  // Cada query ya viene ordenada por esquema; al concatenar vida+sanjh hay que
  // reordenar por fecha para preservar el orden histórico del single-query.
  const sortLote = (a: LoteCompra, b: LoteCompra): number => {
    const fa = a.fecha ?? "9999-12-31";
    const fb = b.fecha ?? "9999-12-31";
    if (fa !== fb) return fa < fb ? -1 : 1;
    if (a.folio !== b.folio) return a.folio < b.folio ? -1 : 1;
    return (a.costoUnitario ?? 0) - (b.costoUnitario ?? 0);
  };
  for (const lista of mapa.values()) lista.sort(sortLote);

  return mapa;
}

/** Lotes de un código. Wrapper de la variante batch. */
export async function getLotesCompraPorCodigo(
  codigo: string
): Promise<LoteCompra[]> {
  return (await getLotesCompraPorCodigos([codigo])).get(codigo) ?? [];
}

/**
 * Stock propio por código (solo suma > 0) con detalle del producto.
 * Una query agrupada, sin N+1.
 */
export async function getStockPorCodigo(): Promise<Map<string, StockCodigo>> {
  const rows = await db
    .select({
      codigo: productos.codigo,
      detalle: productos.detalle,
      stock: sql<number>`SUM(${stock.cantidad})::int`.mapWith(Number),
    })
    .from(stock)
    .innerJoin(productos, eq(stock.productoId, productos.id))
    .groupBy(productos.codigo, productos.detalle)
    .having(sql`SUM(${stock.cantidad}) > 0`)
    .orderBy(productos.codigo);

  const mapa = new Map<string, StockCodigo>();
  for (const r of rows) {
    // ponytail: guard defensivo barato; el HAVING ya filtra.
    if (r.stock > 0) mapa.set(r.codigo, { stock: r.stock, detalle: r.detalle });
  }
  return mapa;
}

/**
 * Stock total del código en la base propia. Suma real, sin clamp:
 * puede ser negativa. El clamp/advertencia se decide en el llamador.
 */
export async function getStockActualPorCodigo(codigo: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${stock.cantidad}), 0)`.mapWith(Number),
    })
    .from(stock)
    .innerJoin(productos, eq(stock.productoId, productos.id))
    .where(eq(productos.codigo, codigo));

  return rows[0]?.total ?? 0;
}
