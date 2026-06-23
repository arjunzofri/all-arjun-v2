export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";
import { syncComprasAnil } from "@/lib/sync/compras-anil";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT value FROM sync_watermark WHERE key = 'compras-anil'`;
  const corte = (rows as { value: string }[])[0]?.value ?? "2026-05-01";

  try {
    const result = await syncComprasAnil(corte);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
