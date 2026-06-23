"use server";

import { db } from "@/db";
import { productos, movimientos, activityLog, stock, bodegas, modulos, movimientoVisaciones } from "@/db/schema";
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

  const [comprasRows, bodegaRows, moduloRows] = await Promise.all([
    db
      .select({
        id: movimientos.id,
        folio: movimientos.folio,
        fecha: movimientos.fechaCompra,
        cantidad: movimientos.cantidad,
        bodega: bodegas.nombre,
      })
      .from(movimientos)
      .innerJoin(bodegas, eq(movimientos.bodegaOrigenId, bodegas.id))
      .where(and(eq(movimientos.productoId, id), eq(movimientos.tipo, "entrada")))
      .orderBy(desc(movimientos.id)),
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

  // Visaciones hijas para los movimientos de entrada
  const comprasIds = comprasRows.map((c) => c.id);
  const visRows =
    comprasIds.length > 0
      ? await db
          .select({
            movimientoId: movimientoVisaciones.movimientoId,
            nroIngreso: movimientoVisaciones.nroIngreso,
            cantidad: movimientoVisaciones.cantidad,
          })
          .from(movimientoVisaciones)
          .where(inArray(movimientoVisaciones.movimientoId, comprasIds))
      : [];

  const visPorCompra = new Map<number, { nroIngreso: string; cantidad: number }[]>();
  for (const v of visRows) {
    const grupo = visPorCompra.get(v.movimientoId) ?? [];
    grupo.push({ nroIngreso: v.nroIngreso, cantidad: v.cantidad });
    visPorCompra.set(v.movimientoId, grupo);
  }

  const compras = comprasRows.map((c) => ({
    id: c.id,
    folio: c.folio,
    fecha: c.fecha,
    cantidad: c.cantidad,
    bodega: c.bodega,
    visaciones: visPorCompra.get(c.id) ?? [],
  }));

  const stockMap = mergeProductStock([producto], bodegaRows, moduloRows);
  const s = stockMap.get(producto.id);

  return {
    ...producto,
    compras,
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
