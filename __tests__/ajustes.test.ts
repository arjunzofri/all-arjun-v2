/**
 * Fase B — Sub-slice 3b: getMovimientosContribuyentes()
 *
 * Riesgos:
 *  R1. Salida sin ajustes → aparece con cantidadNeta = cantidadOriginal
 *  R2. Salida con ajuste parcial → aparece con cantidadNeta corregida
 *  R3. Salida con ajustes que la llevan a 0 → NO aparece
 *  R4. Retorno sin ajustes → aparece con cantidadNeta correcta (usa
 *      resolverOrigenDestino, no asume dirección de salida)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";

// ── Import de la función que NO existe todavía (Fase B) ──────────────
import { getMovimientosContribuyentes } from "@/lib/actions/ajustes";
import type { Ubicacion } from "@/lib/utils/movimiento-ubicacion";

const sql = neon(process.env.DATABASE_URL!);

const TEST_PREFIX = `TEST-AJT-${Date.now()}`;
const CODIGO = `${TEST_PREFIX}-001`;
const CODIGO_RET = `${TEST_PREFIX}-RET`;

let productoId: number;
let productoIdRet: number;

const BODEGA_1: Ubicacion = { tipo: "bodega", id: 1 };
const MODULO_180: Ubicacion = { tipo: "modulo", id: 1 };

beforeAll(async () => {
  // Seed ubicaciones
  await sql`INSERT INTO bodegas (nombre) VALUES ('Bodega 1 Vida Digital') ON CONFLICT (nombre) DO NOTHING`;
  await sql`INSERT INTO modulos (nombre) VALUES ('Módulo 180') ON CONFLICT (nombre) DO NOTHING`;

  // Producto para tests de salida
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${CODIGO}, 'Test ajuste salida') ON CONFLICT (codigo) DO NOTHING`;
  const p = await sql`SELECT id FROM productos WHERE codigo = ${CODIGO}`;
  productoId = (p as unknown as { id: number }[])[0]!.id;

  // Producto para tests de retorno
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${CODIGO_RET}, 'Test ajuste retorno') ON CONFLICT (codigo) DO NOTHING`;
  const pr = await sql`SELECT id FROM productos WHERE codigo = ${CODIGO_RET}`;
  productoIdRet = (pr as unknown as { id: number }[])[0]!.id;

  // Stock para bodega 1 (origen de salidas)
  await sql`INSERT INTO stock (producto_id, bodega_id, cantidad)
    VALUES (${productoId}, 1, 100) ON CONFLICT (producto_id, bodega_id) DO UPDATE SET cantidad = 100`;
  await sql`INSERT INTO stock (producto_id, bodega_id, cantidad)
    VALUES (${productoIdRet}, 1, 100) ON CONFLICT (producto_id, bodega_id) DO UPDATE SET cantidad = 100`;
});

afterAll(async () => {
  await sql`DELETE FROM movimientos WHERE folio LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM stock WHERE producto_id IN (${productoId}, ${productoIdRet})`;
  await sql`DELETE FROM productos WHERE codigo IN (${CODIGO}, ${CODIGO_RET})`;
});

// ── Helpers ───────────────────────────────────────────────────────────────

/** Inserta un movimiento vía SQL crudo y devuelve su id */
async function insertMovimiento(params: {
  folio: string;
  productoId: number;
  tipo: "salida" | "retorno" | "ajuste";
  cantidad: number;
  bodegaOrigenId?: number | null;
  moduloDestinoId?: number | null;
  movimientoOriginalId?: number | null;
}) {
  const r = await sql`
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, modulo_destino_id, movimiento_original_id, usuario_id)
    VALUES (${params.folio}, ${params.productoId}, ${params.tipo}, ${params.cantidad},
            ${params.bodegaOrigenId ?? null}, ${params.moduloDestinoId ?? null},
            ${params.movimientoOriginalId ?? null}, 1)
    RETURNING id
  `;
  return (r as unknown as { id: number }[])[0]!.id;
}

// ── R1: Salida sin ajustes → aparece con cantidadNeta = cantidadOriginal ──

