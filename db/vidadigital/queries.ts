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
  /** Fecha de confirmación (YYYY-MM-DD). Null solo en notas no confirmadas. */
  fechconf: string | null;
  codigo: string;
  detalle: string | null;
  cantidad: number;
  cantcaja: number | null;
  imagenUrl: string | null;
  bodega: string;
  visaciones: Visacion[];
  precioUnitario: number | null;
}

/** Estado de una nota en VD para clasificar notas app-only. */
export interface EstadoNotaVd {
  folio: string;
  existe: boolean; // hay fila en movidcto (vida o sanjh)
  fechconf: string | null; // MAX(fechconf) no nulo entre esquemas, YYYY-MM-DD
  lineasConfirmadas: number; // itemdcto con pestadot='3'
  lineasValidas: number; // + tipomovi='V' + kcodcli2 IN (2,20,218) + fechconf not null
}

export interface ProductoHistorico {
  codigo: string;
  detalle: string | null;
  imagenUrl: string | null;
  packing: number | null;
}

export interface FilaCatalogoVD {
  codigo: string;
  detalle: string | null;
  imagenUrl: string | null;
}

export interface ProductoCatalogoVD {
  /** Código tal como está en public.productos (sin normalizar). */
  codigo: string;
  detalle: string | null;
  /** Nunca null: se descartan los códigos sin imagen no vacía. */
  imagenUrl: string;
}

// ── Compras Anil desde fecha ─────────────────────────────────────────────
/**
 * Compra de Anil desde la fecha de corte (sync_watermark.value para compras-anil).
 * UNION ALL entre vida y sanjh — sin riesgo de duplicados porque
 * son sistemas distintos con folios independientes.
 *
 * La fecha de corte es la fecha de CONFIRMACION (movidcto.fechconf), no la
 * fecha de la nota (fechanvt): una nota confirmada tarde debe entrar aunque su
 * fechanvt quede antes del corte. Solo las notas confirmadas tienen fechconf;
 * las que siguen en borrador no entran hasta confirmarse.
 *
 * Regla de líneas válidas (la misma validada en lib/utils/inversion-lotes.ts):
 *   1. Solo líneas confirmadas: i.pestadot = '3'. Descarta las líneas en
 *      borrador (pestadot = '1'), que duplican la línea real y no salen en
 *      el documento impreso. Una nota completa en borrador no aporta nada.
 *   2. Dedup por (knumfoli, codunico, kdocitem normalizado) con DISTINCT ON,
 *      por esquema: la misma línea importada dos veces (' 13' y '13').
 */
