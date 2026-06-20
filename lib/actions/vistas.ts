"use server";

import { db } from "@/db";
import { bodegas, modulos, stock, productos } from "@/db/schema";
import { eq, lt, desc, and, gt, or, ilike, sql } from "drizzle-orm";

// ── Resumen de bodegas ──────────────────────────────────────────────────
export async function getBodegas() {
  const rows = await db
    .select({
      id: bodegas.id,
      nombre: bodegas.nombre,
      totalStock: sql<number>`COALESCE(SUM(${stock.cantidad}), 0)`.mapWith(Number),
    })
    .from(bodegas)
    .leftJoin(stock, eq(bodegas.id, stock.bodegaId))
    .groupBy(bodegas.id)
    .orderBy(bodegas.id);

  return rows;
}

// ── Resumen de módulos ──────────────────────────────────────────────────
export async function getModulos() {
  const rows = await db
    .select({
      id: modulos.id,
      nombre: modulos.nombre,
      totalStock: sql<number>`COALESCE(SUM(${stock.cantidad}), 0)`.mapWith(Number),
    })
    .from(modulos)
    .leftJoin(stock, eq(modulos.id, stock.moduloId))
    .groupBy(modulos.id)
    .orderBy(modulos.id);

  return rows;
}

// ── Stock por ubicación (bodega o módulo) ───────────────────────────────
export async function getStockPorUbicacion(params: {
  tipo: "bodega" | "modulo";
  ubicacionId: number;
  limit?: number;
  cursor?: number;
  q?: string;
  soloConStock?: boolean;
}) {
  const { tipo, ubicacionId, limit = 20, cursor, q, soloConStock = true } = params;
  const columna = tipo === "bodega" ? stock.bodegaId : stock.moduloId;

  const where = and(
    eq(columna, ubicacionId),
    cursor !== undefined ? lt(productos.id, cursor) : undefined,
    soloConStock ? gt(stock.cantidad, 0) : undefined,
    q
      ? or(
          ilike(productos.codigo, `%${q}%`),
          ilike(productos.detalle, `%${q}%`)
        )
      : undefined
  );

  const rows = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      detalle: productos.detalle,
      imagenUrl: productos.imagenUrl,
      packing: productos.packing,
      cantidad: stock.cantidad,
    })
    .from(stock)
    .innerJoin(productos, eq(stock.productoId, productos.id))
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
