import { z } from "zod";
import { ubicacionInventarioSchema } from "./ubicaciones";

const MAX_INT4 = 2147483647;

/** Entrada estricta: sin usuario, fecha ni claves extra. */
export const registrarConteoSchema = z.strictObject({
  productoId: z.number().int().positive().max(MAX_INT4),
  ubicacion: ubicacionInventarioSchema,
  cantidad: z.number().int().min(0).max(MAX_INT4),
  expectedConteoId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  idempotencyKey: z.uuid(),
});

export type RegistrarConteoInput = z.infer<typeof registrarConteoSchema>;

export interface ConteoDTO {
  id: number; productoId: number; bodega: number; planta: string; pasillo: string;
  posicion: string; cantidad: number; usuarioId: number; creadoEn: string;
}

export type RegistrarConteoRespuesta =
  | { ok: true; conteo: ConteoDTO; repetido: boolean }
  | { ok: false; conflicto: true; vigente: ConteoDTO | null }
  | { ok: false; error: string };
