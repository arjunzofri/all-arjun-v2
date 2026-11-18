import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { productos, users } from "@/db/schema";

const host = (u: string | undefined) => new URL(u!).host;
const M1 = resolve(__dirname, "../db/migrations/0001_inventario_conteos.sql");
const M2 = resolve(__dirname, "../db/migrations/0002_registrar_conteo.sql");
// 0001 se puede partir por ';' externos; 0002 NO (el cuerpo PL/pgSQL tiene ';' internos).
const ejecutar = async (ddl: string) => {
  for (const st of ddl.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) await db.execute(sql.raw(st));
};
const tag = `INV03-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
let prodId = 0;
let u1 = 0;
let u2 = 0;
// id/creado_en vienen dentro de jsonb: número/ISO, no string bigint de columna.
type Fila = { id: number; cantidad: number; usuario_id: number; idempotency_key: string; creado_en: string };
type Resp = { ok: boolean; repetido?: boolean; conteo?: Fila; conflicto?: boolean; vigente?: Fila };
const llamar = async (b: number, planta: string, pasillo: string, pos: string, cant: number, user: number, key: string, esperado: string | null = null) => {
  const r = await db.execute<{ r: Resp }>(sql`SELECT public.registrar_conteo(${prodId}, ${b}, ${planta}, ${pasillo}, ${pos}, ${cant}, ${user}, ${key}, ${esperado}::bigint) AS r`);
  return r.rows[0].r;
};
const filas = async (b: number, planta: string, pasillo: string, pos: string) =>
  (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM conteos_inventario WHERE producto_id = ${prodId} AND bodega = ${b} AND planta = ${planta} AND pasillo = ${pasillo} AND posicion = ${pos}`)).rows[0].n;

beforeAll(async () => {
  // Guardia ANTES de cualquier SQL: el DDL no puede tocar producción.
  if (host(process.env.DATABASE_URL) === process.env.PROD_DATABASE_URL_HOST) throw new Error("DATABASE_URL apunta a producción: se aborta antes de ejecutar SQL");
  await ejecutar(readFileSync(M1, "utf8"));
  await db.execute(sql.raw(readFileSync(M2, "utf8"))); // sin split, completa
  const [p] = await db.insert(productos).values({ codigo: tag, detalle: "fixture inv-03" }).returning({ id: productos.id });
  prodId = p.id;
  const us = await db.insert(users).values([{ username: `${tag}-a` }, { username: `${tag}-b` }]).returning({ id: users.id });
  u1 = us[0].id; u2 = us[1].id;
});
afterAll(async () => {
  if (prodId) await db.execute(sql`DELETE FROM conteos_inventario WHERE producto_id = ${prodId}`);
  if (prodId) await db.delete(productos).where(sql`id = ${prodId}`);
  if (u1) await db.delete(users).where(sql`id = ${u1}`);
  if (u2) await db.delete(users).where(sql`id = ${u2}`);
});

