/**
 * Fase B — Slice 08: Tests que intentan romper retornos (módulo → bodega).
 * Riesgos: R1 stock insuficiente en módulo, R2 doble submit duplica,
 * R3 CTE atómica, R4 módulo inválido.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { neon } from "@neondatabase/serverless";

// Import real — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { crearRetorno } from "@/lib/actions/retornos";

let sql: ReturnType<typeof neon>;
const TEST_CODIGO = "TEST-RET-001";

beforeAll(async () => {
  sql = neon(process.env.DATABASE_URL!);
  // Seed bodegas y módulos
  for (const nombre of ["Bodega 1 Vida Digital", "Bodega 2 Vida Digital", "Bodega Arjun"]) {
    await sql`INSERT INTO bodegas (nombre) VALUES (${nombre}) ON CONFLICT (nombre) DO NOTHING`;
  }
  for (const nombre of ["Módulo 180", "Módulo 182", "Módulo 183", "Módulo 184", "Módulo 193"]) {
    await sql`INSERT INTO modulos (nombre) VALUES (${nombre}) ON CONFLICT (nombre) DO NOTHING`;
  }
  // Limpiar tests anteriores
  await sql`DELETE FROM movimientos WHERE folio LIKE 'RET-%'`;
  await sql`DELETE FROM stock WHERE producto_id IN (SELECT id FROM productos WHERE codigo = ${TEST_CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${TEST_CODIGO}`;

  // Crear producto con stock en módulo 1
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${TEST_CODIGO}, 'Test retorno') ON CONFLICT (codigo) DO NOTHING`;
  const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
  const pId = (pid as unknown as { id: number }[])[0].id;
  await sql`
    INSERT INTO stock (producto_id, modulo_id, cantidad)
    VALUES (${pId}, 1, 10)
    ON CONFLICT (producto_id, modulo_id)
    DO UPDATE SET cantidad = 10
  `;
});

// ── R1: Stock insuficiente en módulo ───────────────────────────────────
describe("crearRetorno() — stock insuficiente", () => {
  it("rechaza si cantidad > stock en módulo", async () => {
    await expect(
      crearRetorno({
        codigo: TEST_CODIGO,
        cantidad: 999,
        moduloOrigenId: 1,
        bodegaDestinoId: 1,
        idempotencyKey: "test-r1-mod-stock",
        usuarioId: 1,
      })
    ).rejects.toThrow(/stock|insuficiente|disponible/i);
  });

  it("rechaza cantidad 0", async () => {
    await expect(
      crearRetorno({
        codigo: TEST_CODIGO,
        cantidad: 0,
        moduloOrigenId: 1,
        bodegaDestinoId: 1,
        idempotencyKey: "test-r1-zero",
        usuarioId: 1,
      })
    ).rejects.toThrow(/cantidad/i);
  });
});

// ── R4: Módulo origen inválido ─────────────────────────────────────────
describe("crearRetorno() — módulo inválido", () => {
  it("rechaza módulo que no existe", async () => {
    await expect(
      crearRetorno({
        codigo: TEST_CODIGO,
        cantidad: 1,
        moduloOrigenId: 9999,
        bodegaDestinoId: 1,
        idempotencyKey: "test-r4-mod",
        usuarioId: 1,
      })
    ).rejects.toThrow(/módulo|modulo/i);
  });
});

// ── R2 + R3: Idempotencia + atomicidad ─────────────────────────────────
describe("crearRetorno() — idempotencia y atomicidad", () => {
  const key = `RET-TEST-${Date.now()}`;

  it("ejecuta retorno correctamente: descuenta módulo, suma bodega", async () => {
    const result = await crearRetorno({
      codigo: TEST_CODIGO,
      cantidad: 3,
      moduloOrigenId: 1,
      bodegaDestinoId: 1,
      idempotencyKey: key,
      usuarioId: 1,
    });

    expect(result).toHaveProperty("movimientoId");

    // Stock módulo: 10 - 3 = 7
    const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
    const pId = (pid as unknown as { id: number }[])[0].id;
    const sm = await sql`SELECT cantidad FROM stock WHERE producto_id = ${pId} AND modulo_id = 1`;
    expect((sm as unknown as { cantidad: number }[])[0].cantidad).toBe(7);

    // Stock bodega: 0 + 3 = 3
    const sb = await sql`SELECT cantidad FROM stock WHERE producto_id = ${pId} AND bodega_id = 1`;
    expect((sb as unknown as { cantidad: number }[])[0].cantidad).toBe(3);
  });

  it("no duplica con mismo idempotencyKey", async () => {
    await crearRetorno({
      codigo: TEST_CODIGO,
      cantidad: 3,
      moduloOrigenId: 1,
      bodegaDestinoId: 1,
      idempotencyKey: key,
      usuarioId: 1,
    });

    // Stock módulo: sigue 7 (no 4)
    const pid = await sql`SELECT id FROM productos WHERE codigo = ${TEST_CODIGO}`;
    const pId = (pid as unknown as { id: number }[])[0].id;
    const sm = await sql`SELECT cantidad FROM stock WHERE producto_id = ${pId} AND modulo_id = 1`;
    expect((sm as unknown as { cantidad: number }[])[0].cantidad).toBe(7);

    // Solo un movimiento
    const movs = await sql`SELECT COUNT(*)::int AS n FROM movimientos WHERE folio = ${`RET-${key}`}`;
    expect((movs as unknown as { n: number }[])[0].n).toBe(1);
  });
});
