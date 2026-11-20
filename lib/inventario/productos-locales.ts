import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { productos } from "@/db/schema";
// Primer id local que coincide sin mayusculas ni espacios, en orden de los codigos.
export async function primerIdLocal(codigos: string[]): Promise<number | null> {
  const normalizados = codigos.map((c) => c.trim().toUpperCase());
  if (normalizados.length === 0) return null;

  // El alias solo va en el SELECT: en el WHERE debe verse la expresion, no el nombre.
  const normalizado = sql<string>`upper(btrim(${productos.codigo}))`;
  const filas = await db
    .select({ id: productos.id, codigo: normalizado.as("codigo") })
    .from(productos)
    .where(inArray(normalizado, normalizados));
  const porCodigo = new Map(filas.map((f) => [f.codigo, f.id]));
  return normalizados.map((c) => porCodigo.get(c)).find((id) => id !== undefined) ?? null;
}
