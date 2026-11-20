"use server";

import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getVidaDigitalClient } from "@/db/vidadigital";
import { getProductoExternoPorCodigo } from "@/db/vidadigital/queries";
import { crearProductoManual } from "@/lib/actions/productos";
import { primerIdLocal } from "@/lib/inventario/productos-locales";
import { flagActivo } from "@/lib/feature-flags";
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

const abrirProductoSchema = z
  .object({
    codigos: z
      .array(
        z.string().trim().min(1, "Código requerido").max(30, "El código no puede superar 30 caracteres")
      )
      .min(1, "Código requerido")
      .max(10, "Demasiados códigos"),
    codigo: z.string().trim().min(1, "Código requerido").max(30, "El código no puede superar 30 caracteres"),
  })
  .refine((d) => d.codigos.includes(d.codigo), {
    message: "El código elegido no pertenece a las opciones",
    path: ["codigo"],
  });

/**
 * Identificador en modo inventario: abre la ficha del código elegido.
 * Resuelve local primero; si solo existe afuera, lo incorpora con la metadata
 * releída del servidor (nunca la del cliente). Solo toca productos.
 */
export async function abrirProductoIdentificado(input: {
  codigos: string[];
  codigo: string;
}): Promise<{ ok: true; id: number; incorporado: boolean } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "No autorizado" };
  if (!flagActivo("identificacion_foto") || !flagActivo("inventario_bodega")) {
    return { ok: false, error: "El inventario de bodega no está habilitado" };
  }
  const parsed = abrirProductoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { codigos, codigo } = parsed.data;
  try {
    const local = await primerIdLocal(codigos);
    if (local !== null) return { ok: true, id: local, incorporado: false };
    const externo = await getProductoExternoPorCodigo(codigo);
    const r = await crearProductoManual({
      codigo,
      detalle: externo?.detalle ?? undefined,
      packing: externo?.packing ?? undefined,
      imagenUrl: externo?.imagenUrl ?? null,
    });
    return r.ok ? { ok: true, id: r.id, incorporado: !r.existente } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "No se pudo consultar el catálogo. Intenta de nuevo." };
  }
}
