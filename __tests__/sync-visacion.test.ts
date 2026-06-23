/**
 * Fase B+C — nro_ingreso + fecha_compra en el INSERT real de syncComprasAnil
 *
 * Riesgos:
 *  R1. nro_ingreso se persiste como string completo vía el INSERT de la CTE real
 *  R2. fecha_compra se guarda como fecha válida (el ::date funciona)
 *  R3. nroIngreso=null y fechanvt=null → columnas NULL (no "null" literal)
 *
 * Usa insertarMovimientoSync() — la misma función que syncComprasAnil.
 * Sin copia duplicada de la CTE en el test.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { insertarMovimientoSync } from "@/lib/sync/compras-anil";

const sql = neon(process.env.DATABASE_URL!);

const TEST_PREFIX = "TEST-VIS";
const CODIGO = `${TEST_PREFIX}-${Date.now()}`;

beforeAll(async () => {
  await sql`INSERT INTO bodegas (id, nombre) VALUES (1, 'Bodega 1 Vida Digital') ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${CODIGO}, 'Test visacion') ON CONFLICT (codigo) DO NOTHING`;
  await sql`
    INSERT INTO stock (producto_id, bodega_id, cantidad)
    VALUES ((SELECT id FROM productos WHERE codigo = ${CODIGO}), 1, 100)
    ON CONFLICT (producto_id, bodega_id) DO UPDATE SET cantidad = 100
  `;
});

afterAll(async () => {
  await sql`DELETE FROM movimientos WHERE folio LIKE ${'TEST-VIS-%'}`;
  await sql`DELETE FROM stock WHERE producto_id = (SELECT id FROM productos WHERE codigo = ${CODIGO})`;
  await sql`DELETE FROM productos WHERE codigo = ${CODIGO}`;
});

describe("insertarMovimientoSync — nro_ingreso + fecha_compra", () => {
  it("R1: guarda nro_ingreso completo y fecha_compra como fecha válida", async () => {
    const folio = `${TEST_PREFIX}-R1`;
    const nro = "101-26-031807-013-GLP";

    await insertarMovimientoSync(sql, {
      folio,
      codigo: CODIGO,
      cantidad: 5,
      bodegaId: 1,
      nroIngreso: nro,
      fechanvt: "2026-05-19",
    });

    const rows = await sql`
      SELECT nro_ingreso, fecha_compra FROM movimientos WHERE folio = ${folio}
    `;
    const r = (rows as unknown as { nro_ingreso: string | null; fecha_compra: string | null }[])[0];

    expect(r).toBeDefined();
    expect(r.nro_ingreso).toBe("101-26-031807-013-GLP");

    expect(r.fecha_compra).toBeTruthy();
    const d = new Date(r.fecha_compra!);
    expect(Number.isNaN(d.getTime())).toBe(false);
    const iso = new Date(r.fecha_compra!).toISOString().split("T")[0];
    expect(iso).toBe("2026-05-19");
  });

  it("R2: nroIngreso=null y fechanvt=null → NULL limpio, sin error", async () => {
    const folio = `${TEST_PREFIX}-R2`;

    await insertarMovimientoSync(sql, {
      folio,
      codigo: CODIGO,
      cantidad: 3,
      bodegaId: 1,
      nroIngreso: null,
      fechanvt: null,
    });

    const rows = await sql`
      SELECT nro_ingreso, fecha_compra FROM movimientos WHERE folio = ${folio}
    `;
    const r = (rows as unknown as { nro_ingreso: string | null; fecha_compra: string | null }[])[0];

    expect(r).toBeDefined();
    expect(r.nro_ingreso).toBeNull();
    expect(r.fecha_compra).toBeNull();
  });
});
