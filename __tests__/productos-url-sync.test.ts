/**
 * Fase B — Persistencia de búsqueda en URL: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. Lectura inicial de ?q= al montar (especificación — depende de window.location).
 * 2. URL se actualiza con el valor correcto de q, encodeado.
 * 3. q vacío → URL sin ?q= colgando.
 *
 * buildProductosUrl(q) es la función pura testeable.
 * router.replace() es el side effect — vive en el useEffect, no se testea sin jsdom.
 *
 * AHORA EN ROJO: page.tsx no exporta buildProductosUrl.
 */

import { describe, it, expect, vi } from "vitest";

// ── RED: el archivo actual no exporta buildProductosUrl ni applyInitialUrlSync ──
let buildProductosUrl: any = null;
let applyInitialUrlSync: any = null;
try {
  const mod = await import("@/app/(dashboard)/productos/page");
  buildProductosUrl = mod.buildProductosUrl;
  applyInitialUrlSync = mod.applyInitialUrlSync;
} catch {
  // Esperado en Fase B — exports no existen
}

describe("productos — URL sync", () => {
  // ── Contrato de existencia ────────────────────────────────────────
  it("el archivo exporta buildProductosUrl", () => {
    expect(buildProductosUrl).not.toBeNull();
    expect(typeof buildProductosUrl).toBe("function");
  });

  // ── R1: q vacío → /productos sin query ───────────────────────────
  it('q vacío devuelve "/productos" sin ?q=', () => {
    expect(buildProductosUrl("")).toBe("/productos");
  });

  // ── R2: q con valor → /productos?q=valor ─────────────────────────
  it("q con texto devuelve /productos?q=texto", () => {
    expect(buildProductosUrl("foo")).toBe("/productos?q=foo");
  });

  // ── R3: espacios encodeados correctamente ─────────────────────────
  it("espacios se encodean como %20, no como + ni crudos", () => {
    const url = buildProductosUrl("foo bar");
    expect(url).toContain("foo%20bar");
    expect(url).not.toContain("foo bar");
    expect(url).not.toContain("foo+bar");
  });

  // ── R4: caracteres especiales encodeados ──────────────────────────
  it("caracteres especiales se encodean sin romper la URL", () => {
    const url = buildProductosUrl("café & té");
    expect(url).toContain("caf%C3%A9");
    expect(url).toContain("%20%26%20");
    expect(url).toContain("t%C3%A9");
    expect(url).not.toContain("&"); // sin ampersand crudo
  });
  // ── R5: applyInitialUrlSync llama replace SIEMPRE (incluso urlQ="") ──
  it("el archivo exporta applyInitialUrlSync", () => {
    expect(applyInitialUrlSync).not.toBeNull();
    expect(typeof applyInitialUrlSync).toBe("function");
  });

  // ── R6: urlQ vacío → replace("/productos"), no se omite ──────────
  it("urlQ vacio llama replace con /productos (limpia ?q= residual)", () => {
    const replace = vi.fn();
    applyInitialUrlSync("", replace);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/productos");
  });

  // ── R7: urlQ con valor → replace con la URL encodeada ────────────
  it("urlQ con valor llama replace con /productos?q=valor", () => {
    const replace = vi.fn();
    applyInitialUrlSync("test", replace);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/productos?q=test");
  });
});

