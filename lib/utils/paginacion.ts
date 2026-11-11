/**
 * Parametros de paginacion del historial de movimientos.
 *
 * El cursor se recibe como argumento explicito. Leerlo desde el estado dentro
 * de un useCallback captura el valor del render anterior y repite la primera
 * pagina (P-20261110-2158-2).
 */
export function parametrosPagina(
  filtros: { tipo: string; desde: string; hasta: string },
  cursor: number | null | undefined
) {
  return {
    tipo: filtros.tipo === "todas" ? undefined : filtros.tipo,
    desde: filtros.desde || undefined,
    hasta: filtros.hasta || undefined,
    limit: 20,
    cursor: cursor ?? undefined,
  };
}
