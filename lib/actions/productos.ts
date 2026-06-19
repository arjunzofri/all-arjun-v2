"use server";

import { db } from "@/db";
import { productos, movimientos, activityLog, stock, bodegas, modulos } from "@/db/schema";
import { eq, and, lt, gt, desc, or, ilike, inArray, sql } from "drizzle-orm";
import { mergeProductStock } from "@/lib/utils/merge-product-stock";

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

  // Stock agregado si hay productos en la página
  if (items.length > 0) {
    const ids = items.map((p) => p.id);

    const [bodegaRows, moduloRows] = await Promise.all([
      db
        .select({
          productoId: stock.productoId,
          id: bodegas.id,
          nombre: bodegas.nombre,
          cantidad: sql<number>`SUM(${stock.cantidad})`.mapWith(Number),
        })
        .from(stock)
        .innerJoin(bodegas, eq(stock.bodegaId, bodegas.id))
        .where(and(inArray(stock.productoId, ids), gt(stock.cantidad, 0)))
        .groupBy(stock.productoId, bodegas.id, bodegas.nombre),
      db
        .select({
          productoId: stock.productoId,
          id: modulos.id,
          nombre: modulos.nombre,
          cantidad: sql<number>`SUM(${stock.cantidad})`.mapWith(Number),
        })
        .from(stock)
        .innerJoin(modulos, eq(stock.moduloId, modulos.id))
        .where(and(inArray(stock.productoId, ids), gt(stock.cantidad, 0)))
        .groupBy(stock.productoId, modulos.id, modulos.nombre),
    ]);

    const stockMap = mergeProductStock(items, bodegaRows, moduloRows);

    return {
      items: items.map((p) => {
        const s = stockMap.get(p.id);
        return {
          ...p,
          stockBodegas: s?.bodegas ?? [],
          stockModulos: s?.modulos ?? [],
        };
      }),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  return {
    items: items.map((p) => ({ ...p, stockBodegas: [], stockModulos: [] })),
    nextCursor: null,
  };
}

// ── Ficha individual ─────────────────────────────────────────────────────
export async function getProducto(id: number) {
  const [producto] = await db
    .select()
    .from(productos)
    .where(eq(productos.id, id));

  if (!producto) return null;

  const [historial, bodegaRows, moduloRows] = await Promise.all([
    db
      .select()
      .from(movimientos)
      .where(eq(movimientos.productoId, id))
      .orderBy(desc(movimientos.createdAt))
      .limit(50),
    db
      .select({
        productoId: stock.productoId,
        id: bodegas.id,
        nombre: bodegas.nombre,
        cantidad: sql<number>`SUM(${stock.cantidad})`.mapWith(Number),
      })
      .from(stock)
      .innerJoin(bodegas, eq(stock.bodegaId, bodegas.id))
      .where(and(eq(stock.productoId, id), gt(stock.cantidad, 0)))
      .groupBy(stock.productoId, bodegas.id, bodegas.nombre),
    db
      .select({
        productoId: stock.productoId,
        id: modulos.id,
        nombre: modulos.nombre,
        cantidad: sql<number>`SUM(${stock.cantidad})`.mapWith(Number),
      })
      .from(stock)
      .innerJoin(modulos, eq(stock.moduloId, modulos.id))
      .where(and(eq(stock.productoId, id), gt(stock.cantidad, 0)))
      .groupBy(stock.productoId, modulos.id, modulos.nombre),
  ]);

  const stockMap = mergeProductStock([producto], bodegaRows, moduloRows);
  const s = stockMap.get(producto.id);

  return {
    ...producto,
    movimientos: historial,
    bodegas: s?.bodegas ?? [],
    modulos: s?.modulos ?? [],
  };
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
