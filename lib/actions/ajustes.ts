"use server";

import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { movimientos } from "@/db/schema";
import { eq, desc, and, inArray, or, like } from "drizzle-orm";
import {
  resolverOrigenDestino,
  calcularCantidadNeta,
  calcularCantidadAjuste,
  calcularCorreccionEntrada,
} from "@/lib/utils/movimiento-ubicacion";
import type { Ubicacion, ResolverInput } from "@/lib/utils/movimiento-ubicacion";

type MovimientoContribuyente = {
  movimientoId: number;
  tipo: "salida" | "retorno" | "entrada";
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
        or(
          inArray(movimientos.tipo, ["salida", "retorno"]),
          and(
            eq(movimientos.tipo, "entrada"),
            like(movimientos.folio, "MAN-%"),
          ),
        ),
      ),
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

// ═══════════════════════════════════════════════════════════════════════════
// crearAjuste — CTE atómica de escritura con FOR UPDATE
// ═══════════════════════════════════════════════════════════════════════════

const ajusteSchema = z.object({
  movimientoOriginalId: z.number().int().positive(),
  cantidadReal: z.number().int().nonnegative(),
  observaciones: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1),
});

export type CrearAjusteInput = z.infer<typeof ajusteSchema>;

export type CrearAjusteResult =
  | { movimientoId: number; ok: true; reason?: undefined }
  | { movimientoId: null; ok: false; reason: "idempotente" };

