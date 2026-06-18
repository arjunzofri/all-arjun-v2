/**
 * Fase B — Slice 01 / R3: Tests que intentan romper el schema Drizzle.
 *
 * Riesgo: schema no sincronizado → tablas con columnas faltantes,
 *         falta de UNIQUE en producto.codigo → duplicados.
 *
 * Verifica la definición Drizzle (objetos de schema), no requiere
 * Neon real. Si el módulo no existe (Fase B), MODULE_NOT_FOUND.
 */

import { describe, it, expect } from "vitest";

// Import real — si no existe, este test rompe en Fase B.
import * as schema from "@/db/schema";

describe("schema Drizzle — intentando romperlo", () => {
  // ── Tablas core existen ───────────────────────────────────────
  it("define la tabla 'productos'", () => {
    expect(schema.productos).toBeDefined();
  });

  it("define la tabla 'bodegas'", () => {
    expect(schema.bodegas).toBeDefined();
  });

  it("define la tabla 'modulos'", () => {
    expect(schema.modulos).toBeDefined();
  });

  it("define la tabla 'stock'", () => {
    expect(schema.stock).toBeDefined();
  });

  it("define la tabla 'movimientos'", () => {
    expect(schema.movimientos).toBeDefined();
  });

  it("define la tabla 'activityLog'", () => {
    expect(schema.activityLog).toBeDefined();
  });

  // ── Tablas de NextAuth ────────────────────────────────────────
  it("define la tabla 'users' (NextAuth)", () => {
    expect(schema.users).toBeDefined();
  });

  // ── Unique constraint en productos.codigo ─────────────────────
  it("productos.codigo tiene unique constraint", () => {
    const codigoCol = schema.productos.codigo;
    expect(codigoCol).toBeDefined();
    // Drizzle marca unique con .unique() — verificable en runtime
    // via isUnique o inspección del symbol interno.
    expect(codigoCol.isUnique).toBe(true);
  });

  // ── Not null en columnas críticas ─────────────────────────────
  it("stock.cantidad es NOT NULL", () => {
    const cantidadCol = schema.stock.cantidad;
    expect(cantidadCol.notNull).toBe(true);
  });

  it("movimientos.tipo es NOT NULL", () => {
    const tipoCol = schema.movimientos.tipo;
    expect(tipoCol.notNull).toBe(true);
  });
});
