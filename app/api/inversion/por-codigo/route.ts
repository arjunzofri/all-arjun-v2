export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import {
  getLotesCompraPorCodigo,
  getStockActualPorCodigo,
} from "@/lib/utils/inversion-lotes";
import {
  calcularInversionFifo,
  type LoteCompra,
  type ResultadoInversion,
} from "@/lib/utils/inversion-fifo";

const codigoSchema = z.object({
  codigo: z.string().trim().min(1).max(30),
});

export interface RespuestaInversion extends ResultadoInversion {
  codigo: string;
  /** Suma real del stock propio; puede ser negativa. */
  stockRegistrado: number;
  advertencia: "stock_negativo" | null;
}

/**
 * Composición pura, exportada para testear sin DB.
 * `stockActual` es el valor usado en el cálculo (clampeado a >= 0);
 * `stockRegistrado` conserva la suma real para que la UI muestre el negativo.
 */
export function componerRespuestaInversion(
  codigo: string,
  lotes: LoteCompra[],
  stockRegistrado: number
): RespuestaInversion {
  const resultado = calcularInversionFifo(lotes, Math.max(0, stockRegistrado));

  return {
    codigo,
    stockActual: resultado.stockActual,
    stockRegistrado,
    advertencia: stockRegistrado < 0 ? "stock_negativo" : null,
    valorTotal: resultado.valorTotal,
    cantidadTotalCompras: resultado.cantidadTotalCompras,
    cantidadValorizada: resultado.cantidadValorizada,
    cantidadSinCosto: resultado.cantidadSinCosto,
    partidas: resultado.partidas,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const parsed = codigoSchema.safeParse({
    codigo: searchParams.get("codigo") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetro codigo requerido" },
      { status: 400 }
    );
  }

  const { codigo } = parsed.data;

  let lotes: LoteCompra[];
  try {
    lotes = await getLotesCompraPorCodigo(codigo);
  } catch {
    // No filtrar detalles de Vida Digital (ver R3 del contrato).
    return NextResponse.json(
      { error: "No se pudo consultar Vida Digital" },
      { status: 502 }
    );
  }

  let stockRegistrado: number;
  try {
    stockRegistrado = await getStockActualPorCodigo(codigo);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json(
    componerRespuestaInversion(codigo, lotes, stockRegistrado)
  );
}
