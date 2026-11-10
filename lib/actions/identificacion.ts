"use server";

import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getVidaDigitalClient } from "@/db/vidadigital";
import { formatoCodigoArj, sufijoAleatorio } from "@/lib/utils/codigo-alternativo";

const MAX_INTENTOS = 5;

/** neon() responde array; drizzle/neon-http responde { rows }. */
function filas(resultado: unknown): unknown[] {
  if (Array.isArray(resultado)) return resultado;
  return (resultado as { rows?: unknown[] } | null)?.rows ?? [];
}

/**
 * Solo SELECT en ambas bases (comparación case-insensitive y trim).
 * La consulta puntual contra Vida Digital es el uso #4 ya autorizado en
 * CLAUDE.md: catálogo de identificación por foto, siempre read-only.
 */
async function existeCodigo(codigo: string): Promise<boolean> {
  const propia = neon(process.env.DATABASE_URL!);
  const enPropia = await propia`
    SELECT 1 FROM productos
    WHERE upper(trim(codigo)) = upper(trim(${codigo}))
    LIMIT 1`;
  if (filas(enPropia).length > 0) return true;

  const enVidaDigital = await getVidaDigitalClient().execute(sql`
    SELECT 1 FROM public.productos
    WHERE upper(trim(codigo)) = upper(trim(${codigo}))
    LIMIT 1`);
  return filas(enVidaDigital).length > 0;
}

/**
 * Genera un ARJ- libre de colisiones. No inserta nada: el producto se crea
 * recién cuando el usuario registra la entrada (crearEntrada → upsertProducto).
 */
export async function generarCodigoAlternativo(): Promise<{ codigo: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const codigo = formatoCodigoArj(new Date(), sufijoAleatorio());
    if (!(await existeCodigo(codigo))) return { codigo };
  }
  throw new Error("No se pudo generar un código único. Intenta de nuevo.");
}
