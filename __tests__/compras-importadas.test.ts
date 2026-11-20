/** inv-22a — ledger ON: R1 datos, R2 replay, R3 NULLS NOT DISTINCT, R4 otra bodega, R5 sin stock/mov, R6 FK. DB TEST real; 0003+0004 idempotentes. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { guardarCompraImportada } from "@/lib/sync/compras-importadas";

const sql = neon(process.env.DATABASE_URL!);
const M3 = resolve(__dirname, "../db/migrations/0003_compras_importadas.sql");
const M4 = resolve(__dirname, "../db/migrations/0004_compras_importadas_item.sql");
const tag = `CI22A-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
let productoId = 0;

type Fila = {
  producto_id: number; bodega_codigo: string | null; item: number | null; cantidad: number;
  precio_unitario: string | null; fecha_nota: string | null; fecha_confirmacion: string;
  visaciones: { nroIngreso: string; cantidad: number }[];
};
const filas = async (folio: string) => (await sql`
  SELECT producto_id, bodega_codigo, item, cantidad, precio_unitario, fecha_nota::text AS fecha_nota,
         fecha_confirmacion::text AS fecha_confirmacion, visaciones
  FROM compras_importadas WHERE folio = ${folio} ORDER BY id`) as unknown as Fila[];

const compra = (folio: string, over: Partial<Parameters<typeof guardarCompraImportada>[1]> = {}) => ({
  folio, productoId, bodegaCodigo: "GLP", cantidad: 1, fechaConfirmacion: "2026-11-04", ...over,
});

beforeAll(async () => {
  // Guardia ANTES de cualquier SQL: el DDL no puede tocar producción.
  if (new URL(process.env.DATABASE_URL!).host === process.env.PROD_DATABASE_URL_HOST)
    throw new Error("DATABASE_URL apunta a producción: se aborta antes de ejecutar SQL");
  // 0004 llega con el fix; en ROJO se omite y la ausencia de la columna item rompe igual.
  for (const m of [M3, M4]) {
    if (!existsSync(m)) continue;
    const sts = readFileSync(m, "utf8").split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean);
    for (const st of sts) await sql.query(st);
  }
  const r = (await sql`
    INSERT INTO productos (codigo, detalle) VALUES (${tag}, 'fixture inv-22a') RETURNING id
  `) as unknown as { id: number }[];
  productoId = r[0].id;
});

afterAll(async () => {
  // Solo filas de este test, hijas antes que el padre.
  if (!productoId) return;
  await sql`DELETE FROM compras_importadas WHERE producto_id = ${productoId}`;
  await sql`DELETE FROM productos WHERE id = ${productoId}`;
});

describe("guardarCompraImportada — ledger ON (integración real)", () => {
  it("R1: inserta costo, fechas y visaciones", async () => {
    const folio = `${tag}-R1`;
    expect(await guardarCompraImportada(sql, compra(folio, {
      cantidad: 12, precioUnitario: 1234.5678,
      fechaNota: "2026-11-01", fechaConfirmacion: "2026-11-03",
      visaciones: [
        { nroIngreso: "101-26-000001-001-GLP", cantidad: 5 },
        { nroIngreso: "101-26-000002-001-GLP", cantidad: 7 },
      ],
    }))).toBe(true);
    const [f] = await filas(folio);
    expect(f).toMatchObject({
      producto_id: productoId, bodega_codigo: "GLP", cantidad: 12,
      fecha_nota: "2026-11-01", fecha_confirmacion: "2026-11-03",
    });
    expect(Number(f.precio_unitario)).toBeCloseTo(1234.5678, 4);
    expect(f.visaciones.map((v) => [v.nroIngreso, v.cantidad])).toEqual([
      ["101-26-000001-001-GLP", 5], ["101-26-000002-001-GLP", 7],
    ]);
  });

  it("R2: replay no duplica y devuelve false", async () => {
    const c = compra(`${tag}-R2`, { bodegaCodigo: "GL1", cantidad: 3 });
    expect(await guardarCompraImportada(sql, c)).toBe(true);
    expect(await guardarCompraImportada(sql, c)).toBe(false);
    expect(await filas(c.folio)).toHaveLength(1);
  });

  it("R3: bodega null repetida no duplica (NULLS NOT DISTINCT)", async () => {
    const c = compra(`${tag}-R3`, { bodegaCodigo: null, cantidad: 4 });
    expect(await guardarCompraImportada(sql, c)).toBe(true);
    expect(await guardarCompraImportada(sql, c)).toBe(false);
    expect(await filas(c.folio)).toHaveLength(1);
  });

  it("R4: distinta bodega_codigo sí inserta", async () => {
    const folio = `${tag}-R4`;
    expect(await guardarCompraImportada(sql, compra(folio, { bodegaCodigo: "GLP" }))).toBe(true);
    expect(await guardarCompraImportada(sql, compra(folio, { bodegaCodigo: "GL1" }))).toBe(true);
    expect(await filas(folio)).toHaveLength(2);
  });

  it("R5: no escribe stock ni movimientos", async () => {
    const s = (await sql`SELECT count(*)::int AS n FROM stock WHERE producto_id = ${productoId}`) as unknown as { n: number }[];
    const m = (await sql`SELECT count(*)::int AS n FROM movimientos WHERE producto_id = ${productoId}`) as unknown as { n: number }[];
    expect([s[0].n, m[0].n]).toEqual([0, 0]);
  });

  it("R7: mismo folio/producto/bodega con item distinto → 2 filas", async () => {
    const folio = `${tag}-R7`;
    expect(await guardarCompraImportada(sql, compra(folio, { item: 1, cantidad: 20 }))).toBe(true);
    expect(await guardarCompraImportada(sql, compra(folio, { item: 2, cantidad: 40 }))).toBe(true);
    expect((await filas(folio)).map((f) => [f.item, f.cantidad])).toEqual([[1, 20], [2, 40]]);
  });

  it("R8: replay del mismo folio+item no duplica", async () => {
    const c = compra(`${tag}-R8`, { item: 7, cantidad: 3 });
    expect(await guardarCompraImportada(sql, c)).toBe(true);
    expect(await guardarCompraImportada(sql, c)).toBe(false);
    expect(await filas(c.folio)).toHaveLength(1);
  });

  it("R9: item null repetido no duplica", async () => {
    const c = compra(`${tag}-R9`, { item: null, cantidad: 4 });
    expect(await guardarCompraImportada(sql, c)).toBe(true);
    expect(await guardarCompraImportada(sql, c)).toBe(false);
    expect(await filas(c.folio)).toHaveLength(1);
  });

  it("R6: producto inexistente → error, sin fila huérfana", async () => {
    const folio = `${tag}-R6`;
    await expect(guardarCompraImportada(sql, compra(folio, { productoId: 2147483000 }))).rejects.toThrow();
    expect(await filas(folio)).toHaveLength(0);
  });
});
