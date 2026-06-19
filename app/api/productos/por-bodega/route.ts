import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { stock, productos } from "@/db/schema";
import { eq, and, gt, or, ilike, lt, desc } from "drizzle-orm";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bodegaId = Number(searchParams.get("bodegaId") ?? "0");
  const q = searchParams.get("q") ?? undefined;
  const cursor = Number(searchParams.get("cursor") ?? "0");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

  if (!bodegaId || bodegaId <= 0) {
    return NextResponse.json({ error: "bodegaId requerido" }, { status: 400 });
  }

  const where = and(
    eq(stock.bodegaId, bodegaId),
    gt(stock.cantidad, 0),
    cursor ? lt(productos.id, cursor) : undefined,
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
      cantidad: stock.cantidad,
    })
    .from(stock)
    .innerJoin(productos, eq(stock.productoId, productos.id))
    .where(where)
    .orderBy(desc(productos.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
