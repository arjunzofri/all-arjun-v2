import { neon } from "@neondatabase/serverless";
import {
  getComprasAnilDesde,
  getEstadoNotasVd,
  type CompraAnil,
  type EstadoNotaVd,
} from "@/db/vidadigital/queries";

export type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type TipoDiferencia =
  | "falta_en_app"
  | "sobra_en_app"
  | "cantidad_distinta"
  | "nota_ausente_en_vd";

export type MotivoNotaAusente =
  | "sin_fechconf"
  | "sin_lineas_confirmadas"
  | "fuera_de_desde"
  | "producto_sin_metadata"
  | "no_cumple_regla_vd"
  | "no_existe_en_vd";

export interface LineaConciliacion {
  folio: string;
  codigo: string;
  bodega: string;
  cantidad: number;
}

export interface DiferenciaConciliacion {
  tipo: TipoDiferencia;
  folio: string;
  codigo: string | null;
  bodega: string | null;
  cantidadVd: number | null;
  cantidadApp: number | null;
  motivo?: MotivoNotaAusente;
}

export interface ResumenConciliacion {
  notasRevisadas: number;
  lineasVd: number;
  lineasApp: number;
  unidadesVd: number;
  unidadesApp: number;
  diferencias: number;
  notasConDiferencias: number;
}

export interface ResultadoConciliacion {
  desde: string;
  cuadra: boolean;
  resumen: ResumenConciliacion;
  diferencias: DiferenciaConciliacion[];
}

const SEP = "\u0000";

function clave(folio: string, codigo: string, bodega: string): string {
  return `${folio}${SEP}${codigo}${SEP}${bodega}`;
}

function ordenar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Suma cantidades por (folio, codigo, bodega); protege contra duplicados. */
function agregar(
  lineas: readonly LineaConciliacion[],
): Map<string, LineaConciliacion> {
  const m = new Map<string, LineaConciliacion>();
  for (const l of lineas) {
    const k = clave(l.folio, l.codigo, l.bodega);
    const previa = m.get(k);
    if (previa) {
      previa.cantidad += l.cantidad;
    } else {
      m.set(k, {
        folio: l.folio,
        codigo: l.codigo,
        bodega: l.bodega,
        cantidad: l.cantidad,
      });
    }
  }
  return m;
}

function diferencia(
  tipo: TipoDiferencia,
  l: LineaConciliacion,
  cantidadVd: number,
  cantidadApp: number,
): DiferenciaConciliacion {
  return {
    tipo,
    folio: l.folio,
    codigo: l.codigo,
    bodega: l.bodega,
    cantidadVd,
    cantidadApp,
  };
}

/**
 * Compara líneas netas de VD contra líneas netas de la app.
 *
 * Convención: una clave ausente de un lado vale 0. Solo hay diferencia si
 * `cantidadVd !== cantidadApp` bajo esa convención:
 * - VD > 0 y la clave no existe en la app → `falta_en_app`.
 * - VD > 0 y la clave existe en la app → `cantidad_distinta` si difiere
 *   (incluye app en 0 o negativa).
 * - VD ausente/0 y la app tiene cantidad ≠ 0 → `sobra_en_app`.
 *
 * `lineasApp` y `unidadesApp` del resumen cuentan TODAS las claves de la
 * app, incluidas las de neto 0 o negativo (líneas regularizadas); no son
 * "líneas conciliadas", son el total leído de la app.
 */
export function compararCompras(
  desde: string,
  vd: readonly CompraAnil[],
  app: readonly LineaConciliacion[],
  notasVd?: ReadonlyMap<string, EstadoNotaVd>,
): ResultadoConciliacion {
  const vdAgg = agregar(vd);
  const appAgg = agregar(app);
  const diferencias: DiferenciaConciliacion[] = [];

  // Unión de claves: compara también lo que falta de cada lado.
  for (const k of new Set([...vdAgg.keys(), ...appAgg.keys()])) {
    const v = vdAgg.get(k);
    const a = appAgg.get(k);
    const cantidadVd = v?.cantidad ?? 0;
    const cantidadApp = a?.cantidad ?? 0;
    if (cantidadVd === cantidadApp) continue;

    if (cantidadVd > 0) {
      if (!a) {
        diferencias.push(diferencia("falta_en_app", v!, cantidadVd, 0));
      } else {
        diferencias.push(
          diferencia("cantidad_distinta", v!, cantidadVd, cantidadApp),
        );
      }
    } else if (cantidadApp !== 0) {
      // cantidadApp ≠ 0 implica que la clave existe en la app.
      diferencias.push(diferencia("sobra_en_app", a!, cantidadVd, cantidadApp));
    } else {
      // VD negativo y app ausente/0.
      diferencias.push(diferencia("falta_en_app", v!, cantidadVd, cantidadApp));
    }
  }

  // Capa nota-level: folio que la app tiene y VD no devuelve ni una línea.
  // Solo si la nota suma unidades ≠ 0: una nota cuyas líneas quedaron todas
  // en neto 0 (ajustes AJT-REGSYNC) no es una nota sobrante.
  const foliosVd = new Set([...vdAgg.values()].map((l) => l.folio));
  const unidadesAppPorFolio = new Map<string, number>();
  for (const l of appAgg.values()) {
    unidadesAppPorFolio.set(
      l.folio,
      (unidadesAppPorFolio.get(l.folio) ?? 0) + l.cantidad,
    );
  }
  for (const [folio, unidades] of unidadesAppPorFolio) {
    if (foliosVd.has(folio) || unidades === 0) continue;
    const d: DiferenciaConciliacion = {
      tipo: "nota_ausente_en_vd",
      folio,
      codigo: null,
      bodega: null,
      cantidadVd: 0,
      cantidadApp: unidades,
    };
    if (notasVd) d.motivo = clasificarNotaAusente(notasVd.get(folio), desde);
    diferencias.push(d);
  }

  diferencias.sort(
    (x, y) =>
      ordenar(x.folio, y.folio) ||
      ordenar(x.codigo ?? "", y.codigo ?? "") ||
      ordenar(x.bodega ?? "", y.bodega ?? "") ||
      ordenar(x.tipo, y.tipo),
  );

  const folios = new Set(
    [...vdAgg.values(), ...appAgg.values()].map((l) => l.folio),
  );
  const suma = (m: Map<string, LineaConciliacion>) =>
    [...m.values()].reduce((s, l) => s + l.cantidad, 0);

  return {
    desde,
    cuadra: diferencias.length === 0,
    resumen: {
      notasRevisadas: folios.size,
      lineasVd: vdAgg.size,
      lineasApp: appAgg.size,
      unidadesVd: suma(vdAgg),
      unidadesApp: suma(appAgg),
      diferencias: diferencias.length,
      notasConDiferencias: new Set(diferencias.map((d) => d.folio)).size,
    },
    diferencias,
  };
}

