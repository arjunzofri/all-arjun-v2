export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";
import { syncComprasAnil } from "@/lib/sync/compras-anil";
import { registrarConciliacion } from "@/lib/sync/conciliacion-compras";

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
    if (result.conciliacion !== undefined) {
      // Auditoría best-effort: si falla el log, el sync responde 200 igual.
      try {
        await registrarConciliacion(
          sql,
          Number(session.user.id),
          result.conciliacion,
        );
      } catch (err) {
        console.error("No se pudo registrar la conciliación:", err);
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
