/** Fase C — inv-17.1: adaptador puro seleccion -> payload de conteo. */
import { claveUbicacion, ubicacionInventarioSchema, type UbicacionInventario } from "./ubicaciones";
import { esBorradorValido, parsearCantidadTexto, type BorradorConteo } from "./borradores-conteo";
import { registrarConteoSchema, type RegistrarConteoInput } from "./contratos";
import type { PosicionContada } from "./consultas";

export type SeleccionParcial = {
  bodega: 1 | 2;
  planta: string;
  pasillo: string;
  posicion: string;
};

/** Valida la seleccion contra el schema real, sin completar defaults. */
export function construirUbicacion(s: SeleccionParcial): UbicacionInventario | null {
  const parsed = ubicacionInventarioSchema.safeParse(s);
  return parsed.success ? parsed.data : null;
}

/** Fila vigente: proyecta solo 4 campos, luego clave exacta; devuelve la fila original. */
export function posicionVigente(
  posiciones: PosicionContada[],
  u: UbicacionInventario,
): PosicionContada | null {
  const clave = claveUbicacion(u);
  for (const p of posiciones) {
    const proyectada = { bodega: p.bodega, planta: p.planta, pasillo: p.pasillo, posicion: p.posicion };
    const parsed = ubicacionInventarioSchema.safeParse(proyectada);
    if (parsed.success && claveUbicacion(parsed.data) === clave) return p;
  }
  return null;
}

/** Diferencia solo con anterior y cantidad validos; la ausencia no es cero. */
export function comparacion(
  anterior: number | null,
  texto: string,
): { cantidad: number | null; diferencia: number | null } {
  const cantidad = parsearCantidadTexto(texto);
  const diferencia = anterior !== null && cantidad !== null ? cantidad - anterior : null;
  return { cantidad, diferencia };
}

/** Payload exacto del action desde el draft vigente; null sin lanzar si esta corrupto. */
export function prepararConteo(borrador: BorradorConteo): RegistrarConteoInput | null {
  if (!esBorradorValido(borrador)) return null;
  const cantidad = parsearCantidadTexto(borrador.cantidadTexto);
  if (cantidad === null) return null;
  const parsed = registrarConteoSchema.safeParse({
    productoId: borrador.productoId,
    ubicacion: borrador.ubicacion,
    cantidad,
    expectedConteoId: borrador.expectedConteoId,
    idempotencyKey: borrador.nonce,
  });
  return parsed.success ? parsed.data : null;
}
