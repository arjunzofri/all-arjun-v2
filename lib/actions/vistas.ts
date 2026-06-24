"use server";

import { db } from "@/db";
import { bodegas, modulos, stock, productos, movimientos, users } from "@/db/schema";
import { eq, lt, desc, and, gt, or, ilike, sql, inArray } from "drizzle-orm";

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

// ── Nombre de una ubicación por id ─────────────────────────────────────
export async function getNombreUbicacion(
  tipo: "bodega" | "modulo",
  id: number
): Promise<string> {
  if (tipo === "bodega") {
    const rows = await db
      .select({ nombre: bodegas.nombre })
      .from(bodegas)
      .where(eq(bodegas.id, id))
      .limit(1);
    return rows[0]?.nombre ?? `Bodega ${id}`;
  } else {
    const rows = await db
      .select({ nombre: modulos.nombre })
      .from(modulos)
      .where(eq(modulos.id, id))
      .limit(1);
    return rows[0]?.nombre ?? `Modulo ${id}`;
  }
}


// ── Movimientos de un producto en una ubicacion especifica ──────────────
export async function getMovimientosPorProductoUbicacion(params: {
  productoId: number;
  tipo: "bodega" | "modulo";
  ubicacionId: number;
}) {
  const { productoId, tipo, ubicacionId } = params;

  const columnaUbicacion = tipo === "bodega"
    ? movimientos.bodegaOrigenId
    : movimientos.moduloDestinoId;

  const rows = await db
    .select({
      id:             movimientos.id,
      tipo:           movimientos.tipo,
      folio:          movimientos.folio,
      cantidad:       movimientos.cantidad,
      fechaCompra:    movimientos.fechaCompra,
      createdAt:      movimientos.createdAt,
      precioUnitario: movimientos.precioUnitario,
      bodegaId:       movimientos.bodegaOrigenId,
      moduloId:       movimientos.moduloDestinoId,
      usuario:        users.username,
    })
    .from(movimientos)
    .innerJoin(users, eq(users.id, movimientos.usuarioId))
    .where(
      and(
        eq(movimientos.productoId, productoId),
        eq(columnaUbicacion, ubicacionId),
      )
    )
    .orderBy(desc(movimientos.createdAt));

  // Traer nombres de bodegas y modulos referenciados
  const bodegaIds = [...new Set(rows.map(r => r.bodegaId).filter(Boolean))] as number[];
  const moduloIds  = [...new Set(rows.map(r => r.moduloId).filter(Boolean))] as number[];

  const [bodegaRows, moduloRows] = await Promise.all([
    bodegaIds.length > 0
      ? db.select({ id: bodegas.id, nombre: bodegas.nombre }).from(bodegas).where(inArray(bodegas.id, bodegaIds))
      : Promise.resolve([]),
    moduloIds.length > 0
      ? db.select({ id: modulos.id, nombre: modulos.nombre }).from(modulos).where(inArray(modulos.id, moduloIds))
      : Promise.resolve([]),
  ]);

  const bodegaMap = new Map(bodegaRows.map(b => [b.id, b.nombre]));
  const moduloMap = new Map(moduloRows.map(m => [m.id, m.nombre]));

  const entradas = rows
    .filter(r => r.tipo === "entrada")
    .map(r => ({
      id:             r.id,
      folio:          r.folio,
      fecha:          r.fechaCompra ?? r.createdAt.toISOString().split("T")[0],
      cantidad:       r.cantidad,
      precioUnitario: r.precioUnitario !== null ? Number(r.precioUnitario) : null,
    }));

  const salidas = rows
    .filter(r => r.tipo === "salida" || r.tipo === "retorno")
    .map(r => ({
      id:       r.id,
      tipo:     r.tipo as string,
      fecha:    r.createdAt.toISOString().split("T")[0],
      cantidad: r.cantidad,
      destino:  r.moduloId ? (moduloMap.get(r.moduloId) ?? null)
                           : r.bodegaId ? (bodegaMap.get(r.bodegaId) ?? null) : null,
      usuario:  r.usuario,
    }));

  return { entradas, salidas };
}