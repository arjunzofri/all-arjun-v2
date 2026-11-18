import { z } from "zod";
import {
  claveUbicacion,
  ubicacionInventarioSchema,
  type UbicacionInventario,
} from "./ubicaciones";

/** Límite de int4 (columna de conteo) y de texto crudo aceptado en el borrador. */
export const MAX_CANTIDAD = 2147483647;
export const MAX_TEXTO_CANTIDAD = 32;

export type EntradaBorrador = {
  productoId: number;
  ubicacion: UbicacionInventario;
  expectedConteoId: number | null;
};

export type BorradorConteo = EntradaBorrador & {
  cantidadTexto: string;
  nonce: string;
  actualizadoEn: number;
};

export type BorradoresConteo = Record<string, BorradorConteo>;

const borradorConteoSchema = z.strictObject({
  productoId: z.number().int().gte(1).lte(MAX_CANTIDAD),
  ubicacion: ubicacionInventarioSchema,
  cantidadTexto: z.string().max(MAX_TEXTO_CANTIDAD),
  expectedConteoId: z
    .number()
    .int()
    .gte(1)
    .lte(Number.MAX_SAFE_INTEGER)
    .nullable(),
  nonce: z.uuid(),
  actualizadoEn: z.number().finite().gte(0),
});

/**
 * Convierte texto crudo a cantidad entera, o null si no es un entero válido.
 * Solo acepta dígitos con espacios exteriores; "" nunca es 0.
 */
export function parsearCantidadTexto(texto: unknown): number | null {
  if (typeof texto !== "string") return null;
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  const valor = Number(limpio);
  return Number.isSafeInteger(valor) && valor <= MAX_CANTIDAD ? valor : null;
}

export function claveBorrador(
  productoId: number,
  ubicacion: UbicacionInventario,
): string {
  return `${productoId}|${claveUbicacion(ubicacion)}`;
}

/** Valida la forma runtime de un borrador JSON sin lanzar nunca. */
export function esBorradorValido(entrada: unknown): entrada is BorradorConteo {
  return borradorConteoSchema.safeParse(entrada).success;
}
