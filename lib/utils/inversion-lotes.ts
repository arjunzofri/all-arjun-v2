import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { productos, stock } from "@/db/schema";
import { getVidaDigitalClient } from "@/db/vidadigital";
import type { LoteCompra } from "./inversion-fifo";

interface LoteRow {
  origen: "vida" | "sanjh";
  folio: string;
  fecha: string | null;
  precdocd: string | number | null;
  cantidad: string | number;
}

/**
 * Lotes de compra de un código, leídos de Vida Digital (vida + sanjh).
 * Solo lectura. vida y sanjh son sistemas distintos con folios
 * independientes: se agrupa por origen además de folio/fecha/precdocd.
 *
 * Las líneas de itemdcto vienen duplicadas por un artefacto de importación
 * (kdocitem ' 13' vs '13', knumdocu '001957' vs '000000001957'). Se toma
 * una sola fila por (folio, codunico, kdocitem normalizado) antes de sumar;
 * líneas distintas del mismo código en el mismo folio sí se suman.
 */
export async function getLotesCompraPorCodigo(
  codigo: string
): Promise<LoteCompra[]> {
  const client = getVidaDigitalClient();

  const result = await client.execute(
    sql`
      SELECT
        'vida' AS origen,
        d.folio,
        d.fecha,
        d.precdocd,
        SUM(d.cantidad)::int AS cantidad
      FROM (
        SELECT DISTINCT ON (
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int
        )
          i.knumfoli AS folio,
          m.fechanvt::text AS fecha,
          i.precdocd,
          i.cantsali AS cantidad
        FROM vida.itemdcto i
        JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
        WHERE i.codunico = ${codigo}
          AND m.tipomovi = 'V'
          AND m.kcodcli2 IN (2, 20, 218)
          AND m.fechanvt >= '2023-09-01'
        ORDER BY
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int,
          m.fechanvt, i.precdocd, i.cantsali
      ) d
      GROUP BY d.folio, d.fecha, d.precdocd

      UNION ALL

      SELECT
        'sanjh',
        d.folio,
        d.fecha,
        d.precdocd,
        SUM(d.cantidad)::int
      FROM (
        SELECT DISTINCT ON (
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int
        )
          i.knumfoli AS folio,
          m.fechanvt::text AS fecha,
          i.precdocd,
          i.cantsali AS cantidad
        FROM sanjh.itemdcto i
        JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
        WHERE i.codunico = ${codigo}
          AND m.tipomovi = 'V'
          AND m.kcodcli2 IN (2, 20, 218)
          AND m.fechanvt >= '2023-09-01'
        ORDER BY
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int,
          m.fechanvt, i.precdocd, i.cantsali
      ) d
      GROUP BY d.folio, d.fecha, d.precdocd

      ORDER BY fecha, origen, folio, precdocd
    `
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows } = result as any as { rows: LoteRow[] };

  return rows.map((r) => ({
    folio: r.folio,
    fecha: r.fecha,
    cantidad: Number(r.cantidad),
    costoUnitario: r.precdocd === null ? null : Number(r.precdocd),
  }));
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
