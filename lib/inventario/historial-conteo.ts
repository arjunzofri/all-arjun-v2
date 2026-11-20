/** Clave de remonte de <HistorialConteos>: usuario + producto + IDs vigentes ordenados asc. */
export function claveHistorial(usuarioId: string, productoId: number, posiciones: readonly { id: number }[]): string {
  return `${usuarioId}:${productoId}:${posiciones.map((p) => p.id).sort((a, b) => a - b).join(",")}`;
}
