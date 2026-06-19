// NO tiene "use server" — función síncrona pura, exportada para test.

type StockUbicacion = { id: number; nombre: string; cantidad: number };

export function mergeProductStock<T extends { id: number }>(
  items: T[],
  bodegaRows: { productoId: number; id: number; nombre: string; cantidad: number }[],
  moduloRows: { productoId: number; id: number; nombre: string; cantidad: number }[],
): Map<number, { bodegas: StockUbicacion[]; modulos: StockUbicacion[] }> {
  const map = new Map<number, { bodegas: StockUbicacion[]; modulos: StockUbicacion[] }>();

  for (const item of items) {
    map.set(item.id, { bodegas: [], modulos: [] });
  }

  for (const row of bodegaRows) {
    const entry = map.get(row.productoId);
    if (entry) entry.bodegas.push({ id: row.id, nombre: row.nombre, cantidad: row.cantidad });
  }

  for (const row of moduloRows) {
    const entry = map.get(row.productoId);
    if (entry) entry.modulos.push({ id: row.id, nombre: row.nombre, cantidad: row.cantidad });
  }

  return map;
}
