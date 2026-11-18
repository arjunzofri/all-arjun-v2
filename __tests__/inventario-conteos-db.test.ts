import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { productos, users } from "@/db/schema";

const host = (u: string | undefined) => new URL(u!).host;
const MIG = resolve(__dirname, "../db/migrations/0001_inventario_conteos.sql");
const ejecutar = async (ddl: string) => {
  for (const st of ddl.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) await db.execute(sql.raw(st));
};
const tag = `INV02-${Date.now()}`;
let prodId = 0;
let userId = 0;
// BIGSERIAL (int8) llega como string por el driver; por eso id es string.
type Fila = { id: string; creado_en: string };
const insertar = (b: number, planta: string, pasillo: string, pos: string, cant: number, key: string) =>
  db.execute<Fila>(sql`INSERT INTO conteos_inventario (producto_id, bodega, planta, pasillo, posicion, cantidad, usuario_id, idempotency_key)
    VALUES (${prodId}, ${b}, ${planta}, ${pasillo}, ${pos}, ${cant}, ${userId}, ${key}) RETURNING id, creado_en`);

beforeAll(async () => {
  // Guardia ANTES de cualquier SQL: el DDL de la migración no puede tocar producción.
  if (host(process.env.DATABASE_URL) === process.env.PROD_DATABASE_URL_HOST) {
    throw new Error("DATABASE_URL apunta a producción: se aborta antes de ejecutar SQL");
  }
  await ejecutar(readFileSync(MIG, "utf8"));
  const [p] = await db.insert(productos).values({ codigo: tag, detalle: "fixture inv-02" }).returning({ id: productos.id });
  prodId = p.id; // antes del usuario: si falla, afterAll igual limpia este producto
  const [u] = await db.insert(users).values({ username: tag }).returning({ id: users.id });
  userId = u.id;
});
afterAll(async () => {
  if (prodId) await db.execute(sql`DELETE FROM conteos_inventario WHERE producto_id = ${prodId}`);
  if (prodId) await db.delete(productos).where(sql`id = ${prodId}`);
  if (userId) await db.delete(users).where(sql`id = ${userId}`);
});

describe("conteos_inventario — persistencia real en rama TEST", () => {
  it("corre solo contra la rama TEST", () => {
    expect(host(process.env.DATABASE_URL)).not.toBe(process.env.PROD_DATABASE_URL_HOST);
  });

  it("aplica la migración dos veces sin perder filas", async () => {
    await insertar(1, "", "A1", "F", 5, `${tag}-idem`);
    await ejecutar(readFileSync(MIG, "utf8"));
    const r = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM conteos_inventario WHERE producto_id = ${prodId}`);
    expect(r.rows[0].n).toBe(1);
  });

  it("columnas de la DB coinciden con el schema Drizzle", async () => {
    const drizzle = Object.values(getTableColumns(schema.conteosInventario)).map((c) => c.name).sort();
    const r = await db.execute<{ column_name: string }>(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'conteos_inventario'`);
    expect(r.rows.map((x) => x.column_name).sort()).toEqual(drizzle);
  });

  it("metadata: pasillo y posicion NOT NULL y constraint de cantidad nombrada", async () => {
    const cols = await db.execute<{ column_name: string; is_nullable: string }>(sql`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'conteos_inventario' AND column_name IN ('pasillo', 'posicion') ORDER BY column_name`);
    expect(cols.rows).toEqual([
      { column_name: "pasillo", is_nullable: "NO" },
      { column_name: "posicion", is_nullable: "NO" },
    ]);
    const ck = await db.execute<{ conname: string }>(sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'conteos_inventario'::regclass AND contype = 'c' AND conname = 'ck_conteos_cantidad'`);
    expect(ck.rows).toHaveLength(1);
  });

  it("acepta cero y la fecha la pone la DB", async () => {
    const r = await insertar(1, "", "A2", "P", 0, `${tag}-cero`);
    expect(Number(r.rows[0].id)).toBeGreaterThan(0);
    expect(Math.abs(Date.now() - new Date(r.rows[0].creado_en).getTime())).toBeLessThan(120000);
  });

  it("rechaza cantidad negativa y ubicaciones inválidas", async () => {
    await expect(insertar(1, "", "A1", "M", -1, `${tag}-neg`)).rejects.toThrow();
    await expect(insertar(1, "ARRIBA", "A1", "M", 1, `${tag}-b1`)).rejects.toThrow();
    await expect(insertar(2, "ARRIBA", "A1", "M", 1, `${tag}-b2`)).rejects.toThrow();
  });

  it("rechaza idempotency_key duplicada", async () => {
    await insertar(1, "", "A3", "F", 2, `${tag}-dup`);
    await expect(insertar(1, "", "A3", "F", 2, `${tag}-dup`)).rejects.toThrow();
  });

  it("vigentes = último por posición, conserva historia y no mezcla bodegas", async () => {
    await insertar(2, "ABAJO", "DERECHA", "M", 5, `${tag}-h1`);
    const ultimo = await insertar(2, "ABAJO", "DERECHA", "M", 3, `${tag}-h2`);
    await insertar(1, "", "A4", "M", 7, `${tag}-b1pos`);
    // Filas de este caso únicamente: las posiciones anteriores del describe siguen en la vista.
    const r = await db.execute<{ id: string; cantidad: number; bodega: number }>(sql`
      SELECT id, cantidad, bodega FROM conteos_vigentes WHERE producto_id = ${prodId}
        AND ((bodega = 1 AND planta = '' AND pasillo = 'A4' AND posicion = 'M')
          OR (bodega = 2 AND planta = 'ABAJO' AND pasillo = 'DERECHA' AND posicion = 'M'))
      ORDER BY bodega, id`);
    const hist = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM conteos_inventario
      WHERE producto_id = ${prodId} AND bodega = 2 AND planta = 'ABAJO' AND pasillo = 'DERECHA' AND posicion = 'M'`);
    expect(hist.rows[0].n).toBe(2);
    const b2 = r.rows.filter((x) => Number(x.bodega) === 2);
    expect(b2).toHaveLength(1);
    expect(Number(b2[0].id)).toBe(Number(ultimo.rows[0].id));
    expect(Number(b2[0].cantidad)).toBe(3);
    expect(r.rows.filter((x) => Number(x.bodega) === 1)).toHaveLength(1);
  });
});
