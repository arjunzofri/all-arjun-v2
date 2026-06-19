/**
 * Fase B — refQ: preservar filtro al navegar producto → detalle → volver.
 *
 * Riesgos:
 * 1. refQ presente → Volver apunta a /productos?q=valor
 * 2. refQ ausente → Volver apunta a /productos (sin query)
 * 3. refQ vacío → Volver apunta a /productos (no ?q= colgando)
 * 4. Link en listado incluye ?refQ= solo si q no es vacío
 *
 * Funciones puras exportadas:
 * - buildProductoDetailHref (desde page.tsx del listado)
 * - buildVolverHref (desde [id]/page.tsx del detalle)
 *
 * AHORA EN ROJO: las funciones no existen todavía.
 */

import { describe, it, expect } from "vitest";

// ── RED: exports no existen ──
let buildProductoDetailHref: any = null;
let buildVolverHref: any = null;
try {
  buildProductoDetailHref = (await import("@/app/(dashboard)/productos/page")).buildProductoDetailHref;
} catch { /* esperado */ }
try {
  buildVolverHref = (await import("@/app/(dashboard)/productos/[id]/page")).buildVolverHref;
} catch { /* esperado */ }

// ══════════════════════════════════════════════════════════════════════
// buildProductoDetailHref — link del listado al detalle
// ══════════════════════════════════════════════════════════════════════

describe("buildProductoDetailHref", () => {
  it("el archivo page.tsx exporta buildProductoDetailHref", () => {
    expect(buildProductoDetailHref).not.toBeNull();
    expect(typeof buildProductoDetailHref).toBe("function");
  });

  it("q vacío → /productos/123 sin refQ", () => {
    expect(buildProductoDetailHref(123, "")).toBe("/productos/123");
  });

  it("q='test' → /productos/123?refQ=test", () => {
    expect(buildProductoDetailHref(123, "test")).toBe("/productos/123?refQ=test");
  });

  it("q con espacios → refQ encodeado", () => {
    expect(buildProductoDetailHref(1, "foo bar")).toBe("/productos/1?refQ=foo%20bar");
  });
});

// ══════════════════════════════════════════════════════════════════════
// buildVolverHref — link de Volver en el detalle
// ══════════════════════════════════════════════════════════════════════

describe("buildVolverHref", () => {
  it("el archivo [id]/page.tsx exporta buildVolverHref", () => {
    expect(buildVolverHref).not.toBeNull();
    expect(typeof buildVolverHref).toBe("function");
  });

  it("refQ='test' → /productos?q=test", () => {
    expect(buildVolverHref("test")).toBe("/productos?q=test");
  });

  it("refQ undefined → /productos sin query", () => {
    expect(buildVolverHref(undefined)).toBe("/productos");
  });

  it("refQ vacío → /productos sin query", () => {
    expect(buildVolverHref("")).toBe("/productos");
  });
});
