"use server";

import { db } from "@/db";
import { productos, movimientos, activityLog } from "@/db/schema";
import { eq, and, lt, desc, or, ilike } from "drizzle-orm";

type UpdateProductoInput = {
  codigoPersonal?: string;
  packing?: number;
  ubicacion?: string;
  observaciones?: string;
};

// ── Listado paginado ─────────────────────────────────────────────────────
export async function getProductos(params: {
  q?: string;
  limit: number;
  cursor?: number;
}) {
  const { q, limit, cursor } = params;

  const where = and(
    cursor !== undefined ? lt(productos.id, cursor) : undefined,
    q
      ? or(
          ilike(productos.codigo, `%${q}%`),
          ilike(productos.detalle, `%${q}%`)
        )
      : undefined
  );

  const rows = await db
    .select()
    .from(productos)
    .where(where)
    .orderBy(desc(productos.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

// ── Ficha individual ─────────────────────────────────────────────────────
export async function getProducto(id: number) {
  const [producto] = await db
    .select()
    .from(productos)
    .where(eq(productos.id, id));

  if (!producto) return null;

  const historial = await db
    .select()
    .from(movimientos)
    .where(eq(movimientos.productoId, id))
    .orderBy(desc(movimientos.createdAt))
    .limit(50);

  return { ...producto, movimientos: historial };
}

// ── Editar producto ──────────────────────────────────────────────────────
export async function updateProducto(
  id: number,
  input: UpdateProductoInput,
  usuarioId?: number
) {
  const [updated] = await db
    .update(productos)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(productos.id, id))
    .returning();

  // R3: auditoría si se modificó codigo_personal
  if (updated && input.codigoPersonal !== undefined && usuarioId) {
    await db.insert(activityLog).values({
      usuarioId,
      accion: "update_codigo_personal",
      entidad: "producto",
      entidadId: id,
      detalles: {
        valor_nuevo: input.codigoPersonal,
        valor_anterior: null, // ponytail: no leemos valor anterior para mantener 1 query
      },
    });
  }

  return updated;
}
