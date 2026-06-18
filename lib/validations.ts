import { z } from "zod";

export const updateProductoSchema = z.object({
  codigoPersonal: z.string().max(50).optional(),
  packing: z.number().int().positive().optional(),
  ubicacion: z.string().max(100).optional(),
  observaciones: z.string().optional(),
});

export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;

export const productosQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
});

export const buscarHistoricoSchema = z.object({
  q: z.string().min(1, "Parámetro q requerido"),
});
