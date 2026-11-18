"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";

export interface PosicionContada {
  id: number; bodega: number; planta: string; pasillo: string; posicion: string; cantidad: number; usuarioId: number; usuario: string; creadoEn: string;
}
export interface FilaInventario {
  id: number; codigo: string; detalle: string | null; codigoPersonal: string | null; packing: number | null; observaciones: string | null; imagenUrl: string | null;
  posiciones: PosicionContada[]; stockContado: number | null;
}
const paramsSchema = z.strictObject({
  q: z.string().trim().max(100).default(""), limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().positive().max(2147483647).optional(),
});
type FilaCruda = {
  id: number | string; codigo: string; detalle: string | null; codigo_personal: string | null; packing: number | null; observaciones: string | null; imagen_url: string | null;
  conteo_id: number | string | null; bodega: number; planta: string; pasillo: string; posicion: string; cantidad: number; usuario_id: number; usuario: string; creado_en: string | Date;
};
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);
/** Listado paginado de productos con sus conteos vigentes. Solo lectura. */
export async function listarInventario(input: unknown = {}): Promise<{ items: FilaInventario[]; nextCursor: number | null }> {
  const sesion = await auth();
  const usuarioId = Number(sesion?.user?.id);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new Error("Sesión inválida. Inicie sesión nuevamente.");
  if (!flagActivo("inventario_bodega")) throw new Error("El inventario de bodega no está habilitado.");
  const parsed = paramsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Parámetros de búsqueda inválidos.");
  const { q, limit, cursor } = parsed.data;
  const patron = `%${escaparLike(q)}%`;
  const filtro = q === "" ? sql`TRUE` : sql`(p.codigo ILIKE ${patron} ESCAPE '\\'
    OR COALESCE(p.codigo_personal, '') ILIKE ${patron} ESCAPE '\\'
    OR COALESCE(p.detalle, '') ILIKE ${patron} ESCAPE '\\')`;
  try {
    const resultado = await db.execute(sql`
      WITH pagina AS (
        SELECT p.id, p.codigo, p.detalle, p.codigo_personal, p.packing, p.observaciones, p.imagen_url
        FROM productos p
        WHERE (${cursor ?? null}::bigint IS NULL OR p.id < ${cursor ?? null}) AND ${filtro}
        ORDER BY p.id DESC LIMIT ${limit + 1}
      )
      SELECT p.id, p.codigo, p.detalle, p.codigo_personal, p.packing, p.observaciones, p.imagen_url,
        c.id AS conteo_id, c.bodega, c.planta, c.pasillo, c.posicion, c.cantidad,
        c.usuario_id, u.username AS usuario, c.creado_en
      FROM pagina p
      LEFT JOIN conteos_vigentes c ON c.producto_id = p.id
      LEFT JOIN users u ON u.id = c.usuario_id
      ORDER BY p.id DESC, c.bodega, c.planta, c.pasillo, c.posicion
    `);
    const filas = (resultado as unknown as { rows?: FilaCruda[] }).rows ?? [];
    const items: FilaInventario[] = [];
    let actual: FilaInventario | null = null;
    for (const f of filas) {
      const id = Number(f.id);
      if (!actual || actual.id !== id) {
        actual = { id, codigo: f.codigo, detalle: f.detalle, codigoPersonal: f.codigo_personal, packing: f.packing,
          observaciones: f.observaciones, imagenUrl: f.imagen_url, posiciones: [], stockContado: null };
        items.push(actual);
      }
      if (f.conteo_id === null) continue;
      actual.posiciones.push({ id: Number(f.conteo_id), bodega: f.bodega, planta: f.planta,
        pasillo: f.pasillo, posicion: f.posicion, cantidad: f.cantidad, usuarioId: f.usuario_id,
        usuario: f.usuario, creadoEn: new Date(f.creado_en).toISOString() });
      actual.stockContado = (actual.stockContado ?? 0) + f.cantidad;
    }
    const visibles = items.slice(0, limit);
    return { items: visibles, nextCursor: items.length > limit ? visibles[visibles.length - 1].id : null };
  } catch { throw new Error("No se pudo obtener el inventario. Intente nuevamente."); }
}
