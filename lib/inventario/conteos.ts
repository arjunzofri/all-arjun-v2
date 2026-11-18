"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { registrarConteoSchema, type ConteoDTO, type RegistrarConteoRespuesta } from "./contratos";

const ERROR_SEGURO = "No se pudo registrar el conteo. Intente nuevamente.";

type FilaCruda = {
  id: number; producto_id: number; bodega: number; planta: string; pasillo: string;
  posicion: string; cantidad: number; usuario_id: number; creado_en: string;
};

function aDTO(c: FilaCruda): ConteoDTO {
  return {
    id: c.id, productoId: c.producto_id, bodega: c.bodega, planta: c.planta,
    pasillo: c.pasillo, posicion: c.posicion, cantidad: c.cantidad,
    usuarioId: c.usuario_id, creadoEn: String(c.creado_en),
  };
}

function esFila(v: unknown): v is FilaCruda {
  return typeof v === "object" && v !== null && typeof (v as FilaCruda).id === "number";
}

/** Server-action autenticada: auth, flag y validacion estricta antes de tocar la DB. */
export async function registrarConteo(input: unknown): Promise<RegistrarConteoRespuesta> {
  const sesion = await auth();
  const usuarioId = Number(sesion?.user?.id);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
    return { ok: false, error: "Sesión inválida. Inicie sesión nuevamente." };
  }
  if (!flagActivo("inventario_bodega")) {
    return { ok: false, error: "El inventario de bodega no está habilitado." };
  }

  const parseado = registrarConteoSchema.safeParse(input);
  if (!parseado.success) return { ok: false, error: "Los datos del conteo no son válidos." };
  const { productoId, ubicacion, cantidad, expectedConteoId, idempotencyKey } = parseado.data;
  const claveIdempotencia = `${usuarioId}:${idempotencyKey.toLowerCase()}`;

  let resultado: unknown;
  try {
    // Una sola sentencia parametrizada; usuario y fecha los pone la DB.
    resultado = await db.execute(sql`
      SELECT public.registrar_conteo(
        ${productoId}::integer, ${ubicacion.bodega}::integer, ${ubicacion.planta}::text,
        ${ubicacion.pasillo}::text, ${ubicacion.posicion}::text, ${cantidad}::integer,
        ${usuarioId}::integer, ${claveIdempotencia}::text, ${expectedConteoId}::bigint
      ) AS r
    `);
  } catch {
    return { ok: false, error: ERROR_SEGURO };
  }

  const fila = (resultado as { rows?: { r?: unknown }[] }).rows?.[0]?.r;
  if (typeof fila !== "object" || fila === null) return { ok: false, error: ERROR_SEGURO };
  const r = fila as Record<string, unknown>;
  if (r.ok === true && esFila(r.conteo)) return { ok: true, conteo: aDTO(r.conteo), repetido: r.repetido === true };
  if (r.ok === false && r.conflicto === true) return { ok: false, conflicto: true, vigente: esFila(r.vigente) ? aDTO(r.vigente) : null };
  return { ok: false, error: ERROR_SEGURO };
}