export function clasificarNotaAusente(
  estado: EstadoNotaVd | undefined,
  desde: string,
): MotivoNotaAusente {
  if (!estado || !estado.existe) return "no_existe_en_vd";
  if (estado.lineasValidas > 0) {
    return estado.fechconf !== null && estado.fechconf >= desde
      ? "producto_sin_metadata"
      : "fuera_de_desde";
  }
  if (estado.fechconf === null) return "sin_fechconf";
  if (estado.lineasConfirmadas === 0) return "sin_lineas_confirmadas";
  return "no_cumple_regla_vd";
}

// ── IO (sub-slice 1B) ────────────────────────────────────────────────────

/** IO: líneas netas de la app (entrada + ajustes), una sola query. */
export async function getLineasApp(): Promise<LineaConciliacion[]> {
  const sql = neon(process.env.DATABASE_URL!);

  const rows = (await sql`
    SELECT m.folio,
           p.codigo,
           b.nombre AS bodega,
           (SUM(m.cantidad) + COALESCE(SUM(adj.cantidad), 0))::int AS cantidad
    FROM movimientos m
    JOIN productos p ON p.id = m.producto_id
    JOIN bodegas b ON b.id = m.bodega_origen_id
    LEFT JOIN (
      SELECT movimiento_original_id, SUM(cantidad)::int AS cantidad
      FROM movimientos
      WHERE tipo = 'ajuste' AND movimiento_original_id IS NOT NULL
      GROUP BY movimiento_original_id
    ) adj ON adj.movimiento_original_id = m.id
    WHERE m.tipo = 'entrada'
      AND m.folio ~ '^[0-9]+$'
    GROUP BY m.folio, p.codigo, b.nombre
    ORDER BY m.folio, p.codigo, b.nombre
  `) as unknown as {
    folio: string;
    codigo: string;
    bodega: string;
    cantidad: number | string;
  }[];

  return rows.map((r) => ({
    folio: r.folio,
    codigo: r.codigo,
    bodega: r.bodega,
    cantidad: Number(r.cantidad),
  }));
}

/** IO: VD + app en paralelo; estado VD solo para folios app-only. */
export async function conciliarComprasAnil(
  desde: string,
): Promise<ResultadoConciliacion> {
  const [vd, app] = await Promise.all([
    getComprasAnilDesde(desde),
    getLineasApp(),
  ]);

  const foliosVd = new Set(vd.map((l) => l.folio));
  const ausentes = [...new Set(app.map((l) => l.folio))].filter(
    (f) => !foliosVd.has(f),
  );

  if (ausentes.length === 0) return compararCompras(desde, vd, app);

  const notasVd = new Map(
    (await getEstadoNotasVd(ausentes)).map((e) => [e.folio, e]),
  );
  return compararCompras(desde, vd, app, notasVd);
}

/** Lee 'compras-anil-desde'; fallback 'compras-anil'; fallback "2026-05-01". */
export async function getDesdeConciliacion(sql: Sql): Promise<string> {
  const rows = (await sql`
    SELECT key, value FROM sync_watermark
    WHERE key IN ('compras-anil-desde', 'compras-anil')
  `) as { key: string; value: string }[];

  return (
    rows.find((r) => r.key === "compras-anil-desde")?.value ??
    rows.find((r) => r.key === "compras-anil")?.value ??
    "2026-05-01"
  );
}

/** activity_log best-effort. No loguea si el usuario no es válido. */
export async function registrarConciliacion(
  sql: Sql,
  usuarioId: number,
  resultado: ResultadoConciliacion | { error: string },
): Promise<void> {
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) return;

  const detalles =
    "error" in resultado
      ? { error: resultado.error }
      : {
          desde: resultado.desde,
          cuadra: resultado.cuadra,
          resumen: resultado.resumen,
          diferencias: resultado.diferencias.slice(0, 500),
          diferenciasTruncadas: Math.max(0, resultado.diferencias.length - 500),
        };

  await sql`
    INSERT INTO activity_log (usuario_id, accion, entidad, entidad_id, detalles)
    VALUES (${usuarioId}, 'conciliacion_compras', 'sync', NULL,
            ${JSON.stringify(detalles)}::jsonb)
  `;
}
