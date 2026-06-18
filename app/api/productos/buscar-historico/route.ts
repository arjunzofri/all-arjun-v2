import { NextResponse } from "next/server";
import { buscarProductoHistorico } from "@/db/vidadigital/queries";
import { buscarHistoricoSchema } from "@/lib/validations";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const parsed = buscarHistoricoSchema.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetro q requerido" }, { status: 400 });
  }

  const results = await buscarProductoHistorico(parsed.data.q);
  return NextResponse.json(results);
}
