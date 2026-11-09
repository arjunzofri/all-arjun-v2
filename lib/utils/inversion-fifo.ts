export interface LoteCompra {
  folio: string;
  /** ISO "YYYY-MM-DD" (o timestamp ISO). null = fecha desconocida → se trata como el más antiguo. */
  fecha: string | null;
  cantidad: number;
  /** Costo unitario USD (precdocd). null = lote sin costo (ej. entrada manual MAN-). */
  costoUnitario: number | null;
}

export interface PartidaValorizada {
  folio: string;
  fecha: string | null;
  cantidadComprada: number;
  cantidadRemanente: number;
  costoUnitario: number | null;
  /** cantidadRemanente * costoUnitario redondeado a 2 decimales. null si el lote no tiene costo. */
  valor: number | null;
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
  const ordenados = [...lotes].sort((a, b) => {
    if (a.fecha === null || b.fecha === null) {
      if (a.fecha === b.fecha) return 0;
      return a.fecha === null ? 1 : -1;
    }
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    if (a.folio === b.folio) return 0;
    return a.folio < b.folio ? 1 : -1;
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
