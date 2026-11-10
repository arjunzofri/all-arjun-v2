export type OrigenEmpresa = "vida" | "sanjh";

export interface LoteCompra {
  folio: string;
  /** ISO "YYYY-MM-DD" (o timestamp ISO). null = fecha desconocida → se trata como el más antiguo. */
  fecha: string | null;
  cantidad: number;
  /** Costo unitario USD (precdocd). null = lote sin costo (ej. entrada manual MAN-). */
  costoUnitario: number | null;
  /** Esquema de Vida Digital del que proviene el lote. */
  origen?: OrigenEmpresa;
}

export interface PartidaValorizada {
  folio: string;
  fecha: string | null;
  cantidadComprada: number;
  cantidadRemanente: number;
  costoUnitario: number | null;
  /** cantidadRemanente * costoUnitario redondeado a 2 decimales. null si el lote no tiene costo. */
  valor: number | null;
  /** Propaga LoteCompra.origen. */
  origen?: OrigenEmpresa;
}

export interface ResultadoInversion {
  /** Orden: más reciente primero (misma fecha → folio descendente). */
  partidas: PartidaValorizada[];
  /** Suma de `valor` de las partidas (2 decimales). */
  valorTotal: number;
  /** Suma de cantidadComprada de todos los lotes. */
  cantidadTotalCompras: number;
  /** Suma de remanentes de lotes CON costo. */
  cantidadValorizada: number;
  /** stockActual - cantidadValorizada (>= 0). Incluye stock que excede las compras y remanentes sin costo. */
  cantidadSinCosto: number;
  stockActual: number;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

export function calcularInversionFifo(
  lotes: readonly LoteCompra[],
  stockActual: number
): ResultadoInversion {
  if (stockActual < 0) {
    throw new RangeError(`stockActual negativo: ${stockActual}`);
  }
  for (const lote of lotes) {
    if (lote.cantidad < 0) {
      throw new RangeError(`Lote ${lote.folio}: cantidad negativa (${lote.cantidad})`);
    }
    if (lote.costoUnitario !== null && lote.costoUnitario < 0) {
      throw new RangeError(
        `Lote ${lote.folio}: costoUnitario negativo (${lote.costoUnitario})`
      );
    }
  }

  // FIFO desde la compra más reciente. Orden lexicográfico de ISO = cronológico.
  // Desempate: fecha DESC → folio DESC → origen (vida, sanjh, sin origen) →
  // costo ASC. Determinista aunque la misma nota venga de ambas empresas.
  const rankOrigen = (o?: OrigenEmpresa): number =>
    o === "vida" ? 0 : o === "sanjh" ? 1 : 2;
  const ordenados = [...lotes].sort((a, b) => {
    const fa = a.fecha ?? "";
    const fb = b.fecha ?? "";
    if (fa !== fb) return fa < fb ? 1 : -1;
    if (a.folio !== b.folio) return a.folio < b.folio ? 1 : -1;
    const ra = rankOrigen(a.origen);
    const rb = rankOrigen(b.origen);
    if (ra !== rb) return ra - rb;
    return (a.costoUnitario ?? 0) - (b.costoUnitario ?? 0);
  });

  let restante = stockActual;
  const partidas: PartidaValorizada[] = ordenados.map((lote) => {
    const cantidadRemanente = Math.min(restante, lote.cantidad);
    restante -= cantidadRemanente;
    return {
      folio: lote.folio,
      fecha: lote.fecha,
      cantidadComprada: lote.cantidad,
      cantidadRemanente,
      costoUnitario: lote.costoUnitario,
      valor:
        lote.costoUnitario === null
          ? null
          : round2(cantidadRemanente * lote.costoUnitario),
      origen: lote.origen,
    };
  });

  const valorTotal = round2(
    partidas.reduce((s, p) => s + (p.valor ?? 0), 0)
  );
  const cantidadTotalCompras = ordenados.reduce((s, l) => s + l.cantidad, 0);
  const cantidadValorizada = partidas.reduce(
    (s, p) => (p.costoUnitario === null ? s : s + p.cantidadRemanente),
    0
  );

  return {
    partidas,
    valorTotal,
    cantidadTotalCompras,
    cantidadValorizada,
    cantidadSinCosto: Math.max(0, stockActual - cantidadValorizada),
    stockActual,
  };
}
