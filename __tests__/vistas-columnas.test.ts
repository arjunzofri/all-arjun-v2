/**
 * Bug P-20261110-2158-10 / P-20261110-2207-3 — columnas Entro/Salida/Ajustes/Saldo.
 *
 * Invariante: Entro - Salida + Ajustes = Saldo.
 *  - En bodega, un retorno (módulo → bodega) es una ENTRADA.
 *  - Los ajustes se muestran con su efecto real sobre la ubicación, no con la
 *    cantidad cruda (dos puntas en bodega → signo invertido; entrada 1 punta → directo).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { neon } from "@neondatabase/serverless";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { getStockPorUbicacion, getMovimientosPorProductoUbicacion } from "@/lib/actions/vistas";

const sql = neon(process.env.DATABASE_URL!);
const P = `TEST-COLS-${Date.now()}`;
const COD_BODEGA = `${P}-BOD`;
const COD_MODULO = `${P}-MOD`;
const COD_ENTRADA = `${P}-ENT`;
let userId: number;

let bodegaId: number;
let moduloId: number;
let prodBodega: number;
let prodModulo: number;
let prodEntrada: number;

async function insertMov(params: {
  folio: string;
  productoId: number;
  tipo: "entrada" | "salida" | "retorno" | "ajuste";
  cantidad: number;
  bodegaOrigenId: number | null;
  moduloDestinoId: number | null;
}) {
  await sql`
    INSERT INTO movimientos (folio, producto_id, tipo, cantidad, bodega_origen_id, modulo_destino_id, usuario_id)
    VALUES (${params.folio}, ${params.productoId}, ${params.tipo}, ${params.cantidad},
            ${params.bodegaOrigenId}, ${params.moduloDestinoId}, ${userId})
  `;
}

beforeAll(async () => {
  // El detalle hace INNER JOIN users: el movimiento necesita un usuario real.
  await sql`INSERT INTO users (username, role) VALUES (${P + "-user"}, 'operador') ON CONFLICT (username) DO NOTHING`;
  userId = ((await sql`SELECT id FROM users WHERE username = ${P + "-user"}`) as unknown as { id: number }[])[0]!.id;
  await sql`INSERT INTO bodegas (nombre) VALUES (${P + "-BODEGA"}) ON CONFLICT (nombre) DO NOTHING`;
  await sql`INSERT INTO modulos (nombre) VALUES (${P + "-MODULO"}) ON CONFLICT (nombre) DO NOTHING`;
  bodegaId = ((await sql`SELECT id FROM bodegas WHERE nombre = ${P + "-BODEGA"}`) as unknown as { id: number }[])[0]!.id;
  moduloId = ((await sql`SELECT id FROM modulos WHERE nombre = ${P + "-MODULO"}`) as unknown as { id: number }[])[0]!.id;

  await sql`INSERT INTO productos (codigo, detalle) VALUES (${COD_BODEGA}, 'Columnas bodega') ON CONFLICT (codigo) DO NOTHING`;
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${COD_MODULO}, 'Columnas modulo') ON CONFLICT (codigo) DO NOTHING`;
  await sql`INSERT INTO productos (codigo, detalle) VALUES (${COD_ENTRADA}, 'Columnas entrada ajustada') ON CONFLICT (codigo) DO NOTHING`;
  prodBodega = ((await sql`SELECT id FROM productos WHERE codigo = ${COD_BODEGA}`) as unknown as { id: number }[])[0]!.id;
  prodModulo = ((await sql`SELECT id FROM productos WHERE codigo = ${COD_MODULO}`) as unknown as { id: number }[])[0]!.id;
  prodEntrada = ((await sql`SELECT id FROM productos WHERE codigo = ${COD_ENTRADA}`) as unknown as { id: number }[])[0]!.id;

  // ── Bodega: entrada 10, salida 4, retorno 2, ajuste 2 puntas +1 (efecto -1) ──
  await insertMov({ folio: `${P}-B1`, productoId: prodBodega, tipo: "entrada", cantidad: 10, bodegaOrigenId: bodegaId, moduloDestinoId: null });
  await insertMov({ folio: `${P}-B2`, productoId: prodBodega, tipo: "salida", cantidad: 4, bodegaOrigenId: bodegaId, moduloDestinoId: moduloId });
  await insertMov({ folio: `${P}-B3`, productoId: prodBodega, tipo: "retorno", cantidad: 2, bodegaOrigenId: bodegaId, moduloDestinoId: moduloId });
  await insertMov({ folio: `${P}-B4`, productoId: prodBodega, tipo: "ajuste", cantidad: 1, bodegaOrigenId: bodegaId, moduloDestinoId: moduloId });
  await sql`INSERT INTO stock (producto_id, bodega_id, cantidad) VALUES (${prodBodega}, ${bodegaId}, 7)`;

  // ── Módulo: salida 4 (entra), retorno 2 (sale), ajuste 2 puntas +1 ──
  await insertMov({ folio: `${P}-M1`, productoId: prodModulo, tipo: "salida", cantidad: 4, bodegaOrigenId: bodegaId, moduloDestinoId: moduloId });
  await insertMov({ folio: `${P}-M2`, productoId: prodModulo, tipo: "retorno", cantidad: 2, bodegaOrigenId: bodegaId, moduloDestinoId: moduloId });
  await insertMov({ folio: `${P}-M3`, productoId: prodModulo, tipo: "ajuste", cantidad: 1, bodegaOrigenId: bodegaId, moduloDestinoId: moduloId });
  await sql`INSERT INTO stock (producto_id, modulo_id, cantidad) VALUES (${prodModulo}, ${moduloId}, 3)`;

  // ── Ajuste de 1 punta sobre entrada manual: cantidad -2 → efecto -2 en bodega ──
  await insertMov({ folio: `${P}-E1`, productoId: prodEntrada, tipo: "entrada", cantidad: 10, bodegaOrigenId: bodegaId, moduloDestinoId: null });
  await insertMov({ folio: `${P}-E2`, productoId: prodEntrada, tipo: "ajuste", cantidad: -2, bodegaOrigenId: bodegaId, moduloDestinoId: null });
  await sql`INSERT INTO stock (producto_id, bodega_id, cantidad) VALUES (${prodEntrada}, ${bodegaId}, 8)`;
});

afterAll(async () => {
  const ids = [prodBodega, prodModulo, prodEntrada];
  await sql`DELETE FROM movimientos WHERE producto_id IN (${ids[0]}, ${ids[1]}, ${ids[2]})`;
  await sql`DELETE FROM stock WHERE producto_id IN (${ids[0]}, ${ids[1]}, ${ids[2]})`;
  await sql`DELETE FROM productos WHERE id IN (${ids[0]}, ${ids[1]}, ${ids[2]})`;
  await sql`DELETE FROM bodegas WHERE id = ${bodegaId}`;
  await sql`DELETE FROM modulos WHERE id = ${moduloId}`;
  await sql`DELETE FROM users WHERE id = ${userId}`;
});

describe("getStockPorUbicacion — columnas", () => {
  it("bodega: retorno cuenta como entrada y el ajuste con su signo", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: bodegaId, limit: 100 });
    const item = page.items.find(i => i.id === prodBodega)!;
    expect(item).toBeDefined();
    expect(item.totalEntradas).toBe(12);
    expect(item.totalSalidas).toBe(4);
    expect(item.totalAjustes).toBe(-1);
    expect(item.cantidad).toBe(7);
    expect(item.totalEntradas - item.totalSalidas + item.totalAjustes).toBe(item.cantidad);
  });

  it("módulo: salida entra, retorno sale, ajuste positivo suma", async () => {
    const page = await getStockPorUbicacion({ tipo: "modulo", ubicacionId: moduloId, limit: 100 });
    const item = page.items.find(i => i.id === prodModulo)!;
    expect(item).toBeDefined();
    expect(item.totalEntradas).toBe(4);
    expect(item.totalSalidas).toBe(2);
    expect(item.totalAjustes).toBe(1);
    expect(item.cantidad).toBe(3);
    expect(item.totalEntradas - item.totalSalidas + item.totalAjustes).toBe(item.cantidad);
  });

  it("bodega: ajuste de 1 punta (entrada manual) no invierte el signo", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: bodegaId, limit: 100 });
    const item = page.items.find(i => i.id === prodEntrada)!;
    expect(item.totalEntradas).toBe(10);
    expect(item.totalSalidas).toBe(0);
    expect(item.totalAjustes).toBe(-2);
    expect(item.cantidad).toBe(8);
  });
});

describe("getMovimientosPorProductoUbicacion — detalle", () => {
  it("bodega: retorno aparece en entradas y el ajuste con signo en ajustes", async () => {
    const det = await getMovimientosPorProductoUbicacion({ productoId: prodBodega, tipo: "bodega", ubicacionId: bodegaId });
    expect(det.entradas.map(e => e.cantidad).sort((a, b) => a - b)).toEqual([2, 10]);
    expect(det.salidas.map(s => s.cantidad)).toEqual([4]);
    expect(det.ajustes.map(a => a.cantidad)).toEqual([-1]);
  });

  it("módulo: salida en entradas, retorno en salidas, ajuste positivo", async () => {
    const det = await getMovimientosPorProductoUbicacion({ productoId: prodModulo, tipo: "modulo", ubicacionId: moduloId });
    expect(det.entradas.map(e => e.cantidad)).toEqual([4]);
    expect(det.salidas.map(s => s.cantidad)).toEqual([2]);
    expect(det.ajustes.map(a => a.cantidad)).toEqual([1]);
  });
});
