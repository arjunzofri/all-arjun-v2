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
}

// ── Compras Anil desde fecha ─────────────────────────────────────────────
/**
 * Compra de Anil desde fecha de corte (>= 2026-06-01).
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
        i.cantidad  AS cantidad,
        p.cantcaja,
        p.imagen_url AS imagen_url,
        i.knumezet AS nro_ingreso
      FROM vida.itemdcto i
      JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
      JOIN public.productos p ON i.codigo = p.codigo
      WHERE m.tipomovi = 'V'
        AND m.kcodcli2 IN (2, 20, 218)
        AND m.fechanvt >= ${fecha}

      UNION ALL

      SELECT
        i.knumfoli AS folio,
        m.fechanvt,
        p.codigo,
        p.detalle,
        i.cantidad  AS cantidad,
        p.cantcaja,
        p.imagen_url AS imagen_url,
        i.knumezet AS nro_ingreso
      FROM sanjh.itemdcto i
      JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
      JOIN public.productos p ON i.codigo = p.codigo
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

  return rows.map((r) => {
    const codigoBodega = r.nro_ingreso?.split("-")[4] ?? null;
    return {
      folio: r.folio,
      fechanvt: r.fechanvt,
      codigo: r.codigo,
      detalle: r.detalle,
      cantidad: r.cantidad,
      cantcaja: r.cantcaja,
      imagenUrl: r.imagen_url,
      bodega: getBodegaPorCodigoIngreso(codigoBodega) ?? "Bodega desconocida",
    };
  });
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
      SELECT codigo, detalle, imagen_url AS imagen
      FROM public.productos
      WHERE codigo ILIKE '%' || ${query} || '%'
         OR detalle ILIKE '%' || ${query} || '%'
      ORDER BY codigo
      LIMIT 20
    `
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows } = result as any as {
    rows: { codigo: string; detalle: string | null; imagen: string | null }[];
  };

  return rows.map((r) => ({
    codigo: r.codigo,
    detalle: r.detalle,
    imagenUrl: r.imagen,
  }));
}
