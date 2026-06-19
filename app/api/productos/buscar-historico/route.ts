import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { buscarProductoHistorico } from "@/db/vidadigital/queries";

const qSchema = z.object({ q: z.string().min(1, "Parámetro q requerido") });

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const parsed = qSchema.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetro q requerido" }, { status: 400 });
  }

  const results = await buscarProductoHistorico(parsed.data.q);
  return NextResponse.json(results);
}
