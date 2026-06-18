import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProductos } from "@/lib/actions/productos";
import { productosQuerySchema } from "@/lib/validations";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = productosQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    limit: searchParams.get("limit") ?? "20",
    cursor: searchParams.get("cursor") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const result = await getProductos(parsed.data);
  return NextResponse.json(result);
}
