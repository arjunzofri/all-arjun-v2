import { calcularInversionFifo } from "./inversion-fifo";
import type { LoteCompra } from "./inversion-fifo";
import type { StockCodigo } from "./inversion-lotes";

export interface FilaResumenInversion {
  codigo: string;
  detalle: string | null;
  stock: number;
  valorTotal: number;
  cantidadSinCosto: number;
  /** valorTotal / cantidadValorizada, round2, o null. */
  costoPromedioUnitario: number | null;
}

export interface TotalesResumenInversion {
  valorTotal: number;
  /** Σ stock. */
  unidades: number;
  /** Σ cantidadSinCosto. */
  unidadesSinCosto: number;
  codigosConStock: number;
  /** stock > 0 y lotes []. */
  codigosSinCompras: number;
}

export interface ResumenInversion {
  filas: FilaResumenInversion[];
  totales: TotalesResumenInversion;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Agregación pura del resumen global. Itera el universo de stock propio
 * (no los lotes); `stock <= 0` se descarta defensivamente.
 */
export function calcularResumenInversion(
  stockPorCodigo: ReadonlyMap<string, StockCodigo>,
  lotesPorCodigo: ReadonlyMap<string, readonly LoteCompra[]>
): ResumenInversion {
  const filas: FilaResumenInversion[] = [];
  let valorTotal = 0;
  let unidades = 0;
  let unidadesSinCosto = 0;
  let codigosSinCompras = 0;

  for (const [codigo, { stock, detalle }] of stockPorCodigo) {
    if (stock <= 0) continue;

    const lotes = lotesPorCodigo.get(codigo) ?? [];
    const r = calcularInversionFifo(lotes, stock);
    const cantidadValorizada = stock - r.cantidadSinCosto;
    const costoPromedioUnitario =
      cantidadValorizada > 0 ? round2(r.valorTotal / cantidadValorizada) : null;

    filas.push({
      codigo,
      detalle,
      stock,
      valorTotal: r.valorTotal,
      cantidadSinCosto: r.cantidadSinCosto,
      costoPromedioUnitario,
    });

    valorTotal += r.valorTotal;
    unidades += stock;
    unidadesSinCosto += r.cantidadSinCosto;
    if (lotes.length === 0) codigosSinCompras++;
  }

  filas.sort(
    (a, b) =>
      b.valorTotal - a.valorTotal ||
      (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0)
  );

  return {
    filas,
    totales: {
      valorTotal: round2(valorTotal),
      unidades,
      unidadesSinCosto,
      codigosConStock: filas.length,
      codigosSinCompras,
    },
  };
}
