export interface LoteValorizacion {
  id: number; folio: string; item: number | null;
  fechaConfirmacion: string; cantidad: number; precioUnitario: number | null;
}
export interface PosicionValorizacion {
  id: number; bodega: 1 | 2; cantidad: number; fechaConteo: string;
}
export interface PartidaValorizacion {
  loteId: number; folio: string; item: number | null; fechaConfirmacion: string;
  cantidadComprada: number; cantidadSaldo: number; costoUnitario: number | null; valor: number | null;
}
export interface ValorizacionCodigo {
  stock: number; valorTotal: number; cantidadValorizada: number; cantidadSinCosto: number;
  incompleto: boolean; costoPromedio: number | null; fechaConteoMin: string | null;
  fechaConteoMax: string | null; fechasDistintas: boolean; partidas: PartidaValorizacion[];
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

// Desempate: fecha DESC → folio DESC → item DESC (null al final) → id DESC.
function compararLotes(a: LoteValorizacion, b: LoteValorizacion): number {
  if (a.fechaConfirmacion !== b.fechaConfirmacion) return a.fechaConfirmacion < b.fechaConfirmacion ? 1 : -1;
  if (a.folio !== b.folio) return a.folio < b.folio ? 1 : -1;
  if (a.item !== b.item) return a.item === null ? 1 : b.item === null ? -1 : b.item - a.item;
  return b.id - a.id;
}

export function calcularValorizacionConteos(
  lotes: readonly LoteValorizacion[],
  posiciones: readonly PosicionValorizacion[]
): ValorizacionCodigo {
  for (const l of lotes) {
    if (l.cantidad < 0) throw new RangeError(`Lote ${l.folio} (id ${l.id}): cantidad negativa (${l.cantidad})`);
    if (l.precioUnitario !== null && l.precioUnitario < 0) throw new RangeError(`Lote ${l.folio} (id ${l.id}): precioUnitario negativo (${l.precioUnitario})`);
  }
  for (const p of posiciones) if (p.cantidad < 0) throw new RangeError(`Posición id ${p.id}: cantidad negativa (${p.cantidad})`);

  const posOrdenadas = [...posiciones].sort((a, b) =>
    a.fechaConteo !== b.fechaConteo ? (a.fechaConteo < b.fechaConteo ? -1 : 1) : a.id - b.id
  );
  const loteOrdenados = [...lotes].sort(compararLotes);

  const restante = new Map(lotes.map((l) => [l.id, l.cantidad]));
  const saldo = new Map<number, number>();
  let stock = 0;
  for (const pos of posOrdenadas) {
    stock += pos.cantidad;
    let falta = pos.cantidad;
    for (const lote of loteOrdenados) {
      if (falta === 0) break;
      if (lote.fechaConfirmacion > pos.fechaConteo) continue; // compra posterior: no elegible
      const disp = restante.get(lote.id) ?? 0;
      if (disp === 0) continue;
      const usa = Math.min(falta, disp);
      restante.set(lote.id, disp - usa);
      saldo.set(lote.id, (saldo.get(lote.id) ?? 0) + usa);
      falta -= usa;
    }
  }

  const fechaConteoMin = posOrdenadas[0]?.fechaConteo ?? null;
  const fechaConteoMax = posOrdenadas.at(-1)?.fechaConteo ?? null;
  const partidas: PartidaValorizacion[] = loteOrdenados
    .filter((l) => fechaConteoMax !== null && l.fechaConfirmacion <= fechaConteoMax)
    .map((l) => {
      const cantidadSaldo = saldo.get(l.id) ?? 0;
      return {
        loteId: l.id, folio: l.folio, item: l.item, fechaConfirmacion: l.fechaConfirmacion,
        cantidadComprada: l.cantidad, cantidadSaldo, costoUnitario: l.precioUnitario,
        valor: l.precioUnitario === null ? null : round2(cantidadSaldo * l.precioUnitario),
      };
    });

  const valorTotal = round2(partidas.reduce((s, p) => s + (p.valor ?? 0), 0));
  const cantidadValorizada = partidas.reduce((s, p) => (p.costoUnitario === null ? s : s + p.cantidadSaldo), 0);
  const cantidadSinCosto = stock - cantidadValorizada;
  return {
    stock, valorTotal, cantidadValorizada, cantidadSinCosto, incompleto: cantidadSinCosto > 0,
    costoPromedio: cantidadValorizada > 0 ? round2(valorTotal / cantidadValorizada) : null,
    fechaConteoMin, fechaConteoMax,
    fechasDistintas: fechaConteoMin !== null && fechaConteoMin !== fechaConteoMax,
    partidas,
  };
}
