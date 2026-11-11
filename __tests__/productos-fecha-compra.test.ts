/**
 * Bug P-20261111-0307-1: la ficha del producto mostraba "---" en entradas sin
 * fecha_compra. getProducto debe respaldar con la fecha de Chile de created_at
 * (misma regla que lib/actions/vistas.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productos, movimientos, bodegas } from "@/db/schema";
import { getProducto } from "@/lib/actions/productos";

const sufijo = Date.now();
let productoId: number;
let bodegaId: number;

beforeAll(async () => {
  [{ id: productoId }] = await db
    .insert(productos)
    .values({ codigo: `T-FC-${sufijo}` })
    .returning({ id: productos.id });
  [{ id: bodegaId }] = await db
    .insert(bodegas)
    .values({ nombre: `T-FC-${sufijo}` })
    .returning({ id: bodegas.id });
  const base = { productoId, tipo: "entrada" as const, cantidad: 1, bodegaOrigenId: bodegaId, usuarioId: 1 };
  await db.insert(movimientos).values([
    // 2026-03-10 02:00 UTC = 2026-03-09 23:00 en Chile (UTC-3): distingue Chile de UTC.
    { ...base, folio: "SIN-FECHA", fechaCompra: null, createdAt: new Date("2026-03-10T02:00:00Z") },
    { ...base, folio: "CON-FECHA", fechaCompra: "2026-01-15", createdAt: new Date("2026-03-10T02:00:00Z") },
  ]);
});

afterAll(async () => {
  await db.delete(movimientos).where(eq(movimientos.productoId, productoId));
  await db.delete(bodegas).where(eq(bodegas.id, bodegaId));
  await db.delete(productos).where(eq(productos.id, productoId));
});

describe("getProducto — fecha del historial de compras", () => {
  it("sin fecha_compra usa la fecha de Chile de created_at", async () => {
    const p = await getProducto(productoId);
    expect(p!.compras.find((c) => c.folio === "SIN-FECHA")!.fecha).toBe("2026-03-09");
  });

  it("con fecha_compra devuelve esa fecha", async () => {
    const p = await getProducto(productoId);
    expect(p!.compras.find((c) => c.folio === "CON-FECHA")!.fecha).toBe("2026-01-15");
  });
});
