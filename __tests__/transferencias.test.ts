/**
 * Fase B — Slice Transferencias: Tests que intentan romper transferencias entre bodegas.
 * Riesgos: R1 stock insuficiente en bodega origen,
 * R2 producto sin stock en bodega origen,
 * R3 smoke E2E del flujo completo.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: "62" } });
});

// MODULE_NOT_FOUND en Fase B — la acción no existe aún.
import { transferirEntreBodegas } from "@/lib/actions/transferencias";

let sql: ReturnType<typeof neon>;
const TEST_CODIGO = "TEST-TRF-001";
const TEST_CODIGO_SIN_STOCK = "TEST-TRF-002";

beforeAll(async () => {
  sql = neon(process.env.DATABASE_URL!);

  // Seed bodegas
  for (const nombre of ["Bodega 1 Vida Digital", "Bodega 2 Vida Digital", "Bodega Arjun"]) {
    await sql`INSERT INTO bodegas (nombre) VALUES (${nombre}) ON CONFLICT (nombre) DO NOTHING`;
  }

  // Limpiar tests anteriores
  await sql`DELETE FROM movimientos WHERE folio LIKE 'TRF-%'`;
  await sql`DELETE FROM stock WHERE producto_id IN (SELECT id FROM productos WHERE codigo IN (${TEST_CODIGO}, ${TEST_CODIGO_SIN_STOCK}))`;
  await sql`DELETE FROM productos WHERE codigo IN (${TEST_CODIGO}, ${TEST_CODIGO_SIN_STOCK})`;

  // Producto con stock en bodega 1 (10 unidades)
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${TEST_CODIGO}, 'Test transferencia') ON CONFLICT (codigo) DO NOTHING`;
  const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
  const pId = (pid as unknown as { id: number }[])[0].id;
  await sql`
    INSERT INTO stock (producto_id, bodega_id, cantidad)
    VALUES (${pId}, 1, 10)
    ON CONFLICT (producto_id, bodega_id)
    DO UPDATE SET cantidad = 10
  `;

  // Producto SIN stock en ninguna bodega (solo existe en productos)
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${TEST_CODIGO_SIN_STOCK}, 'Sin stock en origen') ON CONFLICT (codigo) DO NOTHING`;
});

// ── R1: Stock insuficiente en bodega origen ────────────────────────────
describe("transferirEntreBodegas() — stock insuficiente", () => {
  it("rechaza si cantidad > stock en bodega origen", async () => {
    await expect(
      transferirEntreBodegas({
        codigo: TEST_CODIGO,
        cantidad: 999,
        bodegaOrigenId: 1,
        bodegaDestinoId: 2,
        idempotencyKey: "test-r1-stock-insuf",
      })
    ).rejects.toThrow(/stock|insuficiente|disponible/i);
  });

  it("rechaza cantidad 0 o negativa", async () => {
    await expect(
      transferirEntreBodegas({
        codigo: TEST_CODIGO,
        cantidad: 0,
        bodegaOrigenId: 1,
        bodegaDestinoId: 2,
        idempotencyKey: "test-r1-zero",
      })
    ).rejects.toThrow(/cantidad/i);
  });
});

// ── R2: Producto sin stock en bodega origen ────────────────────────────
describe("transferirEntreBodegas() — producto sin stock en origen", () => {
  it("rechaza si el producto no tiene fila en stock para la bodega origen", async () => {
    await expect(
      transferirEntreBodegas({
        codigo: TEST_CODIGO_SIN_STOCK,
        cantidad: 1,
        bodegaOrigenId: 1,
        bodegaDestinoId: 2,
        idempotencyKey: "test-r2-sin-stock",
      })
    ).rejects.toThrow(/stock|insuficiente|disponible|producto/i);
  });
});

// ── Misma bodega ───────────────────────────────────────────────────────
describe("transferirEntreBodegas() — misma bodega", () => {
  it("rechaza si origen y destino son la misma bodega", async () => {
    await expect(
      transferirEntreBodegas({
        codigo: TEST_CODIGO,
        cantidad: 1,
        bodegaOrigenId: 1,
        bodegaDestinoId: 1,
        idempotencyKey: "test-misma-bodega",
      })
    ).rejects.toThrow(/misma|igual|distinta/i);
  });
});

// ── R3: Smoke E2E — flujo completo ─────────────────────────────────────
describe("transferirEntreBodegas() — smoke E2E", () => {
  const key = `TRF-SMOKE-${Date.now()}`;

  it("transfiere correctamente: descuenta origen, suma destino, crea dos movimientos", async () => {
    const result = await transferirEntreBodegas({
      codigo: TEST_CODIGO,
      cantidad: 4,
      bodegaOrigenId: 1,
      bodegaDestinoId: 2,
      idempotencyKey: key,
      observaciones: "Traslado interbodega",
    });

    expect(result).toHaveProperty("ok", true);
    expect(result).toHaveProperty("outId");
    expect(result).toHaveProperty("inId");

    const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
    const pId = (pid as unknown as { id: number }[])[0].id;

    // Stock bodega origen (1): 10 - 4 = 6
    const stockOrigen = await sql`
      SELECT cantidad FROM stock
      WHERE producto_id = ${pId} AND bodega_id = 1
    `;
    expect((stockOrigen as unknown as { cantidad: number }[])[0].cantidad).toBe(6);

    // Stock bodega destino (2): 0 + 4 = 4
    const stockDestino = await sql`
      SELECT cantidad FROM stock
      WHERE producto_id = ${pId} AND bodega_id = 2
    `;
    expect((stockDestino as unknown as { cantidad: number }[])[0].cantidad).toBe(4);

    // Dos movimientos: TRF-{key}-OUT (salida) y TRF-{key}-IN (entrada)
    const movs = await sql`
      SELECT folio, tipo, cantidad, bodega_origen_id, observaciones
      FROM movimientos
      WHERE folio LIKE ${`TRF-${key}%`}
      ORDER BY folio
    `;
    const rows = movs as unknown as {
      folio: string; tipo: string; cantidad: number;
      bodega_origen_id: number; observaciones: string | null;
    }[];

    expect(rows).toHaveLength(2);

    // Movimiento OUT (salida de origen)
    const out = rows.find(r => r.folio.endsWith("-OUT"));
    expect(out).toBeDefined();
    expect(out!.tipo).toBe("salida");
    expect(out!.cantidad).toBe(4);
    expect(out!.bodega_origen_id).toBe(1);
    expect(out!.observaciones).toBe("Traslado interbodega");

    // Movimiento IN (entrada a destino)
    const inn = rows.find(r => r.folio.endsWith("-IN"));
    expect(inn).toBeDefined();
    expect(inn!.tipo).toBe("entrada");
    expect(inn!.cantidad).toBe(4);
    expect(inn!.bodega_origen_id).toBe(2);
    expect(inn!.observaciones).toBe("Traslado interbodega");
  });

  it("es idempotente: repetir con misma key no duplica ni altera stock", async () => {
    // Repetir la misma operación con la misma key
    await transferirEntreBodegas({
      codigo: TEST_CODIGO,
      cantidad: 4,
      bodegaOrigenId: 1,
      bodegaDestinoId: 2,
      idempotencyKey: key,
    });

    const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
    const pId = (pid as unknown as { id: number }[])[0].id;

    // Stock no se alteró (sigue 6 y 4, no 2 y 8)
    const stockOrigen = await sql`
      SELECT cantidad FROM stock WHERE producto_id = ${pId} AND bodega_id = 1
    `;
    expect((stockOrigen as unknown as { cantidad: number }[])[0].cantidad).toBe(6);

    const stockDestino = await sql`
      SELECT cantidad FROM stock WHERE producto_id = ${pId} AND bodega_id = 2
    `;
    expect((stockDestino as unknown as { cantidad: number }[])[0].cantidad).toBe(4);

    // Sigue habiendo exactamente 2 movimientos
    const movs = await sql`
      SELECT COUNT(*)::int AS n FROM movimientos WHERE folio LIKE ${`TRF-${key}%`}
    `;
    expect((movs as unknown as { n: number }[])[0].n).toBe(2);
  });

  it("crea producto en bodega destino si no existía", async () => {
    // TEST_CODIGO solo tenía stock en bodega 1. Transferir a bodega 3 (sin stock previo).
    const k = `TRF-NEW-${Date.now()}`;
    await transferirEntreBodegas({
      codigo: TEST_CODIGO,
      cantidad: 2,
      bodegaOrigenId: 1,
      bodegaDestinoId: 3,
      idempotencyKey: k,
    });

    const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
    const pId = (pid as unknown as { id: number }[])[0].id;

    // Debe existir una fila en stock para bodega 3 con cantidad 2
    const stockB3 = await sql`
      SELECT cantidad FROM stock WHERE producto_id = ${pId} AND bodega_id = 3
    `;
    expect((stockB3 as unknown as { cantidad: number }[])[0].cantidad).toBe(2);
  });
});

// ── T-AUTH: auth() retorna null ──────────────────────────────────────
describe("transferirEntreBodegas — auth", () => {
  it("lanza 'No autenticado' si auth() retorna null", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      transferirEntreBodegas({
        codigo: TEST_CODIGO,
        cantidad: 1,
        bodegaOrigenId: 1,
        bodegaDestinoId: 2,
        idempotencyKey: `AUTH-TEST-${Date.now()}`,
      })
    ).rejects.toThrow(/autenticad|auth/i);
  });
});