export async function getComprasAnilDesde(fecha: string): Promise<CompraAnil[]> {
  const db = getVidaDigitalClient();

  const result = await db.execute(
    sql`
      SELECT
        i.knumfoli AS folio,
        i.fechanvt,
        i.fechconf,
        p.codigo,
        p.detalle,
        i.cantsali  AS cantidad,
        p.cantcaja,
        p.imagen_url AS imagen_url,
        i.precdocd  AS precdocd,
        i.knumezet AS nro_ingreso
      FROM (
        SELECT DISTINCT ON (
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int
        )
          i.knumfoli, i.codunico, i.cantsali, i.precdocd, i.knumezet,
          m.fechanvt, m.fechconf::date::text AS fechconf
        FROM vida.itemdcto i
        JOIN vida.movidcto m ON i.knumfoli = m.knumfoli
        WHERE i.pestadot = '3'
          AND m.tipomovi = 'V'
          AND m.kcodcli2 IN (2, 20, 218)
          AND m.fechconf IS NOT NULL
          AND m.fechconf::date >= ${fecha}::date
        ORDER BY
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int,
          m.fechanvt, i.precdocd, i.cantsali
      ) i
      JOIN (
        SELECT codigo, MAX(detalle) AS detalle, MAX(imagen_url) AS imagen_url, MAX(cantcaja) AS cantcaja
        FROM public.productos
        GROUP BY codigo
      ) p ON i.codunico = p.codigo

      UNION ALL

      SELECT
        i.knumfoli AS folio,
        i.fechanvt,
        i.fechconf,
        p.codigo,
        p.detalle,
        i.cantsali  AS cantidad,
        p.cantcaja,
        p.imagen_url AS imagen_url,
        i.precdocd  AS precdocd,
        i.knumezet AS nro_ingreso
      FROM (
        SELECT DISTINCT ON (
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int
        )
          i.knumfoli, i.codunico, i.cantsali, i.precdocd, i.knumezet,
          m.fechanvt, m.fechconf::date::text AS fechconf
        FROM sanjh.itemdcto i
        JOIN sanjh.movidcto m ON i.knumfoli = m.knumfoli
        WHERE i.pestadot = '3'
          AND m.tipomovi = 'V'
          AND m.kcodcli2 IN (2, 20, 218)
          AND m.fechconf IS NOT NULL
          AND m.fechconf::date >= ${fecha}::date
        ORDER BY
          i.knumfoli, i.codunico, NULLIF(TRIM(i.kdocitem), '')::int,
          m.fechanvt, i.precdocd, i.cantsali
      ) i
      JOIN (
        SELECT codigo, MAX(detalle) AS detalle, MAX(imagen_url) AS imagen_url, MAX(cantcaja) AS cantcaja
        FROM public.productos
        GROUP BY codigo
      ) p ON i.codunico = p.codigo

      ORDER BY fechanvt DESC, folio DESC
    `
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows } = result as any as {
    rows: {
      folio: string;
      fechanvt: string | null;
      fechconf: string | null;
      codigo: string;
      detalle: string | null;
      cantidad: number;
      cantcaja: number | null;
      imagen_url: string | null;
      nro_ingreso: string | null;
      precdocd: string | null;
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
        fechconf: r.fechconf,
        codigo: r.codigo,
        detalle: r.detalle,
        cantidad: 0,
        cantcaja: r.cantcaja,
        imagenUrl: r.imagen_url,
        bodega,
        visaciones: [],
        precioUnitario: r.precdocd !== null ? Number(r.precdocd) : null,
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

// ── Estado de notas (conciliación) ───────────────────────────────────────
/**
 * Estado de cada folio en VD, una query por esquema y merge en TS.
 * Devuelve una entrada por folio pedido (existe=false si no aparece).
 * Solo SELECT.
 */
export async function getEstadoNotasVd(
  folios: readonly string[],
): Promise<EstadoNotaVd[]> {
  const unicos = [...new Set(folios)];
  if (unicos.length === 0) return [];

  // R1: neon-http expande arrays del template a ($1, $2, ...); ANY() no recibe
  // array. IN (sql.join) con un parámetro por folio.
  // ponytail: sin chunking; si algún día supera ~1000 folios, partir en lotes.
  const lista = sql.join(unicos.map((f) => sql`${f}`), sql`, `);
  const db = getVidaDigitalClient();
  const porFolio = new Map<string, EstadoNotaVd>();

  for (const esq of ["vida", "sanjh"] as const) {
    const result = await db.execute(
      sql`
        SELECT m.knumfoli::text AS folio,
               MAX(m.fechconf)::date::text AS fechconf,
               COUNT(i.kdocitem) FILTER (WHERE i.pestadot = '3')::int AS lineas_confirmadas,
               COUNT(i.kdocitem) FILTER (
                 WHERE i.pestadot = '3' AND m.tipomovi = 'V'
                   AND m.kcodcli2 IN (2, 20, 218) AND m.fechconf IS NOT NULL
               )::int AS lineas_validas
        FROM ${sql.raw(esq)}.movidcto m
        LEFT JOIN ${sql.raw(esq)}.itemdcto i ON i.knumfoli = m.knumfoli
        WHERE m.knumfoli::text IN (${lista})
        GROUP BY m.knumfoli
      `
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { rows } = result as any as {
      rows: {
        folio: string;
        fechconf: string | null;
        lineas_confirmadas: number | string;
        lineas_validas: number | string;
      }[];
    };

    for (const r of rows) {
      const previo = porFolio.get(r.folio);
      const fechconf = r.fechconf;
      porFolio.set(r.folio, {
        folio: r.folio,
        existe: true,
        fechconf:
          previo?.fechconf && (!fechconf || previo.fechconf > fechconf)
            ? previo.fechconf
            : fechconf,
        lineasConfirmadas:
          (previo?.lineasConfirmadas ?? 0) + Number(r.lineas_confirmadas),
        lineasValidas: (previo?.lineasValidas ?? 0) + Number(r.lineas_validas),
      });
    }
  }

  return unicos.map(
    (folio) =>
      porFolio.get(folio) ?? {
        folio,
        existe: false,
        fechconf: null,
        lineasConfirmadas: 0,
        lineasValidas: 0,
      },
  );
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

// ── Catálogo de identificación por foto ──────────────────────────────────
/**
 * Deduplica filas crudas de public.productos a una fila por código.
 *
 * AJUSTE aprobado: `detalle` = el más frecuente entre TODAS las filas del
 * código (también las sin imagen); empate → el más corto, luego alfabético.
 * null solo si ninguna fila tiene detalle (los vacíos no votan).
 * `imagenUrl` = la única no vacía del código; si hubiera más de una,
 * se elige la menor lexicográficamente para ser determinista.
 *
 * En TS y no en SQL: la regla de desempate es testeable sin escribir en
 * Vida Digital (read-only) y 5.318 filas se agregan en memoria sin costo.
 */
export function deduplicarCatalogo(
  filas: readonly FilaCatalogoVD[]
): ProductoCatalogoVD[] {
  const porCodigo = new Map<string, FilaCatalogoVD[]>();
  for (const f of filas) {
    if (f.codigo.trim() === "") continue;
    const grupo = porCodigo.get(f.codigo);
    if (grupo) grupo.push(f);
    else porCodigo.set(f.codigo, [f]);
  }

  const salida: ProductoCatalogoVD[] = [];
  for (const [codigo, grupo] of porCodigo) {
    const imagenUrl = grupo
      .map((f) => f.imagenUrl?.trim() ?? "")
      .filter(Boolean)
      .sort()[0];
    if (!imagenUrl) continue;

    const conteo = new Map<string, number>();
    for (const f of grupo) {
      const d = f.detalle;
      if (d !== null && d.trim() !== "") conteo.set(d, (conteo.get(d) ?? 0) + 1);
    }
    let detalle: string | null = null;
    if (conteo.size > 0) {
      detalle = [...conteo.entries()].sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].length - b[0].length ||
          (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
      )[0][0];
    }

    salida.push({ codigo, detalle, imagenUrl });
  }

  return salida.sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0));
}

/**
 * Catálogo completo con imagen para identificación por foto.
 * Solo SELECT. No filtra por empresa_id a propósito: compras de Anil
 * pueden venir de Sanjh (empresa_id=1) o Vida Digital (empresa_id=2).
 */
export async function getCatalogoVidaDigital(): Promise<ProductoCatalogoVD[]> {
  const db = getVidaDigitalClient();

  const result = await db.execute(
    sql`
      SELECT p.codigo, p.detalle, p.imagen_url
      FROM public.productos p
      WHERE p.codigo IS NOT NULL
        AND btrim(p.codigo) <> ''
    `
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows } = result as any as {
    rows: { codigo: string; detalle: string | null; imagen_url: string | null }[];
  };

  return deduplicarCatalogo(
    rows.map((r) => ({ codigo: r.codigo, detalle: r.detalle, imagenUrl: r.imagen_url }))
  );
}