export async function crearAjuste(
  input: CrearAjusteInput,
): Promise<CrearAjusteResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  const userId = Number(session.user.id);

  const parsed = ajusteSchema.parse(input);
  const {
    movimientoOriginalId,
    cantidadReal,
    idempotencyKey,
    observaciones,
  } = parsed;

  const sql = neon(process.env.DATABASE_URL!);
  const folio = `AJT-${idempotencyKey}`;

  // ── 0. Idempotencia: si el folio ya fue procesado, salir temprano ─
  const existente = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
  if ((existente as unknown[]).length > 0) {
    return { movimientoId: null, ok: false, reason: "idempotente" };
  }

  // ── 1. Fetch del movimiento original ──────────────────────────────
  const originalRows = await sql`
    SELECT id, producto_id, tipo, cantidad, bodega_origen_id, modulo_destino_id, folio
    FROM movimientos WHERE id = ${movimientoOriginalId}
  `;
  const origRaw = originalRows as unknown as {
    id: number;
    producto_id: number;
    tipo: string;
    cantidad: number;
    bodega_origen_id: number | null;
    modulo_destino_id: number | null;
    folio: string | null;
  }[];

  if (origRaw.length === 0) {
    throw new Error("Movimiento original no encontrado");
  }

  const orig = origRaw[0]!;

  // ── Validación de tipo ────────────────────────────────────────────
  const esEntrada = orig.tipo === "entrada";

  if (esEntrada) {
    // Solo entradas manuales (MAN-*), nunca sync
    if (!orig.folio?.startsWith("MAN-")) {
      throw new Error(
        "Solo se pueden ajustar entradas manuales (no sync automático)",
      );
    }

    // Validar stock en la bodega
    const stockRow = await sql`
      SELECT cantidad FROM stock
      WHERE producto_id = ${orig.producto_id}
        AND bodega_id = ${orig.bodega_origen_id}
    `;
    const stockActual =
      ((stockRow as unknown as { cantidad: number }[])[0]?.cantidad) ?? 0;

    // Calcular delta con ajustes previos
    const ajustesPreviosRows = await sql`
      SELECT cantidad FROM movimientos
      WHERE movimiento_original_id = ${movimientoOriginalId} AND tipo = 'ajuste'
    `;
    const ajustesPrevios = (ajustesPreviosRows as unknown as { cantidad: number }[])
      .map((a) => a.cantidad);

    const delta = calcularCorreccionEntrada(
      orig.cantidad,
      cantidadReal,
      ajustesPrevios,
    );

    if (delta > stockActual) {
      throw new Error("Stock insuficiente");
    }

    // CTE de una sola punta: descuento de bodega + inserción de ajuste
    const cteResult = await sql`
      WITH existing AS (
        SELECT id FROM movimientos
        WHERE folio = ${folio}
          AND producto_id = ${orig.producto_id}
      ),
      stock_ok AS (
        UPDATE stock
        SET cantidad = cantidad - ${delta}, updated_at = NOW()
        WHERE producto_id = ${orig.producto_id}
          AND bodega_id = ${orig.bodega_origen_id}
          AND cantidad >= ${delta}
          AND NOT EXISTS (SELECT 1 FROM existing)
        RETURNING 1
      )
      INSERT INTO movimientos (
        folio, producto_id, tipo, cantidad,
        bodega_origen_id,
        movimiento_original_id, usuario_id, observaciones
      )
      SELECT
        ${folio}, ${orig.producto_id}, 'ajuste', ${-delta},
        ${orig.bodega_origen_id},
        ${movimientoOriginalId}, ${userId}, ${observaciones ?? null}
      WHERE EXISTS (SELECT 1 FROM stock_ok)
      RETURNING id
    `;

    const ids = cteResult as unknown as { id: number }[];
    if (ids[0]?.id) {
      return { movimientoId: ids[0].id, ok: true };
    }
    const dup = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
    if ((dup as unknown[]).length > 0) {
      return { movimientoId: null, ok: false, reason: "idempotente" };
    }
    throw new Error("Stock insuficiente");
  }

  if (orig.tipo !== "salida" && orig.tipo !== "retorno") {
    throw new Error(
      "Solo se pueden ajustar salidas o retornos",
    );
  }

  // ── 2. resolverOrigenDestino → IDs posicionales + destinoOriginal ─
  const resuelto = resolverOrigenDestino({
    tipo: orig.tipo,
    bodegaOrigenId: orig.bodega_origen_id,
    moduloDestinoId: orig.modulo_destino_id,
    cantidad: orig.cantidad,
  });

  // Extraer IDs posicionales — sin importar cuál es origen y cuál destino.
  // Para salida:  origen={bodega,id}, destino={modulo,id}
  // Para retorno: origen={modulo,id}, destino={bodega,id}
  const bodegaId =
    resuelto.origen?.tipo === "bodega"
      ? resuelto.origen.id
      : resuelto.destino?.tipo === "bodega"
        ? resuelto.destino.id
        : null;

  const moduloId =
    resuelto.origen?.tipo === "modulo"
      ? resuelto.origen.id
      : resuelto.destino?.tipo === "modulo"
        ? resuelto.destino.id
        : null;

  if (bodegaId === null || moduloId === null) {
    throw new Error(
      "Movimiento original con datos incompletos: falta bodega o módulo",
    );
  }

  const destinoOriginal = resuelto.destino!;

  const origInput: ResolverInput = {
    tipo: orig.tipo,
    bodegaOrigenId: orig.bodega_origen_id,
    moduloDestinoId: orig.modulo_destino_id,
    cantidad: orig.cantidad,
  };

  // ── 3. Ajustes previos + calcular cantidad neta y delta ───────────
  const ajustesPreviosRaw = await sql`
    SELECT tipo, cantidad, bodega_origen_id, modulo_destino_id
    FROM movimientos
    WHERE movimiento_original_id = ${movimientoOriginalId} AND tipo = 'ajuste'
  `;
  const ajustesPreviosInputs: ResolverInput[] = (
    ajustesPreviosRaw as unknown as {
      tipo: string;
      cantidad: number;
      bodega_origen_id: number | null;
      modulo_destino_id: number | null;
    }[]
  ).map((a) => ({
    tipo: "ajuste",
    bodegaOrigenId: a.bodega_origen_id,
    moduloDestinoId: a.modulo_destino_id,
    cantidad: a.cantidad,
  }));

  const cantidadNetaActual = calcularCantidadNeta(
    origInput,
    ajustesPreviosInputs,
    destinoOriginal,
  );

  const cantidadAjuste = calcularCantidadAjuste(
    destinoOriginal,
    cantidadNetaActual,
    cantidadReal,
  );
  // si delta === 0, calcularCantidadAjuste ya lanza

  const cantidadAbs = Math.abs(cantidadAjuste);

  // ── 4. Elegir rama de CTE según signo ─────────────────────────────
  if (cantidadAjuste > 0) {
    // ── Rama positiva: bodega → módulo (mismo sentido que salida) ──
    const cteResult = await sql`
      WITH existing AS (
        SELECT id FROM movimientos
        WHERE folio = ${folio}
          AND producto_id = ${orig.producto_id}
      ),
      stock_check AS (
        SELECT cantidad FROM stock
        WHERE producto_id = ${orig.producto_id}
          AND bodega_id = ${bodegaId}
          AND cantidad >= ${cantidadAbs}
          AND NOT EXISTS (SELECT 1 FROM existing)
        FOR UPDATE
      ),
      bodega_ok AS (
        UPDATE stock
        SET cantidad = cantidad - ${cantidadAbs}, updated_at = NOW()
        WHERE producto_id = ${orig.producto_id}
          AND bodega_id = ${bodegaId}
          AND EXISTS (SELECT 1 FROM stock_check)
      ),
      modulo_ok AS (
        INSERT INTO stock (producto_id, modulo_id, cantidad)
        SELECT ${orig.producto_id}, ${moduloId}, ${cantidadAbs}
        WHERE EXISTS (SELECT 1 FROM stock_check)
        ON CONFLICT (producto_id, modulo_id)
        DO UPDATE SET cantidad = stock.cantidad + ${cantidadAbs}, updated_at = NOW()
      )
      INSERT INTO movimientos (
        folio, producto_id, tipo, cantidad,
        bodega_origen_id, modulo_destino_id,
        movimiento_original_id, usuario_id, observaciones
      )
      SELECT
        ${folio}, ${orig.producto_id}, 'ajuste', ${cantidadAjuste},
        ${bodegaId}, ${moduloId},
        ${movimientoOriginalId}, ${userId}, ${observaciones ?? null}
      WHERE EXISTS (SELECT 1 FROM stock_check)
      RETURNING id
    `;

    return await manejarResultadoCTE(cteResult, sql, folio);
  }

  // ── Rama negativa: módulo → bodega (mismo sentido que retorno) ──
  const cteResult = await sql`
    WITH existing AS (
      SELECT id FROM movimientos
      WHERE folio = ${folio}
        AND producto_id = ${orig.producto_id}
    ),
    stock_check AS (
      SELECT cantidad FROM stock
      WHERE producto_id = ${orig.producto_id}
        AND modulo_id = ${moduloId}
        AND cantidad >= ${cantidadAbs}
        AND NOT EXISTS (SELECT 1 FROM existing)
      FOR UPDATE
    ),
    modulo_ok AS (
      UPDATE stock
      SET cantidad = cantidad - ${cantidadAbs}, updated_at = NOW()
      WHERE producto_id = ${orig.producto_id}
        AND modulo_id = ${moduloId}
        AND EXISTS (SELECT 1 FROM stock_check)
    ),
    bodega_ok AS (
      INSERT INTO stock (producto_id, bodega_id, cantidad)
      SELECT ${orig.producto_id}, ${bodegaId}, ${cantidadAbs}
      WHERE EXISTS (SELECT 1 FROM stock_check)
      ON CONFLICT (producto_id, bodega_id)
      DO UPDATE SET cantidad = stock.cantidad + ${cantidadAbs}, updated_at = NOW()
    )
    INSERT INTO movimientos (
      folio, producto_id, tipo, cantidad,
      bodega_origen_id, modulo_destino_id,
      movimiento_original_id, usuario_id, observaciones
    )
    SELECT
      ${folio}, ${orig.producto_id}, 'ajuste', ${cantidadAjuste},
      ${bodegaId}, ${moduloId},
      ${movimientoOriginalId}, ${userId}, ${observaciones ?? null}
    WHERE EXISTS (SELECT 1 FROM stock_check)
    RETURNING id
  `;

  return await manejarResultadoCTE(cteResult, sql, folio);
}

/**
 * Interpreta el resultado de la CTE atómica: éxito, idempotente por race
 * condition (la otra llamada ganó la carrera entre el paso 0 y la CTE),
 * o stock insuficiente genuino.
 *
 * Mismo patrón que salidas.ts L72-78 y retornos.ts L70-76:
 * si la CTE no insertó, verificar si el folio ya existe antes de tirar error.
 */
/**
 * Mismo patrón que salidas.ts L72-78 y retornos.ts L70-76:
 * si la CTE no insertó, verificar si el folio ya existe antes de tirar error.
 */
async function manejarResultadoCTE(
  cteResult: unknown,
  sql: NeonQueryFunction<false, false>,
  folio: string,
): Promise<CrearAjusteResult> {
  const ids = cteResult as { id: number }[];
  if (ids[0]?.id) {
    return { movimientoId: ids[0].id, ok: true };
  }

  // Si no se insertó, verificar por qué
  const dup = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
  if ((dup as unknown[]).length > 0) {
    return { movimientoId: null, ok: false, reason: "idempotente" };
  }

  throw new Error("Stock insuficiente");
}