describe("registrar_conteo — función atómica real en rama TEST", () => {
  it("crea con esperado nulo, acepta cero y toma usuario/tiempo de DB", async () => {
    const r = await llamar(1, "", "A1", "F", 0, u1, `${tag}-k1`);
    expect(r.ok).toBe(true);
    expect(r.repetido).toBe(false);
    expect(r.conteo!.cantidad).toBe(0);
    expect(Number(r.conteo!.id)).toBeGreaterThan(0);
    expect(Number(r.conteo!.usuario_id)).toBe(u1);
    expect(Math.abs(Date.now() - new Date(r.conteo!.creado_en).getTime())).toBeLessThan(120000);
  });
  it("replay exacto devuelve la fila original aunque expected ya esté viejo", async () => {
    const a = await llamar(1, "", "A2", "P", 4, u1, `${tag}-k2`);
    const b = await llamar(1, "", "A2", "P", 4, u1, `${tag}-k2`, "0");
    expect(b.ok).toBe(true);
    expect(b.repetido).toBe(true);
    expect(Number(b.conteo!.id)).toBe(Number(a.conteo!.id));
    expect(await filas(1, "", "A2", "P")).toBe(1);
  });
  it("expected viejo: conflicto con vigente, sin insertar", async () => {
    const a = await llamar(2, "ARRIBA", "IZQUIERDA", "M", 7, u1, `${tag}-k3`);
    const b = await llamar(2, "ARRIBA", "IZQUIERDA", "M", 9, u1, `${tag}-k4`, "0");
    expect(b.ok).toBe(false);
    expect(b.conflicto).toBe(true);
    expect(Number(b.vigente!.id)).toBe(Number(a.conteo!.id));
    expect(await filas(2, "ARRIBA", "IZQUIERDA", "M")).toBe(1);
  });
  it("bodega 2 no interfiere con bodega 1", async () => {
    const b2 = await llamar(2, "ABAJO", "DERECHA", "F", 3, u1, `${tag}-k5`);
    const b1 = await llamar(1, "", "A3", "F", 5, u1, `${tag}-k6`);
    expect(b2.ok && b1.ok).toBe(true);
    expect(await filas(2, "ABAJO", "DERECHA", "F")).toBe(1);
    expect(await filas(1, "", "A3", "F")).toBe(1);
  });
  it("rechaza clave reusada con otro payload o de otro usuario, sin insertar", async () => {
    const r = await llamar(1, "", "A1", "M", 6, u1, `${tag}-k7`);
    await expect(llamar(1, "", "A1", "M", 7, u1, `${tag}-k7`)).rejects.toThrow();
    await expect(llamar(1, "", "A1", "M", 6, u2, `${tag}-k7`)).rejects.toThrow();
    expect(Number(r.conteo!.usuario_id)).toBe(u1);
    expect(await filas(1, "", "A1", "M")).toBe(1);
    await llamar(1, "", "A4", "P", 2, u1, `${tag}-k8`);
    await expect(llamar(1, "", "A4", "M", 2, u1, `${tag}-k8`)).rejects.toThrow();
    expect(await filas(1, "", "A4", "P")).toBe(1);
  });
  it("no escribe stock ni movimientos", async () => {
    const [s, m] = await Promise.all([
      db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM stock WHERE producto_id = ${prodId}`),
      db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM movimientos WHERE producto_id = ${prodId}`),
    ]);
    expect(s.rows[0].n).toBe(0);
    expect(m.rows[0].n).toBe(0);
  });
});

describe("registrar_conteo — concurrencia real en rama TEST", () => {
  it("misma clave concurrente: una fila, una respuesta replay", async () => {
    const [a, b] = await Promise.all([
      llamar(1, "", "A2", "M", 8, u1, `${tag}-kc1`),
      llamar(1, "", "A2", "M", 8, u1, `${tag}-kc1`),
    ]);
    expect([a, b].filter((x) => x.ok && x.repetido === false)).toHaveLength(1);
    expect([a, b].filter((x) => x.ok && x.repetido === true)).toHaveLength(1);
    expect(Number(a.conteo!.id)).toBe(Number(b.conteo!.id));
    expect(await filas(1, "", "A2", "M")).toBe(1);
  });
  it("dos claves distintas con esperado nulo: una ok y otra conflicto", async () => {
    const [a, b] = await Promise.all([
      llamar(2, "ABAJO", "IZQUIERDA", "P", 1, u1, `${tag}-kc2`),
      llamar(2, "ABAJO", "IZQUIERDA", "P", 2, u2, `${tag}-kc3`),
    ]);
    expect([a, b].filter((x) => x.ok)).toHaveLength(1);
    expect([a, b].filter((x) => !x.ok && x.conflicto)).toHaveLength(1);
    expect(await filas(2, "ABAJO", "IZQUIERDA", "P")).toBe(1);
  });
});
