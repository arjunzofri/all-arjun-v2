"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { resolverSugerenciaBodega, type SugerenciaBodega } from "@/lib/inventario/sugerencia-bodega";
import { calcularValorizacionConteos, type LoteValorizacion, type PosicionValorizacion, type ValorizacionCodigo } from "@/lib/inventario/valorizacion";
import { fechaChileDeTimestamp } from "@/lib/utils/fecha-chile";
import { getBodegaPorCodigoIngreso } from "@/lib/utils/get-bodega-por-codigo-ingreso";

export interface PosicionContada {
  id: number; bodega: number; planta: string; pasillo: string; posicion: string; cantidad: number; usuarioId: number; usuario: string; creadoEn: string;
}
export interface FilaInventario {
  id: number; codigo: string; detalle: string | null; codigoPersonal: string | null; packing: number | null; observaciones: string | null; imagenUrl: string | null;
  posiciones: PosicionContada[]; stockContado: number | null;
  sugerenciaBodega?: SugerenciaBodega | null;
}
const idInt4 = z.number().int().positive().max(2147483647);
const paramsSchema = z.strictObject({
  q: z.string().trim().max(100).default(""), limit: z.number().int().min(1).max(100).default(20),
  cursor: idInt4.optional(), productoId: idInt4.optional(),
});
const historialParamsSchema = z.strictObject({
  productoId: idInt4, limit: z.number().int().min(1).max(100).default(20),
  cursor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
});
type FilaCruda = {
  id: number | string; codigo: string; detalle: string | null; codigo_personal: string | null; packing: number | null; observaciones: string | null; imagen_url: string | null;
  conteo_id: number | string | null; bodega: number; planta: string; pasillo: string; posicion: string; cantidad: number; usuario_id: number; usuario: string; creado_en: string | Date;
};
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);
const filtroProductos = (q: string) => q === "" ? sql`TRUE` : sql`(p.codigo ILIKE ${`%${escaparLike(q)}%`} ESCAPE '\\'
    OR COALESCE(p.codigo_personal, '') ILIKE ${`%${escaparLike(q)}%`} ESCAPE '\\'
    OR COALESCE(p.detalle, '') ILIKE ${`%${escaparLike(q)}%`} ESCAPE '\\')`;