describe("getMovimientosContribuyentes — salida sin ajustes", () => {
  it("aparece con cantidadNeta igual a la original", async () => {
    const folio = `${TEST_PREFIX}-R1`;
    const movId = await insertMovimiento({
      folio,
      productoId,
      tipo: "salida",
      cantidad: 20,
      bodegaOrigenId: 1,
      moduloDestinoId: 1, // Módulo 180
    });

    const result = await getMovimientosContribuyentes(productoId, MODULO_180);

    const encontrado = result.find(r => r.movimientoId === movId);
    expect(encontrado).toBeDefined();
    expect(encontrado!.cantidadOriginal).toBe(20);
    expect(encontrado!.cantidadNeta).toBe(20);
  });
});

// ── R2: Salida con ajuste parcial → cantidadNeta corregida ────────────────

describe("getMovimientosContribuyentes — salida con ajuste parcial", () => {
  it("aparece con cantidadNeta ajustada (no llevada a 0)", async () => {
    const folioOrig = `${TEST_PREFIX}-R2-ORIG`;
    const movId = await insertMovimiento({
      folio: folioOrig,
      productoId,
      tipo: "salida",
      cantidad: 20,
      bodegaOrigenId: 1,
      moduloDestinoId: 1,
    });

    // Ajuste: llegó menos, se devuelve diferencia al origen (cantidad=-2)
    await insertMovimiento({
      folio: `${TEST_PREFIX}-R2-AJT`,
      productoId,
      tipo: "ajuste",
      cantidad: -2,
      bodegaOrigenId: 1,
      moduloDestinoId: 1,
      movimientoOriginalId: movId,
    });

    const result = await getMovimientosContribuyentes(productoId, MODULO_180);

    const encontrado = result.find(r => r.movimientoId === movId);
    expect(encontrado).toBeDefined();
    expect(encontrado!.cantidadOriginal).toBe(20);
    expect(encontrado!.cantidadNeta).toBe(18);
  });
});

// ── R3: Salida con ajustes que la llevan a 0 → NO aparece ────────────────

describe("getMovimientosContribuyentes — salida llevada a 0", () => {
  it("NO aparece en la lista cuando cantidadNeta === 0", async () => {
    const folioOrig = `${TEST_PREFIX}-R3-ORIG`;
    const movId = await insertMovimiento({
      folio: folioOrig,
      productoId,
      tipo: "salida",
      cantidad: 15,
      bodegaOrigenId: 1,
      moduloDestinoId: 1,
    });

    // Ajuste que revierte todo: -15
    await insertMovimiento({
      folio: `${TEST_PREFIX}-R3-AJT`,
      productoId,
      tipo: "ajuste",
      cantidad: -15,
      bodegaOrigenId: 1,
      moduloDestinoId: 1,
      movimientoOriginalId: movId,
    });

    const result = await getMovimientosContribuyentes(productoId, MODULO_180);

    const encontrado = result.find(r => r.movimientoId === movId);
    expect(encontrado).toBeUndefined();
  });
});

// ── R4: Retorno sin ajustes → aparece con cantidadNeta correcta ──────────

describe("getMovimientosContribuyentes — retorno sin ajustes", () => {
  it("aparece con cantidadNeta correcta (usa destino resuelto, no asume salida)", async () => {
    const folio = `${TEST_PREFIX}-R4`;
    const movId = await insertMovimiento({
      folio,
      productoId: productoIdRet,
      tipo: "retorno",
      cantidad: 10,
      bodegaOrigenId: 1, // en retorno, esta columna guarda el DESTINO real
      moduloDestinoId: 1, // en retorno, esta columna guarda el ORIGEN real
    });

    // Perspectiva de la bodega (destino del retorno según resolverOrigenDestino)
    const result = await getMovimientosContribuyentes(productoIdRet, BODEGA_1);

    const encontrado = result.find(r => r.movimientoId === movId);
    expect(encontrado).toBeDefined();
    expect(encontrado!.cantidadOriginal).toBe(10);
    expect(encontrado!.cantidadNeta).toBe(10);
  });
});
