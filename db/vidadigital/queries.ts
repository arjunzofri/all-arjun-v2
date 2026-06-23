import { getVidaDigitalClient } from "./index";
import { getBodegaPorCodigoIngreso } from "@/lib/utils/get-bodega-por-codigo-ingreso";
import { sql } from "drizzle-orm";

// ── Tipos ────────────────────────────────────────────────────────────────
export interface Visacion {
  nroIngreso: string;
  cantidad: number;
}

export interface CompraAnil {
  folio: string;
  fechanvt: string | null;
  codigo: string;
  detalle: string | null;
  cantidad: number;
  cantcaja: number | null;
  imagenUrl: string | null;
  bodega: string;
  visaciones: Visacion[];
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

  // ── Agregación en dos niveles ──────────────────────────────────────
  // Nivel 1: agrupar por (folio, codigo, bodega, knumezet) → visaciones.
  //   Mismo knumezet en la misma compra = mismo lote → SUM(cantidad).
  // Nivel 2: agrupar por (folio, codigo, bodega) → CompraAnil.
  //   Distintos knumezet del mismo producto en la misma compra quedan
  //   como visaciones separadas, cada una con su cantidad individual.
  //   La cantidad total de la compra es la suma de sus visaciones.

  // Nivel 1: visaciones por knumezet
  const visMap = new Map<string, { nroIngreso: string; cantidad: number }>();
  for (const r of rows) {
    const nro = r.nro_ingreso;
    const key = `${r.folio}|${r.codigo}|${nro}`;
    const existente = visMap.get(key);
    if (existente) {
      existente.cantidad += Number(r.cantidad);
    } else {
      visMap.set(key, { nroIngreso: nro ?? "", cantidad: Number(r.cantidad) });
    }
  }

  // Nivel 2: compras por (folio, codigo, bodega) con visaciones[]
  const compraMap = new Map<string, CompraAnil & { _visMap: Map<string, Visacion> }>();
  for (const r of rows) {
    const codigoBodega = r.nro_ingreso?.split("-")[4] ?? null;
    const bodega = getBodegaPorCodigoIngreso(codigoBodega) ?? "Bodega desconocida";
    const key = `${r.folio}|${r.codigo}|${bodega}`;

    let entry = compraMap.get(key);
    if (!entry) {
      entry = {
        folio: r.folio,
        fechanvt: r.fechanvt,
        codigo: r.codigo,
        detalle: r.detalle,
        cantidad: 0,
        cantcaja: r.cantcaja,
        imagenUrl: r.imagen_url,
        bodega,
        visaciones: [],
        _visMap: new Map(),
      };
      compraMap.set(key, entry);
    }

    const nro = r.nro_ingreso ?? "";
    const vKey = `${key}|${nro}`;
    if (!entry._visMap.has(vKey)) {
      const vis = visMap.get(`${r.folio}|${r.codigo}|${nro}`)!;
      entry._visMap.set(vKey, vis);
      entry.cantidad += vis.cantidad;
      entry.visaciones.push({ nroIngreso: vis.nroIngreso, cantidad: vis.cantidad });
    }
  }

  return [...compraMap.values()].map(({ _visMap, ...c }) => c);
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
