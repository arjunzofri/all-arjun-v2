/**
 * Fase B — Sub-slice 6: Entradas manuales corregibles vía ajuste
 *
 * Riesgos:
 *  T1. Idempotencia: mismo idempotencyKey dos veces → no duplica
 *  T2. Race condition: dos llamadas simultáneas → una gana, la otra no crashea
 *  T3. Smoke: crearAjuste con entrada MAN-*, stock reducido, ajuste negativo
 *  T4. Validaciones: sync rechazada, cantidadReal >= original rechazada,
 *      calcularCorreccionEntrada: delta positivo
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: "62" } });
});

// ── Imports de funciones que NO existen todavía (Fase B) ──────────────
import { crearAjuste } from "@/lib/actions/ajustes";
import { calcularCorreccionEntrada } from "@/lib/utils/movimiento-ubicacion";

const sql = neon(process.env.DATABASE_URL!);

const TEST_PREFIX = "TEST-AE";
const CODIGO = `${TEST_PREFIX}-${Date.now()}`;

let movManualId: number;
let movSyncId: number;

beforeAll(async () => {
  await sql`INSERT INTO bodegas (id, nombre) VALUES (1, 'Bodega 1 Vida Digital') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${CODIGO}, 'Test ajuste entrada') ON CONFLICT (codigo) DO NOTHING`;
  await sql`
    INSERT INTO stock (producto_id, bodega_id, cantidad)
    VALUES ((SELECT id FROM productos WHERE codigo = ${CODIGO}), 1, 100)
    ON CONFLICT (producto_id, bodega_id) DO UPDATE SET cantidad = 100
  `;

  const folioManual = `MAN-${TEST_PREFIX}-OK`;
  const folioSync = `001653-SYNC-TEST`;

  // Entrada manual (MAN-*), corregible
  await sql`
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
    VALUES (${folioManual}, (SELECT id FROM productos WHERE codigo = ${CODIGO}), 'entrada', 20, 1, 1)
  `;
  const rm = await sql`SELECT id FROM movimientos WHERE folio = ${folioManual}`;
  movManualId = (rm as unknown as { id: number }[])[0]!.id;

  // Entrada de sync (folio numérico), NO corregible
  await sql`
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
    VALUES (${folioSync}, (SELECT id FROM productos WHERE codigo = ${CODIGO}), 'entrada', 15, 1, 1)
  `;
  const rs = await sql`SELECT id FROM movimientos WHERE folio = ${folioSync}`;
  movSyncId = (rs as unknown as { id: number }[])[0]!.id;
});

afterAll(async () => {
  await sql`DELETE FROM movimientos WHERE folio LIKE ${'AJT-' + TEST_PREFIX + '%'} OR folio LIKE ${'MAN-' + TEST_PREFIX + '%'} OR folio = '001653-SYNC-TEST'`;
  await sql`DELETE FROM stock WHERE producto_id = (SELECT id FROM productos WHERE codigo = ${CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${CODIGO}`;
});

// ── T4c: calcularCorreccionEntrada (función pura) ─────────────────────

describe("calcularCorreccionEntrada", () => {
  it("devuelve delta positivo = original - real (corrección hacia abajo)", () => {
    expect(calcularCorreccionEntrada(20, 18)).toBe(2);
  });

  it("devuelve delta negativo = original - real (corrección hacia arriba, nuevo)", () => {
    expect(calcularCorreccionEntrada(1, 4)).toBe(-3);
    expect(calcularCorreccionEntrada(20, 25)).toBe(-5);
  });

  it("lanza error solo si real === original (sin diferencia)", () => {
    expect(() => calcularCorreccionEntrada(20, 20)).toThrow();
  });
});

// ── T3: Smoke — ajuste de entrada manual exitoso ─────────────────────

describe("crearAjuste — entrada manual", () => {
  it("T3 smoke: stock reducido y ajuste negativo insertado", async () => {
    const key = `${TEST_PREFIX}-SMOKE`;
    const r = await crearAjuste({
      movimientoOriginalId: movManualId,
      cantidadReal: 18, // original era 20 → delta=2
      idempotencyKey: key,
    });

    expect(r.ok).toBe(true);

    // Verificar movimiento de ajuste
    const folioAjuste = `AJT-${key}`;
    const rows = await sql`
      SELECT cantidad, tipo FROM movimientos WHERE folio = ${folioAjuste}
    `;
    const m = (rows as unknown as { cantidad: number; tipo: string }[])[0];
    expect(m.tipo).toBe("ajuste");
    expect(m.cantidad).toBe(-2);
  });
});

// ── T1: Idempotencia ─────────────────────────────────────────────────

describe("crearAjuste — idempotencia", () => {
  it("T1: mismo key dos veces → segunda no duplica", async () => {
    const key = `${TEST_PREFIX}-IDEM`;
    const r1 = await crearAjuste({
      movimientoOriginalId: movManualId,
      cantidadReal: 17,
      idempotencyKey: key,
    });
    expect(r1.ok).toBe(true);

    const r2 = await crearAjuste({
      movimientoOriginalId: movManualId,
      cantidadReal: 17,
      idempotencyKey: key,
    });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("idempotente");
  });
});

// ── T2: Race condition (simulada vía idempotencia) ───────────────────

describe("crearAjuste — race condition", () => {
  it("T2: dos keys distintas que apuntan al mismo original → stock no se descuenta doble", async () => {
    // Insertar otra entrada manual fresca
    const folioRace = `MAN-${TEST_PREFIX}-RACE`;
    await sql`
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
      VALUES (${folioRace}, (SELECT id FROM productos WHERE codigo = ${CODIGO}), 'entrada', 10, 1, 1)
    `;
    const rr = await sql`SELECT id FROM movimientos WHERE folio = ${folioRace}`;
    const raceId = (rr as unknown as { id: number }[])[0]!.id;

    // Primera corrección: 10→8 (delta=2)
    const r1 = await crearAjuste({
      movimientoOriginalId: raceId,
      cantidadReal: 8,
      idempotencyKey: `${TEST_PREFIX}-RACE-1`,
    });
    expect(r1.ok).toBe(true);

    // Segunda corrección: 10→6 — pero ya se corrigió a 8, delta desde la
    // original sería 4, pero el stock real ya es 2 menos. crearAjuste debe
    // usar la cantidad neta (8), no la original (10). Delta = 8-6 = 2.
    const r2 = await crearAjuste({
      movimientoOriginalId: raceId,
      cantidadReal: 6,
      idempotencyKey: `${TEST_PREFIX}-RACE-2`,
    });
    expect(r2.ok).toBe(true);

    // Verificar que el segundo ajuste fue delta=2, no delta=4
    const rows = await sql`
      SELECT cantidad FROM movimientos WHERE id = ${r2.movimientoId}
    `;
    const m = (rows as unknown as { cantidad: number }[])[0];
    expect(m.cantidad).toBe(-2);
  });
});

// ── T4a/T4b: Validaciones ────────────────────────────────────────────

describe("crearAjuste — validaciones entrada", () => {
  it("T4a: rechaza entrada de sync (folio sin MAN-) vía return, no throw", async () => {
    const r = await crearAjuste({
      movimientoOriginalId: movSyncId,
      cantidadReal: 10,
      idempotencyKey: `${TEST_PREFIX}-SYNC-REJ`,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("error");
    if (r.reason === "error") expect(r.mensaje).toMatch(/manual|MAN/i);
  });

  it("T4b: rechaza cantidadReal === neta actual (sin diferencia) vía return, no throw", async () => {
    // Entrada fresca para aislar el caso delta=0 (movManualId ya fue ajustado por T3/T1)
    const folio = `MAN-${TEST_PREFIX}-D0`;
    await sql`
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
      VALUES (${folio}, (SELECT id FROM productos WHERE codigo = ${CODIGO}), 'entrada', 10, 1, 1)
    `;
    const rw = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
    const id = (rw as unknown as { id: number }[])[0]!.id;

    const r = await crearAjuste({
      movimientoOriginalId: id,
      cantidadReal: 10, // igual a la neta actual → delta 0
      idempotencyKey: `${TEST_PREFIX}-D0-KEY`,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("error");
    if (r.reason === "error") expect(r.mensaje).toMatch(/diferencia|coincide/i);
  });
});

// ── T-UP: corrección hacia arriba (decisión de producto: ahora permitida) ──

describe("crearAjuste — corrección hacia arriba (nuevo)", () => {
  it("T-UP1: entrada 1→4 exitosa, movimiento +3 y stock real +3 en bodega", async () => {
    const folio = `MAN-${TEST_PREFIX}-UP`;
    await sql`
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
      VALUES (${folio}, (SELECT id FROM productos WHERE codigo = ${CODIGO}), 'entrada', 1, 1, 1)
    `;
    const rw = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
    const id = (rw as unknown as { id: number }[])[0]!.id;

    const stockAntes = (
      (await sql`
        SELECT cantidad FROM stock
        WHERE producto_id = (SELECT id FROM productos WHERE codigo = ${CODIGO})
          AND bodega_id = 1
      `) as unknown as { cantidad: number }[]
    )[0]!.cantidad;

    const r = await crearAjuste({
      movimientoOriginalId: id,
      cantidadReal: 4, // llegó 4, se registró 1 → corregir hacia arriba
      idempotencyKey: `${TEST_PREFIX}-UP-KEY`,
    });
    expect(r.ok).toBe(true);

    const rows = await sql`
      SELECT cantidad, tipo FROM movimientos WHERE id = ${r.movimientoId}
    `;
    const m = (rows as unknown as { cantidad: number; tipo: string }[])[0];
    expect(m.tipo).toBe("ajuste");
    expect(m.cantidad).toBe(3);

    const stockDespues = (
      (await sql`
        SELECT cantidad FROM stock
        WHERE producto_id = (SELECT id FROM productos WHERE codigo = ${CODIGO})
          AND bodega_id = 1
      `) as unknown as { cantidad: number }[]
    )[0]!.cantidad;
    expect(stockDespues).toBe(stockAntes + 3);
  });

  it("T-UP2: idempotencia se mantiene en dirección ascendente", async () => {
    const folio = `MAN-${TEST_PREFIX}-UPIDEM`;
    await sql`
      INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, usuario_id)
      VALUES (${folio}, (SELECT id FROM productos WHERE codigo = ${CODIGO}), 'entrada', 2, 1, 1)
    `;
    const rw = await sql`SELECT id FROM movimientos WHERE folio = ${folio}`;
    const id = (rw as unknown as { id: number }[])[0]!.id;

    const key = `${TEST_PREFIX}-UPIDEM-KEY`;
    const r1 = await crearAjuste({ movimientoOriginalId: id, cantidadReal: 5, idempotencyKey: key });
    expect(r1.ok).toBe(true);

    const r2 = await crearAjuste({ movimientoOriginalId: id, cantidadReal: 5, idempotencyKey: key });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("idempotente");
  });
});

// ── T-AUTH: auth() retorna null ──────────────────────────────────────
describe("crearAjuste — auth", () => {
  it("lanza 'No autenticado' si auth() retorna null", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(
      crearAjuste({
        movimientoOriginalId: 999999,
        cantidadReal: 1,
        idempotencyKey: `AUTH-TEST-${Date.now()}`,
      })
    ).rejects.toThrow(/autenticad|auth/i);
  });
});
