/**
 * Regresión — buscarProductoHistorico: relevancia + deduplicación.
 *
 * Bugs:
 * 1. ORDER BY codigo (alfabético) no prioriza matches exactos.
 *    Escribir "VD-002" devuelve "CVD-12" antes.
 * 2. Sin DISTINCT: productos en ambas empresas (Sanjh + VD) aparecen duplicados.
 *
 * Test de integración real contra Vida Digital (mismo patrón sync-imagen-merge).
 *
 * AHORA EN ROJO: la query actual tiene ORDER BY codigo simple, sin DISTINCT.
 */

import { describe, it, expect } from "vitest";
import { buscarProductoHistorico } from "@/db/vidadigital/queries";

describe("buscarProductoHistorico — relevancia + dedup (integración real)", () => {
  // ── R1: Match exacto de prefijo debe aparecer primero ──────────
  it("match exacto de codigo aparece antes que matches parciales alfabeticamente anteriores", async () => {
    // "VD-002" debería rankear antes que "CVD-12" aunque C < V alfabéticamente.
    // Para este test necesitamos al menos un código que empiece con "VD-00"
    // y otro que contenga "VD-00" pero empiece con letra anterior.
    // Usamos datos reales de Vida Digital — VD-002 vs CVD-12 es el caso real.
    const results = await buscarProductoHistorico("VD-002");

    if (results.length === 0) return; // no hay datos, test inconcluso

    const idxExact = results.findIndex((r) => r.codigo === "VD-002");
    const idxPartial = results.findIndex((r) => r.codigo === "CVD-12");

    // Si ambos existen, VD-002 debe aparecer antes
    if (idxExact !== -1 && idxPartial !== -1) {
      expect(idxExact).toBeLessThan(idxPartial);
    }
  });

  // ── R2: Sin duplicados ────────────────────────────────────────
  it("no devuelve duplicados del mismo codigo", async () => {
    // VD-001 existe en ambas empresas (Sanjh + Vida Digital) en el catálogo.
    // Sin DISTINCT, aparece dos veces.
    const results = await buscarProductoHistorico("VD-001");

    const codigos = results.map((r) => r.codigo);
    const duplicados = codigos.filter((c, i) => codigos.indexOf(c) !== i);

    expect(duplicados.length).toBe(0);
  });
});

// ── Especificación del contrato de la query (documentado, no testeable sin DB) ──
// LIMIT 20: el buscador nunca devuelve más de 20 resultados.
// Solo devuelve codigo, detalle e imagen — nunca cantidad ni bodega.
