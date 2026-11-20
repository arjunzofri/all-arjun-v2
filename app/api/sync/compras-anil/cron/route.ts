import { timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { flagActivo } from "@/lib/feature-flags";
import { syncComprasAnilInventario } from "@/lib/sync/compras-anil";
import { ACCION_CORRIDA, MSG_ERROR_CORRIDA } from "@/lib/sync/estado-compras";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function autorizado(header: string | null, secreto: string): boolean {
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(header ?? "");
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

/** Disparo desde cron-job.org. Solo modo inventario ON; nunca legacy. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (!autorizado(request.headers.get("authorization"), secreto))
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!flagActivo("inventario_bodega"))
    return NextResponse.json({ error: "Modo inventario apagado" }, { status: 409 });

  const sql = neon(process.env.DATABASE_URL!);
  let usuarioId: number | null = null;
  const registrar = async (detalles: Record<string, unknown>) => {
    if (usuarioId === null) return; // sin admin no hay usuario_id válido (NOT NULL)
    try {
      await sql`
        INSERT INTO activity_log (usuario_id, accion, entidad, detalles)
        VALUES (${usuarioId}, ${ACCION_CORRIDA}, 'compras', ${JSON.stringify(detalles)}::jsonb)
      `;
    } catch (err) {
      console.error("No se pudo registrar la corrida cron:", err);
    }
  };

  try {
    const admin = (await sql`
      SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1
    `) as { id: number }[];
    usuarioId = admin[0]?.id ?? null;
    const result = await syncComprasAnilInventario();
    if (result === null)
      return NextResponse.json({ error: "Sincronización en curso", enCurso: true }, { status: 409 });
    await registrar({
      origen: "cron", ok: true, procesadas: result.procesadas, insertadas: result.insertadas,
      omitidas: result.omitidas, pendientes: result.pendientes, watermark: result.watermark,
    });
    return NextResponse.json({
      procesadas: result.procesadas, insertadas: result.insertadas, omitidas: result.omitidas,
      pendientes: result.pendientes, watermark: result.watermark,
    });
  } catch (err) {
    // El secreto nunca se loguea: solo el nombre del error.
    console.error("Cron compras falló:", err instanceof Error ? err.name : "error");
    await registrar({ origen: "cron", ok: false, error: MSG_ERROR_CORRIDA });
    return NextResponse.json({ error: MSG_ERROR_CORRIDA }, { status: 500 });
  }
}
