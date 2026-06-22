"use server";

import { db } from "@/db";
import { movimientos } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  resolverOrigenDestino,
  calcularCantidadNeta,
} from "@/lib/utils/movimiento-ubicacion";
import type { Ubicacion, ResolverInput } from "@/lib/utils/movimiento-ubicacion";

type MovimientoContribuyente = {
  movimientoId: number;
  tipo: "salida" | "retorno";
  cantidadOriginal: number;
  cantidadNeta: number;
  createdAt: Date;
};

function filaAInput(
  row: {
    id: number;
    tipo: string;
    cantidad: number;
    bodegaOrigenId: number | null;
    moduloDestinoId: number | null;
  }
): ResolverInput {
  return {
    tipo: row.tipo,
    bodegaOrigenId: row.bodegaOrigenId,
    moduloDestinoId: row.moduloDestinoId,
    cantidad: row.cantidad,
  };
}

/**
 * Dado un producto y una ubicación, devuelve los movimientos originales
 * (salidas o retornos) cuyo destino es esa ubicación, junto con su
 * cantidad neta real después de todos los ajustes vinculados.
 *
 * Solo aparecen movimientos contribuyentes con cantidadNeta !== 0 —
 * los que ya fueron ajustados por completo no se muestran (nada que corregir).
 */
export async function getMovimientosContribuyentes(
  productoId: number,
  ubicacion: Ubicacion,
): Promise<MovimientoContribuyente[]> {
  // 1. Traer salidas y retornos para este producto
  const rows = await db
    .select({
      id: movimientos.id,
      tipo: movimientos.tipo,
      cantidad: movimientos.cantidad,
      bodegaOrigenId: movimientos.bodegaOrigenId,
      moduloDestinoId: movimientos.moduloDestinoId,
      createdAt: movimientos.createdAt,
    })
    .from(movimientos)
    .where(
      and(
        eq(movimientos.productoId, productoId),
        inArray(movimientos.tipo, ["salida", "retorno"]),
      )
    )
    .orderBy(desc(movimientos.id));

  // 2. Filtrar en JS: solo los que tienen a esta ubicación como destino
  //    (usa resolverOrigenDestino — no duplica la lógica de inversión)
  const contribuyentes = rows.filter((row) => {
    const { destino } = resolverOrigenDestino(filaAInput(row));
    return (
      destino &&
      destino.tipo === ubicacion.tipo &&
      destino.id === ubicacion.id
    );
  });

  if (contribuyentes.length === 0) return [];

  const contribIds = contribuyentes.map((c) => c.id);

  // 3. Traer todos los ajustes vinculados en una sola query
  const ajustes = await db
    .select({
      id: movimientos.id,
      tipo: movimientos.tipo,
      cantidad: movimientos.cantidad,
      bodegaOrigenId: movimientos.bodegaOrigenId,
      moduloDestinoId: movimientos.moduloDestinoId,
      movimientoOriginalId: movimientos.movimientoOriginalId,
    })
    .from(movimientos)
    .where(inArray(movimientos.movimientoOriginalId, contribIds));

  // 4. Agrupar ajustes por movimientoOriginalId
  const ajustesPorOriginal = new Map<number, ResolverInput[]>();
  for (const a of ajustes) {
    if (a.movimientoOriginalId === null) continue;
    const grupo = ajustesPorOriginal.get(a.movimientoOriginalId) ?? [];
    grupo.push(filaAInput(a));
    ajustesPorOriginal.set(a.movimientoOriginalId, grupo);
  }

  // 5. Calcular cantidad neta para cada contribuyente
  const resultado: MovimientoContribuyente[] = [];
  for (const c of contribuyentes) {
    const listaAjustes = ajustesPorOriginal.get(c.id) ?? [];
    const cantidadNeta = calcularCantidadNeta(
      filaAInput(c),
      listaAjustes,
      ubicacion,
    );

    // 6. Omitir los que ya están en 0
    if (cantidadNeta === 0) continue;

    resultado.push({
      movimientoId: c.id,
      tipo: c.tipo as "salida" | "retorno",
      cantidadOriginal: c.cantidad,
      cantidadNeta,
      createdAt: c.createdAt,
    });
  }

  return resultado;
}
