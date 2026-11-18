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

const entradaBorradorSchema = borradorConteoSchema.pick({
  productoId: true, ubicacion: true, expectedConteoId: true,
});
const nonceSchema = borradorConteoSchema.shape.nonce;

const esClaveValida = (productoId: unknown, ubicacion: unknown): boolean =>
  borradorConteoSchema.shape.productoId.safeParse(productoId).success &&
  ubicacionInventarioSchema.safeParse(ubicacion).success;

export function obtenerBorrador(
  borradores: BorradoresConteo,
  productoId: number,
  ubicacion: UbicacionInventario,
): BorradorConteo | null {
  if (!esClaveValida(productoId, ubicacion)) return null;
  return borradores[claveBorrador(productoId, ubicacion)] ?? null;
}

export function guardarCantidadTexto(
  borradores: BorradoresConteo,
  entrada: EntradaBorrador,
  texto: string,
  ahora: number,
  crearNonce: () => string,
): { borradores: BorradoresConteo; borrador: BorradorConteo | null } {
  const valida =
    entradaBorradorSchema.safeParse(entrada).success &&
    borradorConteoSchema.shape.cantidadTexto.safeParse(texto).success &&
    borradorConteoSchema.shape.actualizadoEn.safeParse(ahora).success;
  if (!valida) return { borradores, borrador: null };
  const { productoId, ubicacion, expectedConteoId } = entrada;
  const clave = claveBorrador(productoId, ubicacion);
  const previo = borradores[clave];
  if (previo && previo.cantidadTexto === texto) {
    return { borradores, borrador: previo };
  }
  const nonce = crearNonce();
  if (!nonceSchema.safeParse(nonce).success) {
    return { borradores, borrador: null };
  }
  const borrador: BorradorConteo = {
    productoId: previo?.productoId ?? productoId,
    ubicacion: previo?.ubicacion ?? ubicacion,
    cantidadTexto: texto,
    expectedConteoId: previo ? previo.expectedConteoId : expectedConteoId,
    nonce,
    actualizadoEn: ahora,
  };
  return { borradores: { ...borradores, [clave]: borrador }, borrador };
}

export function descartarBorrador(
  borradores: BorradoresConteo,
  productoId: number,
  ubicacion: UbicacionInventario,
  nonceEsperado?: string,
): BorradoresConteo {
  if (!esClaveValida(productoId, ubicacion)) return borradores;
  const clave = claveBorrador(productoId, ubicacion);
  const previo = borradores[clave];
  if (!previo) return borradores;
  const nonceCoincide = nonceEsperado === undefined ||
    (nonceSchema.safeParse(nonceEsperado).success && previo.nonce === nonceEsperado);
  if (!nonceCoincide) return borradores;
  const resto = { ...borradores };
  delete resto[clave];
  return resto;
}

export function borradoresDeProducto(borradores: BorradoresConteo, productoId: number): BorradorConteo[] {
  if (!borradorConteoSchema.shape.productoId.safeParse(productoId).success) {
    return [];
  }
  return Object.entries(borradores)
    .filter(([, borrador]) => borrador.productoId === productoId)
    .sort(([ka, a], [kb, b]) =>
      b.actualizadoEn - a.actualizadoEn || (ka < kb ? -1 : ka > kb ? 1 : 0))
    .map(([, borrador]) => borrador);
}

export function ultimoBorradorCompatible(
  borradores: BorradoresConteo,
  productoId: number,
  bodega: UbicacionInventario["bodega"],
): BorradorConteo | null {
  if (bodega !== 1 && bodega !== 2) return null;
  return borradoresDeProducto(borradores, productoId)
    .find((borrador) => borrador.ubicacion.bodega === bodega) ?? null;
}
