import { getVidaDigitalClient } from "./index";
import { getBodegaPorCodigoIngreso } from "@/lib/utils/get-bodega-por-codigo-ingreso";
import { sql } from "drizzle-orm";

// ── Tipos ────────────────────────────────────────────────────────────────
export interface CompraAnil {
  folio: string;
  fechanvt: string | null;
  codigo: string;
  detalle: string | null;
  cantidad: number;
  cantcaja: number | null;
  imagenUrl: string | null;
  bodega: string;
}

export interface ProductoHistorico {
  codigo: string;
  detalle: string | null;
  imagenUrl: string | null;
  packing: number | null;
}

// ── Compras Anil desde fecha ─────────────────────────────────────────────
/**
 * Compra de Anil desde la fecha de corte (sync_watermark.value para compras-anil).
 * UNION ALL entre vida y sanjh — sin riesgo de duplicados porque
 * son sistemas distintos con folios independientes.
 */
export async function getComprasAnilDesde(fecha: string): Promise<CompraAnil[]> {
  const db = getVidaDigitalClient();

  const result = await db.execute(
    sql`
      SELECT
        i.knumfoli AS folio,
        m.fechanvt,
        p.codigo,
        p.detalle,
        i.cantsali  AS cantidad,
        p.cantcaja,
        p.imagen_url AS imagen_url,
        i.knumezet AS nro_ingreso
      FROM vida.itemdcto i
      JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
      JOIN (
        SELECT codigo, MAX(detalle) AS detalle, MAX(imagen_url) AS imagen_url, MAX(cantcaja) AS cantcaja
        FROM public.productos
        GROUP BY codigo
      ) p ON i.codunico = p.codigo
      WHERE m.tipomovi = 'V'
        AND m.kcodcli2 IN (2, 20, 218)
        AND m.fechanvt >= ${fecha}

      UNION ALL

      SELECT
        i.knumfoli AS folio,
        m.fechanvt,
        p.codigo,
        p.detalle,
        i.cantsali  AS cantidad,
        p.cantcaja,
        p.imagen_url AS imagen_url,
        i.knumezet AS nro_ingreso
      FROM sanjh.itemdcto i
      JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
      JOIN (
        SELECT codigo, MAX(detalle) AS detalle, MAX(imagen_url) AS imagen_url, MAX(cantcaja) AS cantcaja
        FROM public.productos
        GROUP BY codigo
      ) p ON i.codunico = p.codigo
      WHERE m.tipomovi = 'V'
        AND m.kcodcli2 IN (2, 20, 218)
        AND m.fechanvt >= ${fecha}

      ORDER BY fechanvt DESC, folio DESC
    `
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows } = result as any as {
    rows: {
      folio: string;
      fechanvt: string | null;
      codigo: string;
      detalle: string | null;
      cantidad: number;
      cantcaja: number | null;
      imagen_url: string | null;
      nro_ingreso: string | null;
    }[];
  };

  const compras = rows.map((r) => {
    const codigoBodega = r.nro_ingreso?.split("-")[4] ?? null;
    return {
      folio: r.folio,
      fechanvt: r.fechanvt,
      codigo: r.codigo,
      detalle: r.detalle,
      cantidad: Number(r.cantidad),
      cantcaja: r.cantcaja,
      imagenUrl: r.imagen_url,
      bodega: getBodegaPorCodigoIngreso(codigoBodega) ?? "Bodega desconocida",
    };
  });

  // Agrupar por (folio, codigo, bodega) con SUM(cantidad).
  // Necesario porque itemdcto puede tener múltiples líneas del mismo
  // producto en la misma compra (ej. 20 lotes distintos de "1055" en
  // el folio "001653"), y la idempotencia del sync descarta la
  // segunda y siguientes — perdiendo stock silenciosamente si no
  // consolidamos antes.
  const agrupado = new Map<string, CompraAnil>();
  for (const c of compras) {
    const key = `${c.folio}|${c.codigo}|${c.bodega}`;
    const existente = agrupado.get(key);
    if (existente) {
      existente.cantidad += c.cantidad;
    } else {
      agrupado.set(key, { ...c });
    }
  }

  return [...agrupado.values()];
}

// ── Buscador histórico ───────────────────────────────────────────────────
/**
 * Buscador histórico para ingreso manual. Sin filtro de fecha.
 * Solo devuelve código, detalle e imagen — nunca cantidad ni bodega.
 */
export async function buscarProductoHistorico(
  query: string
): Promise<ProductoHistorico[]> {
  const db = getVidaDigitalClient();

  const result = await db.execute(
    sql`
      SELECT codigo, detalle, imagen, cantcaja
      FROM (
        SELECT DISTINCT ON (codigo)
               codigo, detalle, imagen_url AS imagen, cantcaja
        FROM public.productos
        WHERE codigo ILIKE '%' || ${query} || '%'
           OR detalle ILIKE '%' || ${query} || '%'
        ORDER BY codigo
      ) AS deduped
      ORDER BY
        codigo ILIKE ${query} || '%' DESC,
        codigo
      LIMIT 20
    `
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows } = result as any as {
    rows: { codigo: string; detalle: string | null; imagen: string | null; cantcaja: number | null }[];
  };

  return rows.map((r) => ({
    codigo: r.codigo,
    detalle: r.detalle,
    imagenUrl: r.imagen,
    packing: r.cantcaja,
  }));
}
