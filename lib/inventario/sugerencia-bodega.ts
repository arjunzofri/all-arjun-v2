import { getBodegaPorCodigoIngreso } from "@/lib/utils/get-bodega-por-codigo-ingreso";

export type SugerenciaBodega = {
  bodega: 1 | 2; // dominio de ubicaciones, no bodegas.id
  bodegaId: number; codigoIngreso: string; administrativa: boolean;
};
// Puente nombre -> dominio. Único lugar donde se nombra la bodega.
const DOMINIO: Record<string, 1 | 2> = { "Bodega 1 Vida Digital": 1, "Bodega 2 Vida Digital": 2 };

export function resolverSugerenciaBodega(codigoCrudo: string | null | undefined, bodegas: readonly { id: number; nombre: string }[]): SugerenciaBodega | null {
  const codigo = codigoCrudo?.trim() || null;
  const nombre = codigo ? getBodegaPorCodigoIngreso(codigo) : null;
  const fila = nombre ? bodegas.find((b) => b.nombre === nombre) : undefined;
  const bodega = nombre ? DOMINIO[nombre] : undefined;
  if (!codigo || !nombre || !fila || !bodega) return null;
  return { bodega, bodegaId: fila.id, codigoIngreso: codigo, administrativa: codigo === "GL2" };
}
export function bodegaActivaDe(trabajo: 1 | 2 | null, sugerencia: SugerenciaBodega | null | undefined): 1 | 2 | null {
  return trabajo ?? sugerencia?.bodega ?? null;
}
