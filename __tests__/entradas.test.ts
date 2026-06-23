/**
 * Fase B — Slice 05: Tests que intentan romper las entradas manuales.
 * Riesgos: R1 doble submit duplica, R2 cantidad ≤ 0, R3 bodega null, R4 upsert producto.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: "62" } });
});

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { crearEntrada } from "@/lib/actions/entradas";

// Cliente raw para verificar DB
let sql: ReturnType<typeof import("@neondatabase/serverless").neon>;

beforeAll(async () => {
  const { neon } = await import("@neondatabase/serverless");
  sql = neon(process.env.DATABASE_URL!);
  // Seed bodegas si no existen
  for (const nombre of ["Bodega 1 Vida Digital", "Bodega 2 Vida Digital", "Bodega Arjun"]) {
    await sql`INSERT INTO bodegas (nombre) VALUES (${nombre}) ON CONFLICT (nombre) DO NOTHING`;
  }
  // Limpiar datos de tests anteriores
  await sql`DELETE FROM movimientos WHERE folio LIKE 'MAN-ENT-TEST-%' OR folio LIKE 'MAN-TEST-%' OR folio LIKE 'MAN-ENT-OBS-%'`;
  await sql`DELETE FROM stock WHERE producto_id IN (SELECT id FROM productos WHERE codigo LIKE 'TEST-ENT-%')`;
  await sql`DELETE FROM productos WHERE codigo LIKE 'TEST-ENT-%'`;
});

// ── R2: Cantidad inválida ───────────────────────────────────────────────
describe("crearEntrada() — validación", () => {
  it("rechaza cantidad 0", async () => {
    await expect(
      crearEntrada({
        codigo: "TEST-ENT-001",
        detalle: "Test",
        cantidad: 0,
        bodegaId: 1,
        idempotencyKey: "test-r2-1",
      })
    ).rejects.toThrow(/cantidad/);
  });

  it("rechaza cantidad negativa", async () => {
    await expect(
      crearEntrada({
        codigo: "TEST-ENT-001",
        detalle: "Test",
        cantidad: -5,
        bodegaId: 1,
        idempotencyKey: "test-r2-2",
      })
    ).rejects.toThrow(/cantidad/);
  });
});

// ── R3: Bodega inválida ────────────────────────────────────────────────
describe("crearEntrada() — bodega", () => {
  it("rechaza bodegaId 0 (Zod validation)", async () => {
    await expect(
      crearEntrada({
        codigo: "TEST-ENT-002",
        detalle: "Test",
        cantidad: 10,
        bodegaId: 0,
        idempotencyKey: "test-r3-1",
      })
    ).rejects.toThrow(/Bodega/);
  });

  it("rechaza bodegaId que no existe", async () => {
    await expect(
      crearEntrada({
        codigo: "TEST-ENT-002",
        detalle: "Test",
        cantidad: 10,
        bodegaId: 9999,
        idempotencyKey: "test-r3-2",
      })
    ).rejects.toThrow(/Bodega no encontrada/);
  });
});

// ── R1 + R4: Idempotencia + upsert producto ────────────────────────────
describe("crearEntrada() — idempotencia y upsert", () => {
  const idempotencyKey = `ENT-TEST-${Date.now()}`;

  it("crea entrada y stock correctamente", async () => {
    const result = await crearEntrada({
      codigo: "TEST-ENT-003",
      detalle: "Producto entrada manual",
      cantidad: 5,
      bodegaId: 1,
      idempotencyKey,
    });

    expect(result).toHaveProperty("movimientoId");
    expect(typeof result.movimientoId).toBe("number");

    // Verificar stock
    const stock = await sql`
      SELECT cantidad FROM stock
      WHERE producto_id = (SELECT id FROM productos WHERE codigo = 'TEST-ENT-003')
        AND bodega_id = 1
    `;
    const rows = stock as unknown as { cantidad: number }[];
    expect(rows[0]?.cantidad).toBe(5);
  });

  // R1: doble submit con misma idempotencyKey no duplica
  it("no duplica con misma idempotencyKey", async () => {
    await crearEntrada({
      codigo: "TEST-ENT-003",
      detalle: "Producto entrada manual",
      cantidad: 5,
      bodegaId: 1,
      idempotencyKey,
    });

    // Stock debe seguir siendo 5 (no 10)
    const stock = await sql`
      SELECT cantidad FROM stock
      WHERE producto_id = (SELECT id FROM productos WHERE codigo = 'TEST-ENT-003')
        AND bodega_id = 1
    `;
    const rows = stock as unknown as { cantidad: number }[];
    expect(rows[0]?.cantidad).toBe(5);

    // Solo un movimiento con ese folio
    const movs = await sql`
      SELECT COUNT(*)::int AS n FROM movimientos
      WHERE folio = ${`MAN-${idempotencyKey}`}
    `;
    expect((movs as unknown as { n: number }[])[0].n).toBe(1);
  });

  // R4: upsert de producto nuevo
  it("crea el producto si no existe", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql2 = neon(process.env.DATABASE_URL!);
    const p = await sql2`
      SELECT id, codigo, detalle FROM productos WHERE codigo = 'TEST-ENT-003'
    `;
    const rows = p as unknown as { id: number; codigo: string; detalle: string | null }[];
    expect(rows.length).toBe(1);
    expect(rows[0].codigo).toBe("TEST-ENT-003");
  });
});

// ── R-obs-1 + R-obs-2: Observaciones ────────────────────────────────────
describe("crearEntrada() — observaciones", () => {
  const key = `ENT-OBS-${Date.now()}`;

  it("guarda observaciones en el movimiento", async () => {
    await crearEntrada({
      codigo: "TEST-ENT-004",
      detalle: "Con observacion",
      cantidad: 3,
      bodegaId: 1,
      idempotencyKey: key,
      observaciones: "Llegó con caja abierta",
    });

    const rows = await sql`
      SELECT observaciones FROM movimientos
      WHERE folio = ${`MAN-${key}`}
    `;
    const r = rows as unknown as { observaciones: string | null }[];
    expect(r[0]?.observaciones).toBe("Llegó con caja abierta");
  });

  it("rechaza observaciones > 500 caracteres", async () => {
    const larga = "x".repeat(501);
    await expect(
      crearEntrada({
        codigo: "TEST-ENT-005",
        detalle: "Observacion larga",
        cantidad: 1,
        bodegaId: 1,
        idempotencyKey: `ENT-OBS-LONG-${Date.now()}`,
        observaciones: larga,
      })
    ).rejects.toThrow(/observaciones|500/);
  });
});
