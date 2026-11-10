import type { CompraAnil } from "@/db/vidadigital/queries";

/** Estado de una nota en VD para clasificar notas app-only.
 * En 1B se mueve a `db/vidadigital/queries.ts` junto con `getEstadoNotasVd`. */
export interface EstadoNotaVd {
  folio: string;
  existe: boolean;
  fechconf: string | null;
  lineasConfirmadas: number;
  lineasValidas: number;
}

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
    if (v && a && v.cantidad !== a.cantidad) {
      diferencias.push(
        diferencia("cantidad_distinta", v, v.cantidad, a.cantidad),
      );
    } else if (v && !a) {
      diferencias.push(diferencia("falta_en_app", v, v.cantidad, 0));
    } else if (a && !v) {
      diferencias.push(diferencia("sobra_en_app", a, 0, a.cantidad));
    }
  }

  // Capa nota-level: folio que la app tiene y VD no devuelve ni una línea.
  const foliosVd = new Set([...vdAgg.values()].map((l) => l.folio));
  const unidadesAppPorFolio = new Map<string, number>();
  for (const l of appAgg.values()) {
    unidadesAppPorFolio.set(
      l.folio,
      (unidadesAppPorFolio.get(l.folio) ?? 0) + l.cantidad,
    );
  }
  for (const [folio, unidades] of unidadesAppPorFolio) {
    if (foliosVd.has(folio)) continue;
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
