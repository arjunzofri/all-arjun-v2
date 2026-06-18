/**
 * Fase B — Slice 02: Tests que intentan romper las queries a Vida Digital.
 *
 * Riesgos: R1 duplicados, R2 fechanvt NULL, R3 código no reconocido → null,
 * R4 sin límite, R5 SQL injection.
 */

import { describe, it, expect } from "vitest";

// Imports reales — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import {
  getComprasAnilDesde,
  buscarProductoHistorico,
} from "@/db/vidadigital/queries";
import { getBodegaPorCodigoIngreso } from "@/lib/utils/get-bodega-por-codigo-ingreso";

// ── R3: Códigos de bodega ──────────────────────────────────────────────
describe("getBodegaPorCodigoIngreso()", () => {
  it("GLP → Bodega 1 Vida Digital", () => {
    expect(getBodegaPorCodigoIngreso("GLP")).toBe("Bodega 1 Vida Digital");
  });

  it("GL1 → Bodega 2 Vida Digital", () => {
    expect(getBodegaPorCodigoIngreso("GL1")).toBe("Bodega 2 Vida Digital");
  });

  it("GL2 → Bodega 1 Vida Digital (administrativo)", () => {
    expect(getBodegaPorCodigoIngreso("GL2")).toBe("Bodega 1 Vida Digital");
  });

  it("código desconocido → null (no lanza)", () => {
    expect(getBodegaPorCodigoIngreso("XYZ")).toBeNull();
    expect(getBodegaPorCodigoIngreso("")).toBeNull();
    expect(getBodegaPorCodigoIngreso("GL3")).toBeNull();
  });
});

// ── R1, R2, R5: Compras Anil ──────────────────────────────────────────
describe("getComprasAnilDesde()", () => {
  it("devuelve array (vacío o no) sin lanzar", async () => {
    const rows = await getComprasAnilDesde("2026-06-01");
    expect(Array.isArray(rows)).toBe(true);
  });

  // R1: cada row tiene identificador único (folio + item) para detectar duplicados
  it("cada resultado tiene folio + código de producto", async () => {
    const rows = await getComprasAnilDesde("2026-06-15");
    for (const r of rows) {
      expect(r).toHaveProperty("folio");
      expect(r).toHaveProperty("codigo");
      expect(r).toHaveProperty("cantidad");
      expect(r).toHaveProperty("bodega");
    }
  });

  // R2: fechanvt NULL no debería aparecer
  it("no devuelve filas con fechanvt NULL", async () => {
    const rows = await getComprasAnilDesde("2026-06-01");
    const sinFecha = rows.filter((r) => !r.fechanvt);
    expect(sinFecha.length).toBe(0);
  });
});

// ── R4, R5: Buscador histórico ────────────────────────────────────────
describe("buscarProductoHistorico()", () => {
  it("devuelve array limitado sin lanzar", async () => {
    const rows = await buscarProductoHistorico("test");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(20);
  });

  // R4: sin límite revienta — verificamos que hay LIMIT
  it("nunca devuelve más de 20 resultados", async () => {
    const rows = await buscarProductoHistorico("a"); // query amplia
    expect(rows.length).toBeLessThanOrEqual(20);
  });

  // R5: SQL injection vía query string
  it("no explota con comillas ni caracteres SQL", async () => {
    const rows = await buscarProductoHistorico("'; DROP TABLE productos; --");
    expect(Array.isArray(rows)).toBe(true);
  });

  // Solo devuelve código, detalle, imagen_url — nunca cantidad ni bodega
  it("nunca expone cantidad ni bodega", async () => {
    const rows = await buscarProductoHistorico("1161");
    for (const r of rows) {
      expect(r).toHaveProperty("codigo");
      expect(r).toHaveProperty("detalle");
      // imagen_url puede ser null — no la exigimos
      // Estas NO deben existir:
      expect(r).not.toHaveProperty("cantidad");
      expect(r).not.toHaveProperty("bodega");
      expect(r).not.toHaveProperty("saldo");
      expect(r).not.toHaveProperty("fechanvt");
    }
  });
});
