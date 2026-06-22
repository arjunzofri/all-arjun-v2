"use server";

import { db } from "@/db";
import { movimientos, productos } from "@/db/schema";
import { eq, lt, desc, and, gte, lte, sql } from "drizzle-orm";

export type MovimientoItem = {
  id: number;
  tipo: string;
  cantidad: number;
  productoCodigo: string;
  productoDetalle: string | null;
  imagenUrl: string | null;
  observaciones: string | null;
  createdAt: Date;
};

export async function getMovimientos(params: {
  tipo?: string;
  productoId?: number;
  desde?: string;
  hasta?: string;
  limit?: number;
  cursor?: number;
}) {
  const { tipo, productoId, desde, hasta, limit = 20, cursor } = params;

  const where = and(
    cursor !== undefined ? lt(movimientos.id, cursor) : undefined,
    tipo ? eq(movimientos.tipo, tipo as "entrada" | "salida" | "retorno") : undefined,
    productoId ? eq(movimientos.productoId, productoId) : undefined,
    desde ? gte(movimientos.createdAt, new Date(desde)) : undefined,
    hasta ? lte(movimientos.createdAt, new Date(hasta + "T23:59:59")) : undefined
  );

  const rows = await db
    .select({
      id: movimientos.id,
      tipo: movimientos.tipo,
      cantidad: movimientos.cantidad,
      productoCodigo: productos.codigo,
      productoDetalle: productos.detalle,
      imagenUrl: productos.imagenUrl,
      observaciones: movimientos.observaciones,
      createdAt: movimientos.createdAt,
    })
    .from(movimientos)
    .innerJoin(productos, eq(movimientos.productoId, productos.id))
    .where(where)
    .orderBy(desc(movimientos.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
