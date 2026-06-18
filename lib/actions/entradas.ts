"use server";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";

const entradaSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  detalle: z.string().optional(),
  cantidad: z.number().int().positive("Cantidad debe ser > 0"),
  bodegaId: z.number().int().positive("Bodega requerida"),
  idempotencyKey: z.string().min(1, "Idempotency key requerida"),
});

export type CrearEntradaInput = z.infer<typeof entradaSchema>;

export async function crearEntrada(input: CrearEntradaInput) {
  const parsed = entradaSchema.parse(input);
  const { codigo, detalle, cantidad, bodegaId, idempotencyKey } = parsed;

  const sql = neon(process.env.DATABASE_URL!);

  // Validar bodega
  const bodegaCheck = await sql`SELECT id FROM bodegas WHERE id = ${bodegaId}`;
  if ((bodegaCheck as unknown[]).length === 0) {
    throw new Error("Bodega no encontrada");
  }

  // Paso 1: upsert producto (idempotente)
  await sql`
    INSERT INTO productos (codigo, detalle)
    VALUES (${codigo}, ${detalle ?? null})
    ON CONFLICT (codigo) DO NOTHING
  `;

  // Paso 2: CTE atómica — stock + movimiento en un solo statement
  const folio = `MAN-${idempotencyKey}`;

  const result = await sql`
    WITH existing AS (
      SELECT id FROM movimientos WHERE folio = ${folio}
    ),
    stock_ok AS (
      INSERT INTO stock (producto_id, bodega_id, cantidad)
      SELECT p.id, ${bodegaId}, ${cantidad}
      FROM productos p
      WHERE p.codigo = ${codigo}
        AND NOT EXISTS (SELECT 1 FROM existing)
      ON CONFLICT (producto_id, bodega_id)
      DO UPDATE SET cantidad = stock.cantidad + ${cantidad}
    )
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
    SELECT ${folio}, p.id, 'entrada', ${cantidad}, ${bodegaId}, 1
    FROM productos p
    WHERE p.codigo = ${codigo}
      AND NOT EXISTS (SELECT 1 FROM existing)
    RETURNING id
  `;

  const rows = result as unknown as { id: number }[];
  return { movimientoId: rows[0]?.id ?? null };
}
