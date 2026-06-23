"use server";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { auth } from "@/lib/auth";

const salidaSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  cantidad: z.number().int().positive("Cantidad debe ser > 0"),
  bodegaOrigenId: z.number().int().positive("Bodega origen requerida"),
  moduloDestinoId: z.number().int().positive("Módulo destino requerido"),
  idempotencyKey: z.string().min(1, "Idempotency key requerida"),
  observaciones: z.string().max(500).optional(),
});

export type CrearSalidaInput = z.infer<typeof salidaSchema>;

export async function crearSalida(input: CrearSalidaInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const userId = Number(session.user.id);

  const parsed = salidaSchema.parse(input);
  const { codigo, cantidad, bodegaOrigenId, moduloDestinoId, idempotencyKey, observaciones } = parsed;

  const sql = neon(process.env.DATABASE_URL!);
  const folio = `SAL-${idempotencyKey}`;

  // Validar bodega y módulo existen
  const bodega = await sql`SELECT id FROM bodegas WHERE id = ${bodegaOrigenId}`;
  if ((bodega as unknown[]).length === 0) throw new Error("Bodega origen no encontrada");

  const modulo = await sql`SELECT id FROM modulos WHERE id = ${moduloDestinoId}`;
  if ((modulo as unknown[]).length === 0) throw new Error("Módulo destino no encontrado");

  // CTE atómica: verificar stock + descuento bodega + incremento módulo + insert movimiento
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
        AND bodega_id = ${bodegaOrigenId}
        AND cantidad >= ${cantidad}
        AND NOT EXISTS (SELECT 1 FROM existing)
      FOR UPDATE
    ),
    bodega_ok AS (
      UPDATE stock
      SET cantidad = cantidad - ${cantidad}, updated_at = NOW()
      WHERE producto_id = (SELECT id FROM producto)
        AND bodega_id = ${bodegaOrigenId}
        AND EXISTS (SELECT 1 FROM stock_check)
    ),
    modulo_ok AS (
      INSERT INTO stock (producto_id, modulo_id, cantidad)
      SELECT (SELECT id FROM producto), ${moduloDestinoId}, ${cantidad}
      WHERE EXISTS (SELECT 1 FROM stock_check)
      ON CONFLICT (producto_id, modulo_id)
      DO UPDATE SET cantidad = stock.cantidad + ${cantidad}, updated_at = NOW()
    )
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, modulo_destino_id, usuario_id, observaciones)
    SELECT ${folio}, (SELECT id FROM producto), 'salida', ${cantidad}, ${bodegaOrigenId}, ${moduloDestinoId}, ${userId}, ${observaciones ?? null}
    WHERE EXISTS (SELECT 1 FROM stock_check)
    RETURNING id
  `;

  const rows = result as unknown as { id: number }[];

  if (!rows[0]?.id) {
    // Si no se insertó, verificar por qué
    const dup = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
    if ((dup as unknown[]).length > 0) {
      return { movimientoId: null, ok: false, reason: "idempotente" };
    }
    throw new Error("Stock insuficiente");
  }

  return { movimientoId: rows[0].id, ok: true };
}
