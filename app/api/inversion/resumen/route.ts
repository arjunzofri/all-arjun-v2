export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import {
  getLotesCompraPorCodigos,
  getStockPorCodigo,
  type StockCodigo,
} from "@/lib/utils/inversion-lotes";
import { calcularResumenInversion } from "@/lib/utils/inversion-resumen";
import type { LoteCompra } from "@/lib/utils/inversion-fifo";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!flagActivo("inversion_mercaderia")) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  let stockPorCodigo: Map<string, StockCodigo>;
  try {
    stockPorCodigo = await getStockPorCodigo();
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  let lotesPorCodigo: Map<string, LoteCompra[]>;
  try {
    lotesPorCodigo = await getLotesCompraPorCodigos([...stockPorCodigo.keys()]);
  } catch {
    // No filtrar detalles de Vida Digital (502 genérico).
    return NextResponse.json(
      { error: "No se pudo consultar Vida Digital" },
      { status: 502 }
    );
  }

  return NextResponse.json(
    calcularResumenInversion(stockPorCodigo, lotesPorCodigo)
  );
}
