/**
 * Fase B — Slice 07: Tests que intentan romper salidas (bodega → módulo).
 * Riesgos: R1 stock insuficiente, R2 doble submit duplica, R3 CTE atómica,
 * R4 módulo inválido, R5 producto sin stock no aparece.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

// Mock auth para tests de endpoint
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { crearSalida } from "@/lib/actions/salidas";
import { GET as getPorBodega } from "@/app/api/productos/por-bodega/route";

let sql: ReturnType<typeof neon>;
const TEST_CODIGO = "TEST-SAL-001";

beforeAll(async () => {
  sql = neon(process.env.DATABASE_URL!);
  // Seed: bodegas, módulos, producto con stock
  for (const nombre of ["Bodega 1 Vida Digital", "Bodega 2 Vida Digital", "Bodega Arjun"]) {
    await sql`INSERT INTO bodegas (nombre) VALUES (${nombre}) ON CONFLICT (nombre) DO NOTHING`;
  }
  for (const nombre of ["Módulo 180", "Módulo 182", "Módulo 183", "Módulo 184", "Módulo 193"]) {
    await sql`INSERT INTO modulos (nombre) VALUES (${nombre}) ON CONFLICT (nombre) DO NOTHING`;
  }
  // Limpiar tests anteriores
  await sql`DELETE FROM movimientos WHERE folio LIKE 'SAL-%'`;
  await sql`DELETE FROM stock WHERE producto_id IN (SELECT id FROM productos WHERE codigo = ${TEST_CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;

  // Crear producto con stock en bodega 1
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${TEST_CODIGO}, 'Test salida') ON CONFLICT (codigo) DO NOTHING`;
  const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
  const productoId = (pid as unknown as { id: number }[])[0].id;
  await sql`
    INSERT INTO stock (producto_id, bodega_id, cantidad)
    VALUES (${productoId}, 1, 10)
    ON CONFLICT (producto_id, bodega_id)
    DO UPDATE SET cantidad = 10
  `;
});

// ── R1: Stock insuficiente ─────────────────────────────────────────────
describe("crearSalida() — stock insuficiente", () => {
  it("rechaza si cantidad > stock disponible", async () => {
    await expect(
      crearSalida({
        codigo: TEST_CODIGO,
        cantidad: 999,
        bodegaOrigenId: 1,
        moduloDestinoId: 1,
        idempotencyKey: "test-r1-stock",
        usuarioId: 1,
      })
    ).rejects.toThrow(/stock|insuficiente|disponible/i);
  });

  it("rechaza cantidad 0 o negativa", async () => {
    await expect(
      crearSalida({
        codigo: TEST_CODIGO,
        cantidad: 0,
        bodegaOrigenId: 1,
        moduloDestinoId: 1,
        idempotencyKey: "test-r1-zero",
        usuarioId: 1,
      })
    ).rejects.toThrow(/cantidad/i);
  });
});

// ── R4: Módulo inválido ────────────────────────────────────────────────
describe("crearSalida() — módulo inválido", () => {
  it("rechaza módulo que no existe", async () => {
    await expect(
      crearSalida({
        codigo: TEST_CODIGO,
        cantidad: 1,
        bodegaOrigenId: 1,
        moduloDestinoId: 9999,
        idempotencyKey: "test-r4-mod",
        usuarioId: 1,
      })
    ).rejects.toThrow(/módulo|modulo/i);
  });
});

// ── R2 + R3: Idempotencia + atomicidad ─────────────────────────────────
describe("crearSalida() — idempotencia y atomicidad", () => {
  const key = `SAL-TEST-${Date.now()}`;

  it("ejecuta salida correctamente: descuenta bodega, suma módulo", async () => {
    const result = await crearSalida({
      codigo: TEST_CODIGO,
      cantidad: 3,
      bodegaOrigenId: 1,
      moduloDestinoId: 1,
      idempotencyKey: key,
      usuarioId: 1,
    });

    expect(result).toHaveProperty("movimientoId");

    // Stock bodega: 10 - 3 = 7
    const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
    const pId = (pid as unknown as { id: number }[])[0].id;
    const sb = await sql`SELECT cantidad FROM stock WHERE producto_id = ${pId} AND bodega_id = 1`;
    expect((sb as unknown as { cantidad: number }[])[0].cantidad).toBe(7);

    // Stock módulo: 0 + 3 = 3
    const sm = await sql`SELECT cantidad FROM stock WHERE producto_id = ${pId} AND modulo_id = 1`;
    expect((sm as unknown as { cantidad: number }[])[0].cantidad).toBe(3);
  });

  it("no duplica con mismo idempotencyKey", async () => {
    await crearSalida({
      codigo: TEST_CODIGO,
      cantidad: 3,
      bodegaOrigenId: 1,
      moduloDestinoId: 1,
      idempotencyKey: key,
      usuarioId: 1,
    });

    // Stock bodega: sigue siendo 7 (no 4)
    const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
    const pId = (pid as unknown as { id: number }[])[0].id;
    const sb = await sql`SELECT cantidad FROM stock WHERE producto_id = ${pId} AND bodega_id = 1`;
    expect((sb as unknown as { cantidad: number }[])[0].cantidad).toBe(7);

    // Solo un movimiento con ese folio
    const movs = await sql`SELECT COUNT(*)::int AS n FROM movimientos WHERE folio = ${`SAL-${key}`}`;
    expect((movs as unknown as { n: number }[])[0].n).toBe(1);
  });
});

// ── R-obs-3: Observaciones en salida ────────────────────────────────────
describe("crearSalida() — observaciones", () => {
  it("guarda observaciones en el movimiento", async () => {
    const key = `SAL-OBS-${Date.now()}`;
    await crearSalida({
      codigo: TEST_CODIGO,
      cantidad: 1,
      bodegaOrigenId: 1,
      moduloDestinoId: 1,
      idempotencyKey: key,
      usuarioId: 1,
      observaciones: "Despachado sin verificar",
    });

    const rows = await sql`
      SELECT observaciones FROM movimientos
      WHERE folio = ${`SAL-${key}`}
    `;
    const r = rows as unknown as { observaciones: string | null }[];
    expect(r[0]?.observaciones).toBe("Despachado sin verificar");
  });
});

// ── R5: Producto sin stock no aparece ──────────────────────────────────
describe("GET /api/productos/por-bodega", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 1, email: "test@arjun.local", role: "admin" } });
  });

  it("no lista producto sin stock en esa bodega", async () => {
    const req = new Request(
      "https://app-arjun.local/api/productos/por-bodega?bodegaId=2"
    );
    const res = await getPorBodega(req);
    const body = await res.json();
    const codes = body.items?.map((i: { codigo: string }) => i.codigo) ?? [];
    expect(codes).not.toContain(TEST_CODIGO); // stock está en bodega 1, no 2
  });

  it("lista producto con stock en la bodega correcta", async () => {
    const req = new Request(
      "https://app-arjun.local/api/productos/por-bodega?bodegaId=1"
    );
    const res = await getPorBodega(req);
    const body = await res.json();
    const codes = body.items?.map((i: { codigo: string }) => i.codigo) ?? [];
    expect(codes).toContain(TEST_CODIGO);
  });
});
