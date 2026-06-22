"use server";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";

const retornoSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  cantidad: z.number().int().positive("Cantidad debe ser > 0"),
  moduloOrigenId: z.number().int().positive("Módulo origen requerido"),
  bodegaDestinoId: z.number().int().positive("Bodega destino requerida"),
  idempotencyKey: z.string().min(1, "Idempotency key requerida"),
  usuarioId: z.number().int().positive("Usuario requerido"),
  observaciones: z.string().max(500).optional(),
});

export type CrearRetornoInput = z.infer<typeof retornoSchema>;

export async function crearRetorno(input: CrearRetornoInput) {
  const parsed = retornoSchema.parse(input);
  const { codigo, cantidad, moduloOrigenId, bodegaDestinoId, idempotencyKey, usuarioId, observaciones } = parsed;

  const sql = neon(process.env.DATABASE_URL!);
  const folio = `RET-${idempotencyKey}`;

  // Validar módulo y bodega existen
  const modulo = await sql`SELECT id FROM modulos WHERE id = ${moduloOrigenId}`;
  if ((modulo as unknown[]).length === 0) throw new Error("Módulo origen no encontrado");

  const bodega = await sql`SELECT id FROM bodegas WHERE id = ${bodegaDestinoId}`;
  if ((bodega as unknown[]).length === 0) throw new Error("Bodega destino no encontrada");

  // CTE atómica: verificar stock en módulo + descuento módulo + incremento bodega + insert movimiento
  const result = await sql`
    WITH producto AS (
      SELECT id FROM productos WHERE codigo = ${codigo}
    ),
    existing AS (
      SELECT id FROM movimientos
      WHERE folio = ${folio}
        AND producto_id = (SELECT id FROM producto)
    ),
    stock_check AS (
      SELECT cantidad FROM stock
      WHERE producto_id = (SELECT id FROM producto)
        AND modulo_id = ${moduloOrigenId}
        AND cantidad >= ${cantidad}
        AND NOT EXISTS (SELECT 1 FROM existing)
      FOR UPDATE
    ),
    modulo_ok AS (
      UPDATE stock
      SET cantidad = cantidad - ${cantidad}, updated_at = NOW()
      WHERE producto_id = (SELECT id FROM producto)
        AND modulo_id = ${moduloOrigenId}
        AND EXISTS (SELECT 1 FROM stock_check)
    ),
    bodega_ok AS (
      INSERT INTO stock (producto_id, bodega_id, cantidad)
      SELECT (SELECT id FROM producto), ${bodegaDestinoId}, ${cantidad}
      WHERE EXISTS (SELECT 1 FROM stock_check)
      ON CONFLICT (producto_id, bodega_id)
      DO UPDATE SET cantidad = stock.cantidad + ${cantidad}, updated_at = NOW()
    )
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, modulo_destino_id, usuario_id, observaciones)
    SELECT ${folio}, (SELECT id FROM producto), 'retorno', ${cantidad}, ${bodegaDestinoId}, ${moduloOrigenId}, ${usuarioId}, ${observaciones ?? null}
    WHERE EXISTS (SELECT 1 FROM stock_check)
    RETURNING id
  `;

  const rows = result as unknown as { id: number }[];

  if (!rows[0]?.id) {
    const dup = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
    if ((dup as unknown[]).length > 0) {
      return { movimientoId: null, ok: false, reason: "idempotente" };
    }
    throw new Error("Stock insuficiente en módulo");
  }

  return { movimientoId: rows[0].id, ok: true };
}
