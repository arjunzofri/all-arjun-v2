/**
 * Fase B+C — movimiento_visaciones: tabla hija con nro_ingreso + cantidad
 *
 * Riesgos:
 *  R1. Una visación → 1 fila hija, nro_ingreso y cantidad correctos
 *  R2. Múltiples visaciones (2 knumezet distintos, misma compra) → 2 filas hijas
 *  R3. Null fechanvt → fecha_compra NULL limpio
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { insertarMovimientoSync } from "@/lib/sync/compras-anil";

const sql = neon(process.env.DATABASE_URL!);

const TEST_PREFIX = "TEST-VIS2";
const CODIGO = `${TEST_PREFIX}-${Date.now()}`;

beforeAll(async () => {
  await sql`INSERT INTO bodegas (id, nombre) VALUES (1, 'Bodega 1 Vida Digital') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${CODIGO}, 'Test visacion v2') ON CONFLICT (codigo) DO NOTHING`;
  await sql`
    INSERT INTO stock (producto_id, bodega_id, cantidad)
    VALUES ((SELECT id FROM productos WHERE codigo = ${CODIGO}), 1, 100)
    ON CONFLICT (producto_id, bodega_id) DO UPDATE SET cantidad = 100
  `;
});

afterAll(async () => {
  await sql`DELETE FROM movimiento_visaciones WHERE movimiento_id IN (SELECT id FROM movimientos WHERE folio LIKE ${'TEST-VIS2-%'})`;
  await sql`DELETE FROM movimientos WHERE folio LIKE ${'TEST-VIS2-%'}`;
  await sql`DELETE FROM stock WHERE producto_id = (SELECT id FROM productos WHERE codigo = ${CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${CODIGO}`;
});

describe("insertarMovimientoSync — visaciones[]", () => {
  it("R1: una visación → 1 fila hija con nro_ingreso y cantidad correctos", async () => {
    const folio = `${TEST_PREFIX}-R1`;

    await insertarMovimientoSync(sql, {
      folio,
      codigo: CODIGO,
      cantidad: 30,
      bodegaId: 1,
      visaciones: [{ nroIngreso: "101-26-031807-013-GLP", cantidad: 30 }],
      fechanvt: "2026-05-19",
    });

    // Verificar el movimiento padre
    const padres = await sql`SELECT id, cantidad, fecha_compra FROM movimientos WHERE folio = ${folio}`;
    const p = (padres as unknown as { id: number; cantidad: number; fecha_compra: string | null }[])[0];
    expect(p).toBeDefined();
    expect(p.cantidad).toBe(30);
    expect(p.fecha_compra).toBeTruthy();

    // Verificar visaciones hijas
    const hijas = await sql`
      SELECT nro_ingreso, cantidad FROM movimiento_visaciones WHERE movimiento_id = ${p.id}
    `;
    const h = hijas as unknown as { nro_ingreso: string; cantidad: number }[];
    expect(h.length).toBe(1);
    expect(h[0].nro_ingreso).toBe("101-26-031807-013-GLP");
    expect(h[0].cantidad).toBe(30);
  });

  it("R2: 2 visaciones distintas → 2 filas hijas, suma = cantidad del padre", async () => {
    const folio = `${TEST_PREFIX}-R2`;

    await insertarMovimientoSync(sql, {
      folio,
      codigo: CODIGO,
      cantidad: 66, // 30 + 36
      bodegaId: 1,
      visaciones: [
        { nroIngreso: "101-26-035365-011-GL1", cantidad: 30 },
        { nroIngreso: "101-26-035366-017-GL1", cantidad: 36 },
      ],
      fechanvt: "2026-05-25",
    });

    const padres = await sql`SELECT id, cantidad FROM movimientos WHERE folio = ${folio}`;
    const p = (padres as unknown as { id: number; cantidad: number }[])[0];

    const hijas = await sql`
      SELECT nro_ingreso, cantidad FROM movimiento_visaciones WHERE movimiento_id = ${p.id} ORDER BY nro_ingreso
    `;
    const h = hijas as unknown as { nro_ingreso: string; cantidad: number }[];
    expect(h.length).toBe(2);
    expect(h[0].nro_ingreso).toBe("101-26-035365-011-GL1");
    expect(h[0].cantidad).toBe(30);
    expect(h[1].nro_ingreso).toBe("101-26-035366-017-GL1");
    expect(h[1].cantidad).toBe(36);

    // Invariante: suma de visaciones = cantidad del padre
    const suma = h.reduce((s, v) => s + v.cantidad, 0);
    expect(suma).toBe(p.cantidad);
  });

  it("R3: fechanvt null → fecha_compra NULL, visaciones igual se guardan", async () => {
    const folio = `${TEST_PREFIX}-R3`;

    await insertarMovimientoSync(sql, {
      folio,
      codigo: CODIGO,
      cantidad: 10,
      bodegaId: 1,
      visaciones: [{ nroIngreso: "101-26-000000-001-GLP", cantidad: 10 }],
      fechanvt: null,
    });

    const padres = await sql`SELECT id, fecha_compra FROM movimientos WHERE folio = ${folio}`;
    const p = (padres as unknown as { id: number; fecha_compra: string | null }[])[0];
    expect(p.fecha_compra).toBeNull();

    const hijas = await sql`SELECT COUNT(*)::int as c FROM movimiento_visaciones WHERE movimiento_id = ${p.id}`;
    expect((hijas as unknown as { c: number }[])[0].c).toBe(1);
  });
});
