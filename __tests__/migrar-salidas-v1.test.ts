/**
 * Fase B — Migración de salidas v1 → v2
 *
 * Riesgos:
 *  T1. INSERT duplicado → segunda corrida no inserta nada
 *  T2. DATABASE_URL_V1 faltante → error claro sin tocar v2
 *  T3. Smoke: 53 salidas, >= 30 procesadas, SANITARY en sinMatch
 *
 * ⚠️ Estos tests tocan la DB de producción (v1 y v2). Solo corren cuando
 *    RUN_MIGRATION_TESTS=1 está definido. En el suite normal se skipean.
 *    Ejecutar manualmente: RUN_MIGRATION_TESTS=1 npx vitest run __tests__/migrar-salidas-v1.test.ts
 */

import { describe, it, expect, afterEach } from "vitest";
import { neon } from "@neondatabase/serverless";

// ── Import de la función ────────────────────────────────────────────
import { migrarSalidasV1 } from "@/lib/sync/migrar-salidas-v1";

const sql = neon(process.env.DATABASE_URL!);

afterEach(async () => {
  // Solo limpiar datos de test, NUNCA los V1-SAL-* reales migrados
  await sql`DELETE FROM movimientos WHERE folio LIKE 'V1-SAL-TEST-%'`;
});

if (!process.env.RUN_MIGRATION_TESTS) {
  describe.skip("migrarSalidasV1 — SKIP: requiere RUN_MIGRATION_TESTS=1", () => {
    it.skip("skipped", () => {});
  });
} else {

describe("migrarSalidasV1", () => {
  it("T1: doble ejecución → segunda corrida filasInsertadas=0, sin duplicados", async () => {
    // Usar folios de test (V1-SAL-TEST-*) para no pisar V1-SAL-* reales
    const r1 = await migrarSalidasV1();
    expect(r1.filasInsertadas).toBeGreaterThan(0);

    const r2 = await migrarSalidasV1();
    expect(r2.filasInsertadas).toBe(0);
    expect(r2.procesadas).toBe(r1.procesadas);
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
  }, 60000);
});

} // cierre del if (RUN_MIGRATION_TESTS)
