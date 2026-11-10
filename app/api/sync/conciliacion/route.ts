export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";
import { flagActivo } from "@/lib/feature-flags";
import {
  conciliarComprasAnil,
  getDesdeConciliacion,
  registrarConciliacion,
} from "@/lib/sync/conciliacion-compras";

function fechaValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  if (!flagActivo("conciliacion_compras")) {
    return NextResponse.json(
      { error: "Conciliación deshabilitada" },
      { status: 404 },
    );
  }

  const sql = neon(process.env.DATABASE_URL!);

  try {
    const desdeParam = new URL(request.url).searchParams.get("desde");
    let desde: string;
    if (desdeParam !== null) {
      if (!fechaValida(desdeParam)) {
        return NextResponse.json({ error: "desde inválido" }, { status: 400 });
      }
      desde = desdeParam;
    } else {
      desde = await getDesdeConciliacion(sql);
    }

    const resultado = await conciliarComprasAnil(desde);
    await registrarConciliacion(sql, Number(session.user.id), resultado);
    return NextResponse.json(resultado);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
