import { z } from "zod";

// Unico punto de verdad para editar un producto (ficha + ruta PATCH).
export const updateProductoSchema = z.object({
  codigoPersonal: z.string().max(50).optional(),
  packing: z
    .number()
    .int("El packing debe ser un entero mayor que 0")
    .positive("El packing debe ser un entero mayor que 0")
    .optional(),
  ubicacion: z.string().max(100).optional(),
  observaciones: z.string().optional(),
});

export type UpdateProductoInput = z.infer<typeof updateProductoSchema>;