async function guard() {
  const sesion = await auth();
  const usuarioId = Number(sesion?.user?.id);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new Error("Sesión inválida. Inicie sesión nuevamente.");
  if (!flagActivo("inventario_bodega")) throw new Error("El inventario de bodega no está habilitado.");
  return sesion;
}
async function guardAdmin() {
  const sesion = await guard();
  if ((sesion?.user as { role?: string } | undefined)?.role !== "admin") throw new Error("Se requiere rol de administrador.");
}
const aPosicion = (f: Pick<FilaCruda, "conteo_id" | "bodega" | "planta" | "pasillo" | "posicion" | "cantidad" | "usuario_id" | "usuario" | "creado_en">): PosicionContada => ({
  id: Number(f.conteo_id), bodega: f.bodega, planta: f.planta, pasillo: f.pasillo, posicion: f.posicion,
  cantidad: f.cantidad, usuarioId: f.usuario_id, usuario: f.usuario, creadoEn: new Date(f.creado_en).toISOString(),
});
/** Listado paginado de productos con sus conteos vigentes. Solo lectura. */
export async function listarInventario(input: unknown = {}): Promise<{ items: FilaInventario[]; nextCursor: number | null }> {
  await guard();
  const parsed = paramsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Parámetros de búsqueda inválidos.");
  const { q, limit, cursor, productoId } = parsed.data;
  const filtro = filtroProductos(q);
  try {
    const resultado = await db.execute(sql`
      WITH pagina AS (
        SELECT p.id, p.codigo, p.detalle, p.codigo_personal, p.packing, p.observaciones, p.imagen_url
        FROM productos p
        WHERE (${cursor ?? null}::bigint IS NULL OR p.id < ${cursor ?? null})
          AND (${productoId ?? null}::int IS NULL OR p.id = ${productoId ?? null}) AND ${filtro}
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
      actual.posiciones.push(aPosicion(f));
      actual.stockContado = (actual.stockContado ?? 0) + f.cantidad;
    }
    const visibles = items.slice(0, limit);
    return { items: visibles, nextCursor: items.length > limit ? visibles[visibles.length - 1].id : null };
  } catch { throw new Error("No se pudo obtener el inventario. Intente nuevamente."); }
}
/** Sugerencia desde la última compra importada; opcional, nunca tumba la ficha. */
async function obtenerSugerenciaBodega(productoId: number): Promise<SugerenciaBodega | null> {
  try {
    const ultima = (await db.execute(sql`SELECT bodega_codigo FROM compras_importadas
      WHERE producto_id = ${productoId} ORDER BY fecha_confirmacion DESC, id DESC LIMIT 1`)) as unknown as { rows?: { bodega_codigo: string | null }[] };
    const codigo = ultima.rows?.[0]?.bodega_codigo ?? null;
    const nombre = getBodegaPorCodigoIngreso(codigo?.trim());
    if (!nombre) return null;
    const encontradas = (await db.execute(sql`SELECT id, nombre FROM bodegas WHERE nombre = ${nombre} LIMIT 1`)) as unknown as { rows?: { id: number; nombre: string }[] };
    return resolverSugerenciaBodega(codigo, encontradas.rows ?? []);
  } catch (error) {
    console.error("No se pudo resolver la sugerencia de bodega", error);
    return null;
  }
}
/** Ficha de un producto por ID exacto; null si no existe. Solo lectura. */
export async function getFichaInventario(id: unknown): Promise<FilaInventario | null> {
  const { items } = await listarInventario({ productoId: id ?? null, limit: 1 });
  const fila = items[0] ?? null;
  if (fila && flagActivo("asignacion_bodega_compra")) fila.sugerenciaBodega = await obtenerSugerenciaBodega(fila.id);
  return fila;
}
/** Historial paginado de todas las versiones de conteo de un producto. Solo lectura. */
export async function getHistorialConteos(input: unknown): Promise<{ items: PosicionContada[]; nextCursor: number | null }> {
  await guard();
  const parsed = historialParamsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Parámetros de búsqueda inválidos.");
  const { productoId, limit, cursor } = parsed.data;
  try {
    const resultado = await db.execute(sql`
      SELECT c.id AS conteo_id, c.bodega, c.planta, c.pasillo, c.posicion, c.cantidad,
        c.usuario_id, u.username AS usuario, c.creado_en
      FROM conteos_inventario c
      JOIN users u ON u.id = c.usuario_id
      WHERE c.producto_id = ${productoId}
        AND (${cursor ?? null}::bigint IS NULL OR c.id < ${cursor ?? null})
      ORDER BY c.id DESC LIMIT ${limit + 1}
    `);
    const filas = ((resultado as unknown as { rows?: FilaCruda[] }).rows ?? []).filter((f) => f.conteo_id !== null);
    const visibles = filas.slice(0, limit).map(aPosicion);
    return { items: visibles, nextCursor: filas.length > limit ? visibles[visibles.length - 1].id : null };
  } catch { throw new Error("No se pudo obtener el historial. Intente nuevamente."); }
}
const comprasParamsSchema = z.strictObject({
  productoId: idInt4, limit: z.number().int().min(1).max(100).default(20),
  cursor: z.strictObject({ fechaConfirmacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).optional(),
});
export interface CompraFicha {
  id: number; folio: string; item: number | null; bodega: string | null; cantidad: number;
  fechaConfirmacion: string; precioUnitario?: number | null;
}
type FilaCompra = { id: number | string; folio: string; item: number | null; bodega_codigo: string | null;
  cantidad: number; fecha_confirmacion: string; precio_unitario?: string | number | null };
/** Compras importadas del producto desde el ledger local. Solo lectura; el precio solo se selecciona para admin. */
export async function getComprasProducto(input: unknown): Promise<{ items: CompraFicha[]; nextCursor: { fechaConfirmacion: string; id: number } | null }> {
  const sesion = await guard();
  const parsed = comprasParamsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Parámetros de búsqueda inválidos.");
  const { productoId, limit, cursor } = parsed.data;
  const esAdmin = (sesion?.user as { role?: string } | undefined)?.role === "admin";
  try {
    const filas = filasDe<FilaCompra>(await db.execute(sql`
      SELECT ci.id, ci.folio, ci.item, ci.bodega_codigo, ci.cantidad, ci.fecha_confirmacion::text AS fecha_confirmacion
        ${esAdmin ? sql`, ci.precio_unitario` : sql``}
      FROM compras_importadas ci
      WHERE ci.producto_id = ${productoId}
        AND (${cursor ? sql`(ci.fecha_confirmacion, ci.id) < (${cursor.fechaConfirmacion}::date, ${cursor.id}::bigint)` : sql`TRUE`})
      ORDER BY ci.fecha_confirmacion DESC, ci.id DESC LIMIT ${limit + 1}
    `));
    const items = filas.slice(0, limit).map((f) => {
      const codigo = f.bodega_codigo?.trim() ?? null;
      const item: CompraFicha = { id: Number(f.id), folio: f.folio, item: f.item ?? null,
        bodega: getBodegaPorCodigoIngreso(codigo) ?? codigo, cantidad: f.cantidad, fechaConfirmacion: f.fecha_confirmacion };
      if (esAdmin) item.precioUnitario = f.precio_unitario == null ? null : Number(f.precio_unitario);
      return item;
    });
    const ultima = items[items.length - 1];
    return { items, nextCursor: filas.length > limit && ultima ? { fechaConfirmacion: ultima.fechaConfirmacion, id: ultima.id } : null };
  } catch { throw new Error("No se pudo cargar el historial de compras. Intente nuevamente."); }
}
export interface TotalesValorizacion {
  valorTotal: number; unidadesSinCosto: number; incompleto: boolean;
  fechaMin: string | null; fechaMax: string | null; fechasDistintas: boolean;
  productosConConteo: number; productosSinContar: number; productosConError: number;
}
export interface ValorizacionLista { porProducto: { productoId: number; valor: ValorizacionCodigo }[]; totales: TotalesValorizacion; }
const valorizacionParamsSchema = z.strictObject({ q: z.string().trim().max(100).default("") });
type FilaPosVal = { producto_id: number | string; conteo_id: number | string; bodega: number; cantidad: number; creado_en: string | Date };
type FilaLoteVal = { producto_id: number | string; lote_id: number | string; folio: string; item: number | null; fecha_confirmacion: string; cantidad: number; precio_unitario: string | number | null };
const filasDe = <T>(r: unknown) => (r as { rows?: T[] }).rows ?? [];
const r2 = (x: number) => Math.round(x * 100) / 100;
/** 3 queries para N productos. Solo costos: el llamador debe exigir admin. */
async function valorizarProductos(q: string, productoId?: number) {
  const filtroId = productoId === undefined ? sql`` : sql`AND p.id = ${productoId}`;
  const ids = filasDe<{ id: number | string }>(await db.execute(sql`SELECT p.id FROM productos p WHERE ${filtroProductos(q)} ${filtroId} ORDER BY p.id`)).map((f) => Number(f.id));
  const porProducto = new Map<number, ValorizacionCodigo>();
  if (ids.length === 0) return { ids, porProducto, productosConError: 0 };
  const lista = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const posiciones = filasDe<FilaPosVal>(await db.execute(sql`SELECT c.producto_id, c.id AS conteo_id, c.bodega, c.cantidad, c.creado_en
    FROM conteos_vigentes c WHERE c.producto_id IN (${lista}) AND c.bodega IN (1, 2) ORDER BY c.producto_id, c.creado_en, c.id`));
  const lotes = filasDe<FilaLoteVal>(await db.execute(sql`SELECT ci.producto_id, ci.id AS lote_id, ci.folio, ci.item,
      ci.fecha_confirmacion::text AS fecha_confirmacion, ci.cantidad, ci.precio_unitario
    FROM compras_importadas ci WHERE ci.producto_id IN (${lista})
    ORDER BY ci.producto_id, ci.fecha_confirmacion DESC, ci.folio DESC, ci.id DESC`));
  const posPor = new Map<number, PosicionValorizacion[]>();
  for (const f of posiciones) {
    const pid = Number(f.producto_id);
    const pos: PosicionValorizacion = { id: Number(f.conteo_id), bodega: f.bodega === 2 ? 2 : 1, cantidad: f.cantidad,
      fechaConteo: fechaChileDeTimestamp(new Date(f.creado_en)) };
    posPor.set(pid, [...(posPor.get(pid) ?? []), pos]);
  }
  const lotesPor = new Map<number, LoteValorizacion[]>();
  for (const f of lotes) {
    const pid = Number(f.producto_id);
    const lote: LoteValorizacion = { id: Number(f.lote_id), folio: f.folio, item: f.item, fechaConfirmacion: f.fecha_confirmacion,
      cantidad: f.cantidad, precioUnitario: f.precio_unitario === null ? null : Number(f.precio_unitario) };
    lotesPor.set(pid, [...(lotesPor.get(pid) ?? []), lote]);
  }
  let productosConError = 0;
  for (const [pid, pos] of posPor) {
    try { porProducto.set(pid, calcularValorizacionConteos(lotesPor.get(pid) ?? [], pos)); }
    catch (error) { if (!(error instanceof RangeError)) throw error; productosConError++; } // ponytail: sigue fallando lo que no sea dato inválido
  }
  return { ids, porProducto, productosConError };
}
/** Valorización admin de un producto; null si no tiene conteos vigentes. */
export async function getValorizacionProducto(productoId: unknown): Promise<ValorizacionCodigo | null> {
  await guardAdmin();
  const parsed = idInt4.safeParse(productoId);
  if (!parsed.success) throw new Error("Parámetros de búsqueda inválidos.");
  try {
    const { porProducto, productosConError } = await valorizarProductos("", parsed.data);
    if (productosConError > 0) throw new Error("dato inválido");
    return porProducto.get(parsed.data) ?? null;
  } catch { throw new Error("No se pudo cargar la valorización. Intente nuevamente."); }
}
/** Valorización admin de todos los productos que matchean q (todas las páginas). */
export async function getValorizacionLista(input: unknown = {}): Promise<ValorizacionLista> {
  await guardAdmin();
  const parsed = valorizacionParamsSchema.safeParse(input);
  if (!parsed.success) throw new Error("Parámetros de búsqueda inválidos.");
  try {
    const { ids, porProducto, productosConError } = await valorizarProductos(parsed.data.q);
    const porProductoArr = [...porProducto.entries()].sort((a, b) => a[0] - b[0]).map(([productoId, valor]) => ({ productoId, valor }));
    const min = porProductoArr.map((p) => p.valor.fechaConteoMin).filter((f): f is string => f !== null);
    const max = porProductoArr.map((p) => p.valor.fechaConteoMax).filter((f): f is string => f !== null);
    const unidadesSinCosto = porProductoArr.reduce((s, p) => s + p.valor.cantidadSinCosto, 0);
    const fechaMin = min.length ? min.reduce((a, b) => (a < b ? a : b)) : null;
    const fechaMax = max.length ? max.reduce((a, b) => (a > b ? a : b)) : null;
    return { porProducto: porProductoArr, totales: {
      valorTotal: r2(porProductoArr.reduce((s, p) => s + p.valor.valorTotal, 0)),
      unidadesSinCosto, incompleto: unidadesSinCosto > 0, fechaMin, fechaMax,
      fechasDistintas: fechaMin !== null && fechaMin !== fechaMax,
      productosConConteo: porProductoArr.length, productosSinContar: ids.length - porProductoArr.length - productosConError, productosConError,
    } };
  } catch { throw new Error("No se pudo cargar la valorización. Intente nuevamente."); }
}
