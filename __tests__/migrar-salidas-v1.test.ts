/**
 * Fase B — Migración de salidas v1 → v2
 *
 * Riesgos:
 *  T1. INSERT duplicado → segunda corrida no inserta nada
 *  T2. DATABASE_URL_V1 faltante → error claro sin tocar v2
 *  T3. Smoke: 53 salidas, >= 30 procesadas, SANITARY en sinMatch
 */

import { describe, it, expect, afterEach } from "vitest";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

afterEach(async () => {
  await sql`DELETE FROM movimiento_visaciones
            WHERE movimiento_id IN (
              SELECT id FROM movimientos WHERE folio LIKE 'V1-SAL-%'
            )`;
  await sql`DELETE FROM movimientos WHERE folio LIKE 'V1-SAL-%'`;
  await sql`DELETE FROM stock WHERE modulo_id IS NOT NULL`;
});

// ── Import de la función que NO existe todavía (Fase B) ──────────────
import { migrarSalidasV1 } from "@/lib/sync/migrar-salidas-v1";

describe("migrarSalidasV1", () => {
  it("T1: doble ejecución → segunda corrida filasInsertadas=0, sin duplicados", async () => {
    const r1 = await migrarSalidasV1();
    expect(r1.filasInsertadas).toBeGreaterThan(0);

    const r2 = await migrarSalidasV1();
    expect(r2.filasInsertadas).toBe(0);
    expect(r2.procesadas).toBe(r1.procesadas); // igual que la primera
  }, 60000);

  it("T2: DATABASE_URL_V1 ausente → lanza error claro", async () => {
    const original = process.env.DATABASE_URL_V1;
    delete process.env.DATABASE_URL_V1;

    await expect(migrarSalidasV1()).rejects.toThrow(/DATABASE_URL_V1|V1|conexi[oó]n/i);

    process.env.DATABASE_URL_V1 = original;
  });

  it("T3 smoke: 53 salidas, >= 30 procesadas, SANITARY en sinMatch", async () => {
    const r = await migrarSalidasV1();

    expect(r.totalV1).toBe(53);
    expect(r.procesadas).toBeGreaterThanOrEqual(30);
    expect(r.filasInsertadas).toBeGreaterThan(0);

    const sinMatch = r.sinMatchProducto as { codigo_v1: string }[];
    expect(sinMatch.some((s) => s.codigo_v1 === "SANITARY")).toBe(true);
  }, 30000);
});
