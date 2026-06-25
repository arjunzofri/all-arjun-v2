"use server";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { auth } from "@/lib/auth";

const transferenciaSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  cantidad: z.number().int().positive("Cantidad debe ser > 0"),
  bodegaOrigenId: z.number().int().positive("Bodega origen requerida"),
  bodegaDestinoId: z.number().int().positive("Bodega destino requerida"),
  idempotencyKey: z.string().min(1, "Idempotency key requerida"),
  observaciones: z.string().max(500).optional(),
});

export type TransferirEntreBodegasInput = z.infer<typeof transferenciaSchema>;

export async function transferirEntreBodegas(input: TransferirEntreBodegasInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const userId = Number(session.user.id);

  const parsed = transferenciaSchema.parse(input);
  const { codigo, cantidad, bodegaOrigenId, bodegaDestinoId, idempotencyKey, observaciones } = parsed;

  // Validación temprana: origen ≠ destino
  if (bodegaOrigenId === bodegaDestinoId) {
    throw new Error("Bodega origen y destino deben ser distintas");
  }

  const sql = neon(process.env.DATABASE_URL!);
  const folioOut = `TRF-${idempotencyKey}-OUT`;
  const folioIn = `TRF-${idempotencyKey}-IN`;

  // Validar que ambas bodegas existen
  const bodegaOrigen = await sql`SELECT id FROM bodegas WHERE id = ${bodegaOrigenId}`;
  if ((bodegaOrigen as unknown[]).length === 0) throw new Error("Bodega origen no encontrada");

  const bodegaDestino = await sql`SELECT id FROM bodegas WHERE id = ${bodegaDestinoId}`;
  if ((bodegaDestino as unknown[]).length === 0) throw new Error("Bodega destino no encontrada");

  // CTE atómica: stock_check con FOR UPDATE → decremento origen → incremento destino → 2 movimientos
  const result = await sql`
    WITH producto AS (
      SELECT id FROM productos WHERE codigo = ${codigo}
    ),
    existing_out AS (
      SELECT id FROM movimientos
      WHERE folio = ${folioOut}
        AND producto_id = (SELECT id FROM producto)
    ),
    existing_in AS (
      SELECT id FROM movimientos
      WHERE folio = ${folioIn}
        AND producto_id = (SELECT id FROM producto)
    ),
    stock_check AS (
      SELECT cantidad FROM stock
      WHERE producto_id = (SELECT id FROM producto)
        AND bodega_id = ${bodegaOrigenId}
        AND cantidad >= ${cantidad}
        AND NOT EXISTS (SELECT 1 FROM existing_out)
        AND NOT EXISTS (SELECT 1 FROM existing_in)
      FOR UPDATE
    ),
    decremento AS (
      UPDATE stock
      SET cantidad = cantidad - ${cantidad}, updated_at = NOW()
      WHERE producto_id = (SELECT id FROM producto)
        AND bodega_id = ${bodegaOrigenId}
        AND EXISTS (SELECT 1 FROM stock_check)
    ),
    incremento AS (
      INSERT INTO stock (producto_id, bodega_id, cantidad)
      SELECT (SELECT id FROM producto), ${bodegaDestinoId}, ${cantidad}
      WHERE EXISTS (SELECT 1 FROM stock_check)
      ON CONFLICT (producto_id, bodega_id)
      DO UPDATE SET cantidad = stock.cantidad + ${cantidad}, updated_at = NOW()
    ),
    mov_out AS (
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id, observaciones)
      SELECT ${folioOut}, (SELECT id FROM producto), 'salida', ${cantidad}, ${bodegaOrigenId}, ${userId}, ${observaciones ?? null}
      WHERE EXISTS (SELECT 1 FROM stock_check)
      RETURNING id
    ),
    mov_in AS (
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id, observaciones)
      SELECT ${folioIn}, (SELECT id FROM producto), 'entrada', ${cantidad}, ${bodegaDestinoId}, ${userId}, ${observaciones ?? null}
      WHERE EXISTS (SELECT 1 FROM stock_check)
      RETURNING id
    )
    SELECT
      (SELECT id FROM mov_out) AS out_id,
      (SELECT id FROM mov_in) AS in_id
  `;

  const rows = result as unknown as { out_id: number | null; in_id: number | null }[];

  if (!rows[0]?.out_id) {
    // Si no se insertó, verificar por qué
    const dup = await sql`SELECT id FROM movimientos WHERE folio = ${folioOut}`;
    if ((dup as unknown[]).length > 0) {
      return { ok: false, reason: "idempotente" as const };
    }
    throw new Error("Stock insuficiente en bodega origen");
  }

  return { ok: true as const, outId: rows[0].out_id, inId: rows[0].in_id };
}
