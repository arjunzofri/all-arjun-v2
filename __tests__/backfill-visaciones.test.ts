/**
 * Fase B — Backfill de movimiento_visaciones
 *
 * Riesgos:
 *  T1. getComprasAnilDesde lanza → no inserta nada, propaga error
 *  T2. (folio, codigo) sin match en Vida Digital → sinMatch=1, no aborta
 *  T3. Doble ejecución → segunda corrida 0 filas, sin errores, sin duplicados
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

// ── Mock de getComprasAnilDesde ───────────────────────────────────────────
vi.mock("@/db/vidadigital/queries", () => ({
  getComprasAnilDesde: vi.fn(),
  getBodegaPorCodigoIngreso: (c: string | null) => {
    if (!c) return null;
    const M: Record<string,string> = { GLP:"Bodega 1 Vida Digital", GL1:"Bodega 2 Vida Digital", GL2:"Bodega 1 Vida Digital" };
    return M[c] ?? null;
  },
}));

import { getComprasAnilDesde } from "@/db/vidadigital/queries";
// ── Import de la función que NO existe todavía (Fase B) ──────────────
import { backfillVisaciones } from "@/lib/sync/backfill-visaciones";

const mockGet = getComprasAnilDesde as ReturnType<typeof vi.fn>;

const sql = neon(process.env.DATABASE_URL!);

const TEST_PREFIX = "TEST-BF";
const CODIGO_A = `${TEST_PREFIX}-A`;
const CODIGO_B = `${TEST_PREFIX}-B`;

beforeAll(async () => {
  await sql`INSERT INTO bodegas (id, nombre) VALUES (1, 'Bodega 1 Vida Digital') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${CODIGO_A}, 'BF A') ON CONFLICT (codigo) DO NOTHING`;
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${CODIGO_B}, 'BF B') ON CONFLICT (codigo) DO NOTHING`;

  // Movimiento con hijos (simula ya backfilleado)
  await sql`
    INSERT INTO movimientos (id, folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
    VALUES (99991, 'BF-YA-HECHO', (SELECT id FROM productos WHERE codigo = ${CODIGO_A}), 'entrada', 10, 1, 1)
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO movimiento_visaciones (movimiento_id, nro_ingreso, cantidad)
    VALUES (99991, '101-26-000000-001-GLP', 10)
    ON CONFLICT (movimiento_id, nro_ingreso) DO NOTHING
  `;

  // Movimiento sin hijos — va a ser backfilleado
  await sql`
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
    VALUES ('BF-SIN-HIJOS', (SELECT id FROM productos WHERE codigo = ${CODIGO_A}), 'entrada', 5, 1, 1)
    ON CONFLICT (folio, producto_id) DO NOTHING
  `;

  // Movimiento sin hijos, producto B — para T2 (sin match)
  await sql`
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
    VALUES ('BF-SIN-MATCH', (SELECT id FROM productos WHERE codigo = ${CODIGO_B}), 'entrada', 3, 1, 1)
    ON CONFLICT (folio, producto_id) DO NOTHING
  `;
});

beforeEach(() => {
  mockGet.mockReset();
});

afterEach(async () => {
  // Limpiar visaciones insertadas por tests, preservando BF-YA-HECHO del seed
  await sql`DELETE FROM movimiento_visaciones WHERE movimiento_id IN (SELECT id FROM movimientos WHERE folio IN ('BF-SIN-HIJOS', 'BF-SIN-MATCH'))`;
});

afterAll(async () => {
  await sql`DELETE FROM movimiento_visaciones WHERE movimiento_id IN (SELECT id FROM movimientos WHERE folio LIKE ${'TEST-BF-%'} OR folio = 'BF-YA-HECHO' OR folio = 'BF-SIN-HIJOS' OR folio = 'BF-SIN-MATCH')`;
  await sql`DELETE FROM movimientos WHERE folio LIKE ${'TEST-BF-%'} OR folio IN ('BF-YA-HECHO', 'BF-SIN-HIJOS', 'BF-SIN-MATCH')`;
  await sql`DELETE FROM productos WHERE codigo IN (${CODIGO_A}, ${CODIGO_B})`;
});

describe("backfillVisaciones", () => {
  it("T1: getComprasAnilDesde lanza → no inserta nada, propaga error", async () => {
    mockGet.mockRejectedValue(new Error("Vida Digital caída"));

    await expect(backfillVisaciones()).rejects.toThrow("Vida Digital caída");
  });

  it("T2: (folio, codigo) sin match → sinMatch=1, no aborta, filasInsertadas correctas", async () => {
    // getComprasAnilDesde devuelve datos para BF-SIN-HIJOS pero NO para BF-SIN-MATCH
    mockGet.mockResolvedValue([
      {
        folio: "BF-SIN-HIJOS",
        fechanvt: "2026-05-19",
        codigo: CODIGO_A,
        detalle: "Test",
        cantidad: 5,
        cantcaja: 1,
        imagenUrl: null,
        bodega: "Bodega 1 Vida Digital",
        visaciones: [{ nroIngreso: "101-26-000000-002-GLP", cantidad: 5 }],
      },
    ]);

    const result = await backfillVisaciones();

    expect(result.sinMatch).toBeGreaterThanOrEqual(1);
    expect(result.procesados).toBeGreaterThanOrEqual(1);
    expect(result.filasInsertadas).toBeGreaterThanOrEqual(1);
  });

  it("T3: doble ejecución → segunda corrida 0 filas insertadas, sin errores, sin duplicados", async () => {
    mockGet.mockResolvedValue([
      {
        folio: "BF-SIN-HIJOS",
        fechanvt: "2026-05-19",
        codigo: CODIGO_A,
        detalle: "Test",
        cantidad: 5,
        cantcaja: 1,
        imagenUrl: null,
        bodega: "Bodega 1 Vida Digital",
        visaciones: [{ nroIngreso: "101-26-000000-002-GLP", cantidad: 5 }],
      },
    ]);

    // Primera corrida
    const r1 = await backfillVisaciones();
    expect(r1.filasInsertadas).toBeGreaterThan(0);

    // Segunda corrida — mismo dato
    const r2 = await backfillVisaciones();
    expect(r2.filasInsertadas).toBe(0);

    // Verificar que no hay duplicados en la DB
    const rows = await sql`
      SELECT COUNT(*)::int as c FROM movimiento_visaciones
      WHERE movimiento_id = (SELECT id FROM movimientos WHERE folio = 'BF-SIN-HIJOS')
        AND nro_ingreso = '101-26-000000-002-GLP'
    `;
    expect((rows as unknown as { c: number }[])[0].c).toBe(1);
  });
});
